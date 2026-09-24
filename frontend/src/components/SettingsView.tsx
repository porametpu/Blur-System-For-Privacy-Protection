"use client";

import React, { useEffect, useState } from 'react';
import ModelBackendSelector from './ModelBackendSelector';
import { Settings, Cpu, Info } from 'lucide-react';

const ONNX_MODE_KEY = 'blur_onnx_client_mode';

export default function SettingsView() {
  const [isClientMode, setIsClientMode] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load persisted mode on mount
  useEffect(() => {
    const stored = localStorage.getItem(ONNX_MODE_KEY);
    if (stored === 'true') setIsClientMode(true);
  }, []);

  const handleClientModeChange = (isClient: boolean) => {
    setIsClientMode(isClient);
    localStorage.setItem(ONNX_MODE_KEY, String(isClient));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8 fade-slide-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center shadow">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500 font-medium">Configure inference backend and app preferences</p>
        </div>
        {saved && (
          <span className="ml-auto text-xs font-black text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full animate-pulse">
            ✓ Saved
          </span>
        )}
      </div>

      {/* Inference Backend */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <Cpu className="w-5 h-5 text-slate-400" />
          <h2 className="font-black text-slate-800 tracking-widest text-sm uppercase">Inference Backend</h2>
        </div>

        <ModelBackendSelector onClientModeChange={handleClientModeChange} />

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex gap-3">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            The selected backend applies to all future detection jobs. Changes take effect immediately.
            <br />
            <strong className="text-slate-700">ONNX Client mode</strong> runs detection in your browser using WebGPU or WASM — your video never leaves your device for detection.
          </p>
        </div>
      </div>

    </div>
  );
}
