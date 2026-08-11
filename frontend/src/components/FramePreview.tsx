"use client";

import React from 'react';
import { PreviewFrame } from '../lib/types';

interface FramePreviewProps {
  frames: PreviewFrame[];
}

export default function FramePreview({ frames }: FramePreviewProps) {
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {frames.map((frame) => (
        <div key={frame.frame_number} className="group relative rounded-2xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all shadow-sm hover:shadow-xl hover:-translate-y-1 bg-slate-900 aspect-video">
          <img 
            src={frame.thumbnail_url} 
            alt={`Frame ${frame.frame_number}`} 
            loading="lazy"
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="absolute bottom-2 left-2 flex gap-2">
            <span className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-black uppercase px-2 py-1 rounded-md">
              F{frame.frame_number}
            </span>
          </div>
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md shadow-lg">
              {formatTime(frame.timestamp_ms)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
