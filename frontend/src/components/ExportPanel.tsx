"use client";

import React, { useState } from 'react';
import { BlurType } from '../lib/types';
import {
  Download, Sliders, Box, Loader2, PlaySquare, CheckCircle2,
  RefreshCcw, Copy, Check, Cloud, Link2, Sparkles, Image as ImageIcon
} from 'lucide-react';

interface ExportPanelProps {
  onExport: (blurType: BlurType, strength: number) => void;
  onSettingsChange?: () => void;
  onStartOver?: () => void;
  isExporting: boolean;
  downloadUrl: string | null;
  cloudinaryUrl?: string;
  isImage?: boolean;
  initialBlurType?: BlurType;
  initialStrength?: number;
  /** Pass current sticker from parent so export can inherit it */
  stickerImage?: string | null;
  /** Summary info to show */
  summary?: {
    personsBlurred: number;
    totalPersons: number;
    blurMode: string;
  };
}

export default function ExportPanel({
  onExport, onSettingsChange, onStartOver, isExporting, downloadUrl, cloudinaryUrl,
  isImage, initialBlurType = 'gaussian', initialStrength = 51, stickerImage, summary
}: ExportPanelProps) {
  const [blurType, setBlurType] = useState<BlurType>(initialBlurType);
  const [strength, setStrength] = useState<number>(initialStrength);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleBlurTypeChange = (newType: BlurType) => {
    setBlurType(newType);
    if (onSettingsChange) onSettingsChange();
  };

  const handleStrengthChange = (newStrength: number) => {
    setStrength(newStrength);
    if (onSettingsChange) onSettingsChange();
  };

  const handleDirectDownload = async (e: React.MouseEvent) => {
    if (!downloadUrl) return;
    try {
      setIsDownloading(true);
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = isImage ? 'BlurSystem_Image.jpg' : 'BlurSystem_Video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const blurTypes: { id: BlurType; label: string; desc: string; color: string; emoji: string }[] = [
    { id: 'gaussian', label: 'Gaussian', desc: 'Smooth, natural blur', color: 'blue', emoji: '🌫️' },
    { id: 'pixelate', label: 'Pixelate', desc: 'Blocky, mosaic effect', color: 'green', emoji: '🟦' },
    { id: 'black',    label: 'Black Box', desc: 'Solid black redaction', color: 'slate', emoji: '⬛' },
    { id: 'sticker',  label: 'Custom Sticker', desc: stickerImage ? 'Using your uploaded sticker' : 'No sticker set (uses last selection)', color: 'purple', emoji: '🎨' },
  ];

  const handleCopy = () => {
    if (cloudinaryUrl) {
      navigator.clipboard.writeText(cloudinaryUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const colorMap: Record<string, string> = {
    blue:   'border-blue-500 bg-blue-50 shadow-blue-100',
    green:  'border-green-500 bg-green-50 shadow-green-100',
    slate:  'border-slate-700 bg-slate-50 shadow-slate-100',
    purple: 'border-purple-500 bg-purple-50 shadow-purple-100',
  };
  const dotMap: Record<string, string> = {
    blue: 'bg-blue-500', green: 'bg-green-500', slate: 'bg-slate-700', purple: 'bg-purple-500',
  };

  return (
    <div className="glass-panel max-w-3xl mx-auto overflow-hidden fade-slide-in">

      {/* Header */}
      <div className="p-8 pb-6 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-black text-slate-800 mb-1">
              {isImage ? 'Export Image' : 'Export Video'}
            </h3>
            <p className="text-slate-400 text-sm font-medium">
              Configure your final export settings below.
            </p>
          </div>
          {/* Summary badge */}
          {summary && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2.5 text-right">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Session</p>
                <p className="text-xs text-slate-500 font-medium">
                  {summary.personsBlurred}/{summary.totalPersons} blurred · {summary.blurMode}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Left: Blur Engine */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Box className="w-3.5 h-3.5" /> Blur Engine
          </label>
          <div className="space-y-2">
            {blurTypes.map(type => {
              const active = blurType === type.id;
              return (
                <label
                  key={type.id}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all duration-200 shadow-sm ${
                    active ? colorMap[type.color] : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportBlurType"
                    checked={active}
                    onChange={() => handleBlurTypeChange(type.id)}
                    className="hidden"
                  />
                  {/* Custom radio dot */}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    active ? `${dotMap[type.color]} border-transparent` : 'border-slate-300'
                  }`}>
                    {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-lg leading-none">{type.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <span className={`block font-black text-sm ${active ? 'text-slate-800' : 'text-slate-600'}`}>
                      {type.label}
                    </span>
                    <span className="block text-[10px] font-medium text-slate-400 truncate">{type.desc}</span>
                  </div>
                  {/* Sticker thumbnail if active */}
                  {type.id === 'sticker' && active && stickerImage && (
                    <img
                      src={`data:image/png;base64,${stickerImage}`}
                      className="w-8 h-8 object-contain rounded-lg shrink-0"
                      alt="Sticker"
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Right: Settings + Actions */}
        <div className="space-y-6 flex flex-col">

          {/* Intensity slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5" /> Intensity
              </label>
              <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                blurType === 'black' || blurType === 'sticker'
                  ? 'bg-slate-100 text-slate-300'
                  : 'bg-blue-50 text-blue-600'
              }`}>
                {blurType === 'black' || blurType === 'sticker' ? 'N/A' : `${strength}px`}
              </span>
            </div>
            <input
              type="range"
              min="3" max="151" step="2"
              value={strength}
              onChange={e => handleStrengthChange(parseInt(e.target.value))}
              disabled={blurType === 'black' || blurType === 'sticker'}
              className="w-full accent-blue-500 disabled:opacity-30"
            />
            <div className="flex justify-between text-[9px] font-bold text-slate-300 uppercase tracking-widest">
              <span>Subtle</span>
              <span>Maximum</span>
            </div>
          </div>

          {/* File type note */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <ImageIcon className="w-4 h-4 text-slate-300 shrink-0" />
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Output Format</p>
              <p className="text-xs font-medium text-slate-500">
                {isImage ? 'JPG / PNG (original format)' : 'MP4 (H.264) · Audio preserved'}
              </p>
            </div>
          </div>

          {/* Action area */}
          <div className="mt-auto space-y-3">
            {downloadUrl ? (
              <div className="space-y-3 fade-slide-in">
                {/* Success banner */}
                <div className="p-3.5 bg-green-50 border-2 border-green-300 rounded-2xl flex items-center justify-center gap-2 text-green-700 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Export Complete!
                </div>

                {/* Download */}
                <a
                  href={downloadUrl}
                  download={isImage ? 'BlurSystem_Image.jpg' : 'BlurSystem_Video.mp4'}
                  onClick={handleDirectDownload}
                  className="flex items-center justify-center gap-3 w-full py-4 bg-slate-900 text-white font-black text-base rounded-2xl shadow-lg hover:-translate-y-0.5 transition-transform"
                >
                  {isDownloading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Downloading...</>
                  ) : (
                    <><Download className="w-5 h-5" /> {isImage ? 'Download Image' : 'Download Video'}</>
                  )}
                </a>

                {/* Cloudinary link */}
                {cloudinaryUrl && (
                  <div className="flex gap-2">
                    <a
                      href={cloudinaryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-slate-600 font-bold text-sm rounded-2xl border-2 border-slate-200 hover:border-blue-400 transition-colors"
                    >
                      <Cloud className="w-4 h-4" /> View on Cloudinary
                    </a>
                    <button
                      onClick={handleCopy}
                      title="Copy link"
                      className="px-4 py-3 bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-400 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                )}

                {/* Start over */}
                {onStartOver && (
                  <button
                    onClick={onStartOver}
                    className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 text-xs font-bold hover:text-slate-600 transition-colors"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> Start over with a new file
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => onExport(blurType, strength)}
                disabled={isExporting}
                className="flex items-center justify-center gap-3 w-full py-5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-blue-500/25 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
                ) : (
                  <><PlaySquare className="w-5 h-5" /> {isImage ? 'Generate Image' : 'Generate & Export'}</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
