"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';

type Detection = { bbox: { x1: number; y1: number; x2: number; y2: number }; confidence: number };
type ModelOption = { key: string; label: string; family: string; available: boolean; description: string };

export default function WebcamTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const busyRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('YOLO26');
  const [selectedSize, setSelectedSize] = useState('n');
  const [modelLoading, setModelLoading] = useState(false);
  const [lastStatus, setLastStatus] = useState('');

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
        setModels(available);
        const initialModel = data.current_model || available[0]?.key || '';
        const initial = available.find((model: ModelOption) => model.key === initialModel);
        setSelectedModel(initialModel);
        setSelectedFamily(initial?.key === 'yunet' ? 'YuNet' : initial?.key === 'retinaface' ? 'RetinaFace' : initial?.family || 'YOLO26');
        setSelectedSize(initialModel.slice(-1) || 'n');
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load models'));
  }, []);

  const stopCamera = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
    setDetections([]);
  }, []);

  const detectFrame = useCallback(async () => {
    if (busyRef.current || !videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;
    busyRef.current = true;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const res = await fetch('/api/webcam-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: canvas.toDataURL('image/jpeg', 0.72), model: selectedModel || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Detection request failed');
      setDetections(data.detections || []);
      setLatency(data.latency_ms || 0);
      setLastStatus(`Live · ${data.model || selectedModel || 'default'}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Webcam detection failed');
    } finally {
      busyRef.current = false;
    }
  }, [selectedModel]);

  const liveLoop = useCallback((timestamp: number) => {
    if (!running) return;
    if (timestamp - lastFrameRef.current >= 1000 / 12) {
      lastFrameRef.current = timestamp;
      void detectFrame();
    }
    animationRef.current = requestAnimationFrame(liveLoop);
  }, [detectFrame, running]);

  useEffect(() => {
    if (running) animationRef.current = requestAnimationFrame(liveLoop);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [running, liveLoop]);

  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    setModelLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not load selected model');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load selected model');
    } finally {
      setModelLoading(false);
    }
  };

  const handleFamilyChange = (family: string) => {
    setSelectedFamily(family);
    const model = modelKeyFor(family, selectedSize);
    void handleModelChange(model);
  };

  const handleSizeChange = (size: string) => {
    setSelectedSize(size);
    const model = modelKeyFor(selectedFamily, size);
    void handleModelChange(model);
  };

  const startCamera = async () => {
    setError(null);
    if (!window.isSecureContext) {
      setError('Camera access requires HTTPS or localhost. Open the app using http://localhost, or enable HTTPS.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable in this browser or context. Check Safari camera permissions and use localhost/HTTPS.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setRunning(true);
    } catch (e: unknown) {
      const cameraError = e as DOMException;
      setError(cameraError.name === 'NotAllowedError' ? 'Camera permission was denied.' : cameraError.message || 'Could not access the camera.');
    }
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="max-w-5xl mx-auto py-8 w-full space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800">Webcam Face Test</h1>
        <p className="text-slate-500 mt-1">Live face detection at up to 12 frames per second. Frames are sent only for detection and are not saved.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Model family</span>
            <select value={selectedFamily} onChange={e => handleFamilyChange(e.target.value)} disabled={modelLoading || models.length === 0} className="w-full rounded-xl border-2 border-slate-100 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-50">
              {familyOptions.map(family => <option key={family} value={family}>{family}</option>)}
            </select>
          </label>
          <label className={`space-y-1 ${!selectedFamily.startsWith('YOLO') ? 'opacity-50' : ''}`}>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Model size</span>
            <select value={selectedSize} disabled={modelLoading || !selectedFamily.startsWith('YOLO')} onChange={e => handleSizeChange(e.target.value)} className="w-full rounded-xl border-2 border-slate-100 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 disabled:cursor-not-allowed">
              {sizeOptions.map(size => <option key={size} value={size}>{size.toUpperCase()} — {size === 'n' ? 'Fastest' : size === 'x' ? 'Most accurate' : 'Balanced'}</option>)}
            </select>
          </label>
          {modelLoading && <span className="text-xs font-semibold text-blue-600">Loading model…</span>}
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 aspect-video">
          <video ref={videoRef} muted playsInline className="w-full h-full object-contain" />
          {!running && <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70"><Camera className="w-12 h-12 mb-3" /><span>Camera is off</span></div>}
          {detections.map((d, i) => {
            const video = videoRef.current;
            const width = video?.videoWidth || 1;
            const height = video?.videoHeight || 1;
            const containerRatio = 16 / 9;
            const videoRatio = width / height;
            const renderedWidth = videoRatio > containerRatio ? 100 : (videoRatio / containerRatio) * 100;
            const renderedHeight = videoRatio > containerRatio ? (containerRatio / videoRatio) * 100 : 100;
            const offsetX = (100 - renderedWidth) / 2;
            const offsetY = (100 - renderedHeight) / 2;
            return <div key={i} className="absolute border-2 border-green-400 rounded-lg" style={{ left: `${offsetX + (d.bbox.x1 / width) * renderedWidth}%`, top: `${offsetY + (d.bbox.y1 / height) * renderedHeight}%`, width: `${((d.bbox.x2 - d.bbox.x1) / width) * renderedWidth}%`, height: `${((d.bbox.y2 - d.bbox.y1) / height) * renderedHeight}%` }}><span className="absolute -top-6 left-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded">Face {Math.round(d.confidence * 100)}%</span></div>;
          })}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex items-center justify-between mt-4 gap-3">
          <span className="text-sm font-bold text-slate-500">{running ? `${detections.length} face${detections.length === 1 ? '' : 's'} detected · ${latency || '—'} ms` : 'Ready to test'}{lastStatus && running ? ` · ${lastStatus}` : ''}</span>
          <div className="flex gap-2">
            {running ? <button onClick={stopCamera} className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100"><CameraOff className="w-4 h-4" /> Stop</button> : <button onClick={startCamera} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"><Camera className="w-4 h-4" /> Start camera</button>}
            <button onClick={detectFrame} disabled={!running} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-40"><RefreshCw className="w-4 h-4" /> Test now</button>
          </div>
        </div>
        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}
      </div>
    </div>
  );
}
