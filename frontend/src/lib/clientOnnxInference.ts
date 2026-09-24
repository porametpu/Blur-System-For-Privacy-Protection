/**
 * clientOnnxInference.ts
 *
 * Runs YOLO face detection entirely inside the browser using onnxruntime-web.
 * Execution provider priority: WebGPU → WebAssembly (auto-fallback).
 *
 * Usage:
 *   await loadClientModel('/api/model-file');
 *   const faces = await detectFacesInFrame(imageData);
 */

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
export interface ClientFaceDetection {
  bbox: { x1: number; y1: number; x2: number; y2: number };
  confidence: number;
}

export type ClientProvider = 'webgpu' | 'wasm' | 'none';

// --------------------------------------------------------------------------
// State (module-level singletons)
// --------------------------------------------------------------------------
const INPUT_SIZE   = 640;
const CONF_THRESH  = 0.25;
const NMS_THRESH   = 0.45;

let _session:       any | null = null;   // ort.InferenceSession
let _provider:      ClientProvider = 'none';
let _loadPromise:   Promise<void> | null = null;

// --------------------------------------------------------------------------
// Load model
// --------------------------------------------------------------------------
export async function loadClientModel(modelUrl: string): Promise<{ provider: ClientProvider }> {
  if (_session) return { provider: _provider };
  if (_loadPromise) {
    await _loadPromise;
    return { provider: _provider };
  }

  _loadPromise = (async () => {
    // Dynamically import to avoid SSR / bundle issues
    const ort = await import('onnxruntime-web');

    // Pin CDN WASM binaries to the installed package version
    const ORT_VERSION = '1.20.1';
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
    ort.env.wasm.numThreads = 1;

    const providers: string[] = [];
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      providers.push('webgpu');
    }
    providers.push('wasm');

    try {
      _session  = await ort.InferenceSession.create(modelUrl, { executionProviders: providers });
      _provider = providers[0] as ClientProvider;
    } catch {
      // WebGPU context creation can fail silently — retry with WASM only
      _session  = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] });
      _provider = 'wasm';
    }
  })();

  await _loadPromise;
  return { provider: _provider };
}

export function getClientProvider(): ClientProvider {
  return _provider;
}

export function unloadClientModel(): void {
  _session     = null;
  _provider    = 'none';
  _loadPromise = null;
}

