"use client";

import React, { useState } from 'react';
import { BlurType } from '../lib/types';
import { Download, Sliders, Box, Loader2, PlaySquare, CheckCircle2 } from 'lucide-react';

interface ExportPanelProps {
  onExport: (blurType: BlurType, strength: number) => void;
  isExporting: boolean;
  downloadUrl: string | null;
  cloudinaryUrl?: string;
  isImage?: boolean;
}

export default function ExportPanel({ onExport, isExporting, downloadUrl, cloudinaryUrl, isImage }: ExportPanelProps) {
  const [blurType, setBlurType] = useState<BlurType>('gaussian');
  const [strength, setStrength] = useState<number>(51);

  const blurTypes = [
    { id: 'gaussian', label: 'Gaussian', desc: 'Smooth, natural blur' },
    { id: 'pixelate', label: 'Pixelate', desc: 'Blocky, mosaic effect' },
    { id: 'black', label: 'Black Box', desc: 'Solid black redaction' },
  ];

  return (
    <div className="glass-panel max-w-3xl mx-auto overflow-hidden fade-slide-in">
      <div className="p-8 border-b border-slate-100 dark:border-slate-800/50">
        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 text-color-black">{isImage ? 'Export Image' : 'Export Video'}</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Finalize how the blur will look in your exported {isImage ? 'image' : 'video'}.</p>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Blur Type */}
        <div className="space-y-4">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 text-color-black">
            <Box className="w-4 h-4" /> Blur Engine
          </label>
          <div className="space-y-3">
            {blurTypes.map(type => (
              <label
                key={type.id}
                className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${blurType === type.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
              >
                <input
                  type="radio"
                  name="blurType"
                  checked={blurType === type.id}
                  onChange={() => setBlurType(type.id as BlurType)}
                  className="mt-1"
                />
                <div>
                  <span className="block font-black text-slate-800 dark:text-slate-200 text-color-black">{type.label}</span>
                  <span className="block text-xs font-medium text-slate-500">{type.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Strength & Action */}
        <div className="space-y-8 flex flex-col">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 text-color-black">
                <Sliders className="w-4 h-4" /> Intensity
              </label>
              <span className="text-xs font-black dark:text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                {strength}px
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="151"
              step="2"
              value={strength}
              onChange={(e) => setStrength(parseInt(e.target.value))}
              disabled={blurType === 'black'}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
              <span>Subtle</span>
              <span>Absolute</span>
            </div>
          </div>

          <div className="mt-auto space-y-4">
            {downloadUrl ? (
              <div className="space-y-3 fade-slide-in">
                <div className="p-4 bg-green-200 dark:bg-green-50/20 border-2 border-green-300 dark:border-green-500 rounded-2xl flex items-center justify-center gap-2 text-green-700 dark:text-green-400 font-bold">
                  <CheckCircle2 className="w-5 h-5" /> Export Complete
                </div>
                <a
                  href={downloadUrl}
                  download={isImage ? "Blurred_Image.jpg" : "Blurred_Video.mp4"}
                  className="flex items-center justify-center gap-3 w-full py-5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-black text-lg rounded-2xl shadow-xl hover:-translate-y-1 transition-transform"
                >
                  <Download className="w-6 h-6" /> {isImage ? 'Download Image' : 'Download Video'}
                </a>
                {cloudinaryUrl && (
                  <a
                    href={cloudinaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors"
                  >
                    View on Cloudinary
                  </a>
                )}
              </div>
            ) : (
              <button
                onClick={() => onExport(blurType, strength)}
                disabled={isExporting}
                className="flex items-center justify-center gap-3 w-full py-5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-xl rounded-2xl shadow-xl shadow-blue-500/30 hover:-translate-y-1 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /> Processing...</>
                ) : (
                  <><PlaySquare className="w-6 h-6" /> {isImage ? 'Generate Image' : 'Generate Video'}</>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
