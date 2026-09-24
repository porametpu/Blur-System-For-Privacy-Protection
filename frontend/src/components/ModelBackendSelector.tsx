"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getModelBackend, setModelBackend } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type BackendKey = 'pytorch' | 'torchscript' | 'onnx' | 'tensorrt';

interface BackendMeta {
  label: string;
  speed: string;
  speedColor: string;
  description: string;
  warning?: string;
  icon: string;
  accentClass: string;
  borderClass: string;
}

export type OnnxMode = 'server' | 'client';

interface Props {
  /** Called whenever the ONNX client/server sub-toggle changes */
  onClientModeChange?: (isClient: boolean) => void;
}

// ---------------------------------------------------------------------------
// Backend metadata
// ---------------------------------------------------------------------------
const BACKENDS: Record<BackendKey, BackendMeta> = {
  pytorch: {
    label: 'PyTorch',
    speed: '1×',
    speedColor: 'bg-slate-100 text-slate-600',
    description: 'Default. Runs on CPU or CUDA GPU. No extra setup needed.',
    icon: '',
    accentClass: 'bg-orange-500 text-white shadow-lg shadow-orange-400/20',
    borderClass: 'border-orange-300',
  },
  torchscript: {
    label: 'TorchScript',
    speed: '1.2×',
    speedColor: 'bg-blue-50 text-blue-600',
    description: 'Serialized PyTorch graph. Slightly faster, no extra libs.',
    icon: '',
    accentClass: 'bg-blue-600 text-white shadow-lg shadow-blue-400/20',
    borderClass: 'border-blue-400',
  },
  onnx: {
    label: 'ONNX',
    speed: '1.5×',
    speedColor: 'bg-teal-50 text-teal-600',
    description: 'Cross-platform open format. Can run on Server or your own GPU via browser.',
    icon: '',
    accentClass: 'bg-teal-500 text-white shadow-lg shadow-teal-400/20',
    borderClass: 'border-teal-400',
  },
  tensorrt: {
    label: 'TensorRT',
    speed: '3–5×',
    speedColor: 'bg-green-50 text-green-700',
    description: 'NVIDIA-only. Maximum GPU throughput with FP16 precision.',
    warning: 'Requires NVIDIA CUDA GPU + TensorRT installed on the server.',
    icon: '⚡',
    accentClass: 'bg-green-600 text-white shadow-lg shadow-green-500/20',
    borderClass: 'border-green-400',
  },
};