// --------------------------------------------------------------------------
// Preprocessing — resize + letterbox + CHW normalization
// --------------------------------------------------------------------------
function preprocess(imageData: ImageData, ort: any): {
  tensor:   any;  // ort.Tensor
  scale:    number;
  padX:     number;
  padY:     number;
} {
  const { width, height } = imageData;

  const scale = Math.min(INPUT_SIZE / width, INPUT_SIZE / height);
  const newW  = Math.round(width  * scale);
  const newH  = Math.round(height * scale);
  const padX  = Math.floor((INPUT_SIZE - newW) / 2);
  const padY  = Math.floor((INPUT_SIZE - newH) / 2);

  // Source canvas
  const src    = new OffscreenCanvas(width, height);
  src.getContext('2d')!.putImageData(imageData, 0, 0);

  // Destination canvas (letterboxed, grey fill = 114)
  const dst    = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
  const dstCtx = dst.getContext('2d')!;
  dstCtx.fillStyle = 'rgb(114,114,114)';
  dstCtx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  dstCtx.drawImage(src, padX, padY, newW, newH);

  const pixels = dstCtx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const N      = INPUT_SIZE * INPUT_SIZE;
  const f32    = new Float32Array(3 * N);

  for (let i = 0; i < N; i++) {
    f32[i]         = pixels[i * 4    ] / 255.0;  // R
    f32[N     + i] = pixels[i * 4 + 1] / 255.0;  // G
    f32[N * 2 + i] = pixels[i * 4 + 2] / 255.0;  // B
  }

  const tensor = new ort.Tensor('float32', f32, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  return { tensor, scale, padX, padY };
}

// --------------------------------------------------------------------------
// NMS helper
// --------------------------------------------------------------------------
function iou(a: number[], b: number[]): number {
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(a[2], b[2]);
  const iy2 = Math.min(a[3], b[3]);
  const iw  = Math.max(0, ix2 - ix1);
  const ih  = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (areaA + areaB - inter + 1e-6);
}

function nms(boxes: number[][], scores: number[], thresh: number): number[] {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const keep  = new Set<number>();
  const supp  = new Set<number>();
  for (const i of order) {
    if (supp.has(i)) continue;
    keep.add(i);
    for (const j of order) {
      if (j !== i && !supp.has(j) && iou(boxes[i], boxes[j]) > thresh) {
        supp.add(j);
      }
    }
  }
  return [...keep];
}

// --------------------------------------------------------------------------
// Main detection function
// --------------------------------------------------------------------------
export async function detectFacesInFrame(
  imageData: ImageData,
  confThreshold: number = CONF_THRESH,
): Promise<ClientFaceDetection[]> {
  if (!_session) throw new Error('ONNX model not loaded. Call loadClientModel() first.');

  const origW = imageData.width;
  const origH = imageData.height;

  // --- Preprocess ---
  const ort = await import('onnxruntime-web');

  const { tensor, scale, padX, padY } = preprocess(imageData, ort);

  const feeds: Record<string, any> = {};
  feeds[_session.inputNames[0]] = tensor;

  // --- Inference ---
  const output    = await _session.run(feeds);
  const outTensor = output[_session.outputNames[0]];
  const outData   = outTensor.data as Float32Array;
  const dims      = outTensor.dims as number[];

  // YOLO v8/v11 output: [1, numAttrs, numAnchors] where numAttrs = 4 + numClasses
  // For single-class face model: [1, 5, 8400]
  // Some variants output [1, 8400, 5] (transposed)
  const transposed = dims[1] > dims[2];
  const numAnchors = transposed ? dims[1] : dims[2];
  const numAttrs   = transposed ? dims[2] : dims[1];

  const boxes:  number[][] = [];
  const scores: number[]   = [];

  for (let i = 0; i < numAnchors; i++) {
    const cx   = transposed ? outData[i * numAttrs + 0] : outData[0 * numAnchors + i];
    const cy   = transposed ? outData[i * numAttrs + 1] : outData[1 * numAnchors + i];
    const w    = transposed ? outData[i * numAttrs + 2] : outData[2 * numAnchors + i];
    const h    = transposed ? outData[i * numAttrs + 3] : outData[3 * numAnchors + i];
    const conf = transposed ? outData[i * numAttrs + 4] : outData[4 * numAnchors + i];

    if (conf < confThreshold) continue;

    boxes.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]);
    scores.push(conf);
  }

  const kept = nms(boxes, scores, NMS_THRESH);

  return kept
    .map(idx => {
      const [x1, y1, x2, y2] = boxes[idx];
      return {
        bbox: {
          x1: Math.max(0, Math.round((x1 - padX) / scale)),
          y1: Math.max(0, Math.round((y1 - padY) / scale)),
          x2: Math.min(origW, Math.round((x2 - padX) / scale)),
          y2: Math.min(origH, Math.round((y2 - padY) / scale)),
        },
        confidence: scores[idx],
      };
    })
    .filter(d => d.bbox.x2 > d.bbox.x1 && d.bbox.y2 > d.bbox.y1);
}

// --------------------------------------------------------------------------
// High-level helper: process a whole video file (local File object)
// --------------------------------------------------------------------------
export interface FrameResult {
  frame_number: number;
  detections:   ClientFaceDetection[];
}

export async function runVideoDetection(
  file:         File,
  fps:          number,
  totalFrames:  number,
  skipFrames:   number = 5,
  confThresh:   number = CONF_THRESH,
  onProgress?:  (pct: number) => void,
): Promise<FrameResult[]> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const videoEl = document.createElement('video');
    videoEl.src   = objectUrl;
    videoEl.muted = true;
    videoEl.preload = 'auto';

    await new Promise<void>((resolve, reject) => {
      videoEl.onloadedmetadata = () => resolve();
      videoEl.onerror          = () => reject(new Error('Failed to load video for client-side inference'));
      videoEl.load();
    });

    const canvas  = document.createElement('canvas');
    canvas.width  = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx     = canvas.getContext('2d')!;

    const results: FrameResult[] = [];
    const framesToProcess = Math.ceil(totalFrames / skipFrames);
    let processed = 0;

    for (let frameNum = 0; frameNum < totalFrames; frameNum += skipFrames) {
      const timestamp = frameNum / fps;
      videoEl.currentTime = timestamp;
      await new Promise<void>(resolve => {
        const handler = () => { videoEl.removeEventListener('seeked', handler); resolve(); };
        videoEl.addEventListener('seeked', handler);
      });

      ctx.drawImage(videoEl, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const faces     = await detectFacesInFrame(imageData, confThresh);

      if (faces.length > 0) {
        results.push({ frame_number: frameNum, detections: faces });
      }

      processed++;
      onProgress?.(Math.round((processed / framesToProcess) * 100));
    }

    return results;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
