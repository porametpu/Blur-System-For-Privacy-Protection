"use client";

import React from 'react';
import { Scan } from 'lucide-react';

interface DetectionProgressProps {
  progress: number;
  statusText: string;
}

export default function DetectionProgress({ progress, statusText }: DetectionProgressProps) {
  return (
    <div className="glass-panel p-10 max-w-2xl mx-auto w-full flex flex-col items-center gap-8 fade-slide-in">
      
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Scanning circle animation */}
        <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800" />
        <div 
          className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" 
          style={{ animationDuration: '2s' }}
        />
        <div className="absolute inset-0 rounded-full border-4 border-cyan-400 border-b-transparent animate-spin" 
          style={{ animationDuration: '3s', animationDirection: 'reverse', opacity: 0.5 }}
        />
        
        <div className="absolute inset-0 flex items-center justify-center text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          <Scan className="w-12 h-12" />
        </div>
      </div>

      <div className="w-full space-y-4">
        <div className="flex justify-between items-end px-2">
          <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">{statusText}</span>
          <span className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{progress}%</span>
        </div>
        
        <div className="w-full h-4 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 rounded-full transition-all duration-300 ease-out shimmer"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 text-center max-w-sm">
        Our AI is scanning keyframes to detect faces, extract identities, and track them across the entire video.
      </p>
    </div>
  );
}