const ORDERED: BackendKey[] = ['pytorch', 'torchscript', 'onnx', 'tensorrt'];
const POLL_MS = 2500;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ModelBackendSelector({ onClientModeChange }: Props) {
  const [current, setCurrent] = useState<BackendKey | null>(null);
  const [exportStatus, setExportStatus] = useState<Record<string, string>>({});
  const [exportErrors, setExportErrors] = useState<Record<string, string>>({});
  const [hasCuda, setHasCuda] = useState(false);
  const [switching, setSwitching] = useState<BackendKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onnxMode, setOnnxMode] = useState<OnnxMode>('server');
  const [webGpuSupported, setWebGpuSupported] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect WebGPU support on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      setWebGpuSupported(true);
    }
  }, []);

  // ------------------------------------------------------------------
  // Fetch backend status from server
  // ------------------------------------------------------------------
  const fetchStatus = useCallback(async () => {
    try {
      const data = await getModelBackend();
      setCurrent(data.current as BackendKey);
      setExportStatus(data.export_status);
      setExportErrors(data.export_errors);
      setHasCuda(data.has_cuda);
    } catch { /* server not ready yet */ }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Poll while exporting
  useEffect(() => {
    const isExporting = Object.values(exportStatus).some(s => s === 'exporting');
    if (isExporting) {
      if (!pollRef.current) pollRef.current = setInterval(fetchStatus, POLL_MS);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        if (switching && exportStatus[switching] === 'ready') setSwitching(null);
      }
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [exportStatus, switching, fetchStatus]);

  // ------------------------------------------------------------------
  // Switch server backend
  // ------------------------------------------------------------------
  const handleSelect = async (key: BackendKey) => {
    if (key === current) return;
    if (exportStatus[key] === 'exporting') return;
    setError(null);
    setSwitching(key);
    try {
      const res = await setModelBackend(key);
      if (res.status === 'exporting') {
        setExportStatus(prev => ({ ...prev, [key]: 'exporting' }));
        if (!pollRef.current) pollRef.current = setInterval(fetchStatus, POLL_MS);
      } else {
        setCurrent(key);
        setSwitching(null);
        setExportStatus(prev => ({ ...prev, [key]: 'ready' }));
      }
      // If switching away from ONNX, reset to server mode
      if (key !== 'onnx') {
        setOnnxMode('server');
        onClientModeChange?.(false);
      }
    } catch (e: any) {
      setError(e.message);
      setSwitching(null);
    }
  };

  // ------------------------------------------------------------------
  // Toggle ONNX client/server sub-mode
  // ------------------------------------------------------------------
  const handleOnnxModeToggle = (mode: OnnxMode) => {
    setOnnxMode(mode);
    onClientModeChange?.(mode === 'client');
  };

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const statusBadge = (key: BackendKey) => {
    const st = exportStatus[key];
    if (st === 'exporting') return (
      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
        <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        Exporting…
      </span>
    );
    if (st === 'error') return (
      <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Error</span>
    );
    if (key === 'tensorrt' && !hasCuda) return (
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">GPU required</span>
    );
    return null;
  };

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
        INFERENCE_BACKEND
      </h4>

      {ORDERED.map(key => {
        const meta = BACKENDS[key];
        const isActive = current === key;
        const isExport = exportStatus[key] === 'exporting';
        const isError = exportStatus[key] === 'error';
        const noGpu = key === 'tensorrt' && !hasCuda;
        const disabled = isExport || noGpu;

        return (
          <div key={key}>
            <button
              onClick={() => !disabled && handleSelect(key)}
              disabled={disabled}
              title={noGpu ? meta.warning : undefined}
              className={[
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-200 text-left border-2',
                isActive
                  ? `${meta.accentClass} ${meta.borderClass}`
                  : isError
                    ? 'border-red-200 bg-red-50 text-red-500'
                    : noGpu
                      ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed opacity-60'
                      : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              <span className="text-lg leading-none shrink-0">{meta.icon}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm tracking-tight">{meta.label}</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20 text-white' : meta.speedColor}`}>
                    {meta.speed}
                  </span>
                  {statusBadge(key)}
                </div>
                <p className={`text-[10px] font-medium mt-0.5 leading-snug ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                  {meta.description}
                </p>
              </div>

              <div className="shrink-0">
                {isExport ? (
                  <svg className="w-4 h-4 text-amber-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                ) : isActive ? (
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : null}
              </div>
            </button>

            {/* ONNX Client/Server sub-toggle — only when ONNX is selected */}
            {key === 'onnx' && isActive && (
              <div className="mt-2 ml-3 p-3 bg-teal-50 border border-teal-100 rounded-xl space-y-2">
                <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">
                  WHERE TO PROCESS
                </p>
                <div className="flex gap-2">
                  {/* Server mode */}
                  <button
                    onClick={() => handleOnnxModeToggle('server')}
                    className={[
                      'flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-lg border-2 font-bold transition-all text-center',
                      onnxMode === 'server'
                        ? 'border-teal-500 bg-teal-500 text-white shadow-md shadow-teal-400/20'
                        : 'border-teal-200 bg-white text-teal-600 hover:border-teal-400',
                    ].join(' ')}
                  >
                    <span className="text-base">🖥️</span>
                    <span className="text-[9px] uppercase tracking-wider leading-tight">Server</span>
                    <span className={`text-[8px] font-normal leading-tight ${onnxMode === 'server' ? 'text-white/70' : 'text-slate-400'}`}>
                      Server GPU
                    </span>
                  </button>

                  {/* Client mode */}
                  <button
                    onClick={() => handleOnnxModeToggle('client')}
                    className={[
                      'flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-lg border-2 font-bold transition-all text-center',
                      onnxMode === 'client'
                        ? 'border-purple-500 bg-purple-500 text-white shadow-md shadow-purple-400/20'
                        : 'border-purple-200 bg-white text-purple-600 hover:border-purple-400',
                    ].join(' ')}
                  >
                    <span className="text-base">💻</span>
                    <span className="text-[9px] uppercase tracking-wider leading-tight">Client</span>
                    <span className={`text-[8px] font-normal leading-tight ${onnxMode === 'client' ? 'text-white/70' : 'text-slate-400'}`}>
                      {webGpuSupported ? 'Your GPU (WebGPU)' : 'Your GPU (WASM)'}
                    </span>
                  </button>
                </div>

                {onnxMode === 'client' && (
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 space-y-1">
                    <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest">💡 Client Mode</p>
                    <ul className="text-[9px] text-slate-500 space-y-0.5 leading-relaxed">
                      <li>• ONNX model downloads to your browser (~6 MB, cached)</li>
                      <li>• Detection runs on <b>{webGpuSupported ? 'your GPU via WebGPU' : 'your CPU via WASM'}</b></li>
                      <li>• Face recognition still runs on the server</li>
                      <li>• Your video never leaves your browser for detection</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {error && (
        <p className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2 leading-snug">
          ⚠️ {error}
        </p>
      )}

      {!hasCuda && (
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          ⚡ TensorRT requires an NVIDIA GPU on the server
        </p>
      )}
    </div>
  );
}
