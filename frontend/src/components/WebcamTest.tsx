"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw, ShieldCheck } from 'lucide-react';

type Detection = { bbox: { x1: number; y1: number; x2: number; y2: number }; confidence: number; person_id?: number };
type TrackedDetection = Detection & { trackId: number; missed: number };
type ModelOption = { key: string; label: string; family: string; available: boolean; description: string };
type BlurMode = 'everyone' | 'selected' | 'except-selected';
type BlurEffect = 'gaussian' | 'pixelate' | 'black';

const iou = (a: Detection['bbox'], b: Detection['bbox']) => {
  const x1 = Math.max(a.x1, b.x1); const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2); const y2 = Math.min(a.y2, b.y2);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = Math.max(1, a.x2 - a.x1) * Math.max(1, a.y2 - a.y1);
  const areaB = Math.max(1, b.x2 - b.x1) * Math.max(1, b.y2 - b.y1);
  return intersection / Math.max(1, areaA + areaB - intersection);
};

export default function WebcamTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionAnimationRef = useRef<number | null>(null);
  const renderAnimationRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const busyRef = useRef(false);
  const nextTrackIdRef = useRef(-1);
  const sessionIdRef = useRef(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `webcam-${Date.now()}`);
  const tracksRef = useRef<TrackedDetection[]>([]);
  const selectedTrackIdsRef = useRef<Set<number>>(new Set());
  const bboxHistoryRef = useRef<Map<number, Detection['bbox'][]>>(new Map());

  const [running, setRunning] = useState(false);
  const [detections, setDetections] = useState<TrackedDetection[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());
  const [blurMode, setBlurMode] = useState<BlurMode>('everyone');
  const [blurEffect, setBlurEffect] = useState<BlurEffect>('gaussian');
  const [blurIntensity, setBlurIntensity] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('YOLO26');
  const [selectedSize, setSelectedSize] = useState('n');
  const [modelLoading, setModelLoading] = useState(false);
  const [lastStatus, setLastStatus] = useState('');

  useEffect(() => {
    selectedTrackIdsRef.current = selectedTrackIds;
  }, [selectedTrackIds]);

  const familyOptions = ['YOLOv8', 'YOLO11', 'YOLO26', 'YuNet', 'RetinaFace'];
  const sizeOptions = ['n', 's', 'm', 'l', 'x'];

  const modelKeyFor = (family: string, size: string) => {
    if (family === 'YOLOv8') return `yolov8${size}`;
    if (family === 'YOLO11') return `yolo11${size}`;
    if (family === 'YOLO26') return `yolo26${size}`;
    return family === 'YuNet' ? 'yunet' : 'retinaface';
  };

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Could not load models')))
      .then(data => {
        const available = (data.models || []).filter((model: ModelOption) => model.available);
        const initialModel = data.current_model || available[0]?.key || '';
        const initial = available.find((model: ModelOption) => model.key === initialModel);
        setModels(available); setSelectedModel(initialModel);
        setSelectedFamily(initial?.key === 'yunet' ? 'YuNet' : initial?.key === 'retinaface' ? 'RetinaFace' : initial?.family || 'YOLO26');
        setSelectedSize(initialModel.slice(-1) || 'n');
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load models'));
  }, []);

  const updateTracks = useCallback((incoming: Detection[]) => {
    const previous = tracksRef.current;
    const used = new Set<number>();
    const usedIdentityIds = new Set<number>();
    const stabilize = (trackId: number, previous: Detection['bbox'], next: Detection['bbox']) => {
      const history = [...(bboxHistoryRef.current.get(trackId) || []), next].slice(-5);
      bboxHistoryRef.current.set(trackId, history);
      const median = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      };
      const filtered = {
        x1: median(history.map(box => box.x1)),
        y1: median(history.map(box => box.y1)),
        x2: median(history.map(box => box.x2)),
        y2: median(history.map(box => box.y2)),
      };
      const selected = selectedTrackIdsRef.current.has(trackId);
      const alpha = selected ? 0.22 : 0.35;
      return {
        x1: previous.x1 + (filtered.x1 - previous.x1) * alpha,
        y1: previous.y1 + (filtered.y1 - previous.y1) * alpha,
        x2: previous.x2 + (filtered.x2 - previous.x2) * alpha,
        y2: previous.y2 + (filtered.y2 - previous.y2) * alpha,
      };
    };
    const matched: TrackedDetection[] = incoming.map(det => {
      let bestIndex = -1; let bestScore = 0.12;
      previous.forEach((track, index) => {
        if (!used.has(index)) {
          const score = iou(track.bbox, det.bbox);
          if (score > bestScore) { bestScore = score; bestIndex = index; }
        }
      });
      if (det.person_id !== undefined && !usedIdentityIds.has(det.person_id)) {
        const identityTrack = previous.findIndex(track => track.trackId === det.person_id && !used.has(previous.indexOf(track)));
        if (identityTrack >= 0) {
          used.add(identityTrack);
          usedIdentityIds.add(det.person_id);
          return { ...det, bbox: stabilize(det.person_id, previous[identityTrack].bbox, det.bbox), trackId: det.person_id as number, missed: 0 };
        }
      }
      if (bestIndex >= 0) {
        used.add(bestIndex);
        if (det.person_id !== undefined) usedIdentityIds.add(det.person_id);
        return { ...det, bbox: stabilize(previous[bestIndex].trackId, previous[bestIndex].bbox, det.bbox), trackId: previous[bestIndex].trackId, missed: 0 };
      }
      if (det.person_id !== undefined && !usedIdentityIds.has(det.person_id)) {
        usedIdentityIds.add(det.person_id);
        return { ...det, trackId: det.person_id, missed: 0 };
      }
      return { ...det, trackId: nextTrackIdRef.current--, missed: 0 };
    });
    const retained = previous
      .filter((_, index) => !used.has(index))
      .map(track => ({ ...track, missed: track.missed + 1 }))
      .filter(track => track.missed <= 3);
    const assignedTrackIds = new Set<number>();
    const next = [...matched, ...retained].map(track => {
      if (assignedTrackIds.has(track.trackId)) {
        return { ...track, trackId: nextTrackIdRef.current-- };
      }
      assignedTrackIds.add(track.trackId);
      return track;
    });
    const activeTrackIds = new Set(next.map(track => track.trackId));
    bboxHistoryRef.current.forEach((_, trackId) => {
      if (!activeTrackIds.has(trackId)) bboxHistoryRef.current.delete(trackId);
    });
    tracksRef.current = next; setDetections(next); return next;
  }, []);

  const shouldBlurTrack = useCallback((trackId: number) => {
    if (blurMode === 'everyone') return true;
    // Keep the privacy-safe default: in "everyone except selected" mode,
    // blur everyone until the user explicitly selects a person to exclude.
    if (blurMode === 'except-selected' && selectedTrackIds.size === 0) return true;
    if (selectedTrackIds.size === 0) return false;
    return blurMode === 'selected' ? selectedTrackIds.has(trackId) : !selectedTrackIds.has(trackId);
  }, [blurMode, selectedTrackIds]);

  const drawProcessedFrame = useCallback(() => {
    const video = videoRef.current; const source = sourceCanvasRef.current; const canvas = displayCanvasRef.current;
    if (!video || !source || !canvas || video.readyState < 2 || !video.videoWidth) return;
    source.width = video.videoWidth; source.height = video.videoHeight;
    source.getContext('2d')?.drawImage(video, 0, 0, source.width, source.height);
    canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    tracksRef.current.forEach(track => {
      if (!shouldBlurTrack(track.trackId)) return;
      const b = track.bbox; const padX = Math.round((b.x2 - b.x1) * 0.12); const padY = Math.round((b.y2 - b.y1) * 0.18);
      const x = Math.max(0, b.x1 - padX); const y = Math.max(0, b.y1 - padY);
      const x2 = Math.min(canvas.width, b.x2 + padX); const y2 = Math.min(canvas.height, b.y2 + padY);
      const width = x2 - x; const height = y2 - y;
      if (blurEffect === 'black') {
        ctx.fillStyle = '#000'; ctx.fillRect(x, y, width, height);
      } else if (blurEffect === 'pixelate') {
        const blockSize = Math.max(3, Math.round(3 + blurIntensity / 4));
        const smallWidth = Math.max(1, Math.ceil(width / blockSize));
        const smallHeight = Math.max(1, Math.ceil(height / blockSize));
        const pixelCanvas = document.createElement('canvas');
        pixelCanvas.width = smallWidth; pixelCanvas.height = smallHeight;
        const pixelCtx = pixelCanvas.getContext('2d');
        if (pixelCtx) {
          pixelCtx.drawImage(source, x, y, width, height, 0, 0, smallWidth, smallHeight);
          ctx.imageSmoothingEnabled = false; ctx.drawImage(pixelCanvas, 0, 0, smallWidth, smallHeight, x, y, width, height); ctx.imageSmoothingEnabled = true;
        }
      } else {
        // Safari may ignore CanvasRenderingContext2D.filter. Use a
        // downsample/upscale pass as a reliable Gaussian-like fallback.
        const blurCanvas = document.createElement('canvas');
        const blurScale = Math.max(2, Math.round(2 + blurIntensity / 18));
        const smallWidth = Math.max(1, Math.round(width / blurScale));
        const smallHeight = Math.max(1, Math.round(height / blurScale));
        blurCanvas.width = smallWidth; blurCanvas.height = smallHeight;
        const blurCtx = blurCanvas.getContext('2d');
        if (blurCtx) {
          blurCtx.imageSmoothingEnabled = true;
          blurCtx.drawImage(source, x, y, width, height, 0, 0, smallWidth, smallHeight);
          ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(blurCanvas, 0, 0, smallWidth, smallHeight, x, y, width, height);
          ctx.restore();
        }
      }
    });
  }, [blurEffect, blurIntensity, shouldBlurTrack]);

  const detectFrame = useCallback(async () => {
    if (busyRef.current || !videoRef.current || !captureCanvasRef.current || videoRef.current.readyState < 2) return;
    busyRef.current = true;
    const video = videoRef.current; const canvas = captureCanvasRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const res = await fetch('/api/webcam-detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: canvas.toDataURL('image/jpeg', 0.72), model: selectedModel || undefined, session_id: sessionIdRef.current }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.detail || data.error || 'Detection request failed');
      updateTracks(data.detections || []); setLatency(data.latency_ms || 0); setLastStatus(`Live · ${data.model || selectedModel || 'default'}`);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Webcam detection failed'); }
    finally { busyRef.current = false; }
  }, [selectedModel, updateTracks]);

  const liveLoop = useCallback((timestamp: number) => {
    if (!running) return;
    if (timestamp - lastFrameRef.current >= 1000 / 12) { lastFrameRef.current = timestamp; void detectFrame(); }
    detectionAnimationRef.current = requestAnimationFrame(liveLoop);
  }, [detectFrame, running]);

  const renderLoop = useCallback(() => {
    if (!running) return;
    drawProcessedFrame(); renderAnimationRef.current = requestAnimationFrame(renderLoop);
  }, [drawProcessedFrame, running]);

  useEffect(() => {
    if (running) { detectionAnimationRef.current = requestAnimationFrame(liveLoop); renderAnimationRef.current = requestAnimationFrame(renderLoop); }
    return () => { if (detectionAnimationRef.current) cancelAnimationFrame(detectionAnimationRef.current); if (renderAnimationRef.current) cancelAnimationFrame(renderAnimationRef.current); };
  }, [running, liveLoop, renderLoop]);

  const stopCamera = useCallback(() => {
    if (detectionAnimationRef.current) cancelAnimationFrame(detectionAnimationRef.current); if (renderAnimationRef.current) cancelAnimationFrame(renderAnimationRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    tracksRef.current = []; setRunning(false); setDetections([]); setSelectedTrackIds(new Set());
  }, []);

  const handleModelChange = async (model: string) => {
    setSelectedModel(model); setModelLoading(true); setError(null);
    try {
      const res = await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.detail || 'Could not load selected model');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Could not load selected model'); }
    finally { setModelLoading(false); }
  };

  const startCamera = async () => {
    setError(null);
    if (!window.isSecureContext) { setError('Camera access requires HTTPS or localhost.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access is unavailable. Check Safari permissions and use localhost/HTTPS.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream; if (!videoRef.current) return;
      videoRef.current.srcObject = stream; await videoRef.current.play(); setRunning(true);
    } catch (e: unknown) { const cameraError = e as DOMException; setError(cameraError.name === 'NotAllowedError' ? 'Camera permission was denied.' : cameraError.message || 'Could not access the camera.'); }
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  const visibleTracks = detections.filter(d => d.missed === 0);
  return (
    <div className="max-w-5xl mx-auto py-8 w-full space-y-6">
      <div><h1 className="text-3xl font-black text-slate-800">Live Privacy Stream</h1><p className="text-slate-500 mt-1">Select who to blur in real time. Video frames are processed for this session and are not saved.</p></div>
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-2xl bg-slate-50 p-4">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Live settings</p><p className="mt-1 text-xs text-slate-500">Configure detection and privacy.</p></div>
            <label className="block space-y-1"><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Model family</span><select value={selectedFamily} onChange={e => { const family = e.target.value; setSelectedFamily(family); void handleModelChange(modelKeyFor(family, selectedSize)); }} disabled={modelLoading || models.length === 0} className="w-full rounded-xl border-2 border-white bg-white px-3 py-3 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-50">{familyOptions.map(family => <option key={family}>{family}</option>)}</select></label>
            {selectedFamily.startsWith('YOLO') && <label className="block space-y-1"><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Model size</span><select value={selectedSize} disabled={modelLoading} onChange={e => { const size = e.target.value; setSelectedSize(size); void handleModelChange(modelKeyFor(selectedFamily, size)); }} className="w-full rounded-xl border-2 border-white bg-white px-3 py-3 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-50">{sizeOptions.map(size => <option key={size}>{size.toUpperCase()} — {size === 'n' ? 'Fastest' : size === 'x' ? 'Most accurate' : 'Balanced'}</option>)}</select></label>}
            <div><p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Privacy mode</p><div className="space-y-2">{([['everyone', 'Blur everyone'], ['selected', 'Blur selected person'], ['except-selected', 'Everyone except selected']] as const).map(([value, label]) => <button key={value} onClick={() => setBlurMode(value)} className={`w-full rounded-xl border-2 px-3 py-2.5 text-left text-xs font-bold transition ${blurMode === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-white bg-white text-slate-500 hover:border-blue-200'}`}>{label}</button>)}</div></div>
            <div className="space-y-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Blur technique</p><div className="grid grid-cols-1 gap-2">{([['gaussian', 'Gaussian Blur'], ['pixelate', 'Pixelate'], ['black', 'Black Box']] as const).map(([value, label]) => <button key={value} onClick={() => setBlurEffect(value)} className={`rounded-xl px-3 py-2 text-left text-xs font-bold ${blurEffect === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{label}</button>)}</div>{blurEffect !== 'black' && <label className="block"><span className="flex justify-between text-xs font-bold text-slate-500"><span>Intensity</span><span className="text-blue-600">{blurIntensity}</span></span><input type="range" min="1" max="100" value={blurIntensity} onChange={e => setBlurIntensity(Number(e.target.value))} className="mt-2 w-full accent-blue-600" /></label>}</div>
            <div className="rounded-xl bg-white p-3"><div className="mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-600" /><span className="text-xs font-bold text-slate-600">Person selection</span></div><div className="flex flex-wrap gap-2">{visibleTracks.map((track, index) => <button key={track.trackId} onClick={() => setSelectedTrackIds(current => { const next = new Set(current); if (next.has(track.trackId)) next.delete(track.trackId); else next.add(track.trackId); return next; })} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${selectedTrackIds.has(track.trackId) ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>Person {index + 1}</button>)}{visibleTracks.length === 0 && <span className="text-xs text-slate-400">Start camera first.</span>}</div></div>
          </aside>
          <section className="min-w-0 space-y-4">
            <div className="relative overflow-hidden rounded-2xl bg-slate-900 aspect-video"><video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-contain opacity-0" /><canvas ref={displayCanvasRef} className="h-full w-full object-contain" />{!running && <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70"><Camera className="w-12 h-12 mb-3" /><span>Camera is off</span></div>}</div>
            <canvas ref={sourceCanvasRef} className="hidden" /><canvas ref={captureCanvasRef} className="hidden" />
            <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-bold text-slate-500">{running ? `${visibleTracks.length} face${visibleTracks.length === 1 ? '' : 's'} detected · ${latency || '—'} ms${lastStatus ? ` · ${lastStatus}` : ''}` : 'Ready to test'}</span><div className="flex gap-2">{running ? <button onClick={stopCamera} className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600"><CameraOff className="w-4 h-4" /> Stop</button> : <button onClick={startCamera} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"><Camera className="w-4 h-4" /> Start live stream</button>}<button onClick={detectFrame} disabled={!running} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-40"><RefreshCw className="w-4 h-4" /> Test now</button></div></div>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
