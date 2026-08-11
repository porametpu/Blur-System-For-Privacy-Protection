"use client";

import React from 'react';
import { PreviewFrame } from '../lib/types';
import { CheckCircle2, CheckSquare, Square } from 'lucide-react';

interface KeyframeSelectorProps {
  frames: PreviewFrame[];
  selectedFrames: Set<number>;
  onSelectionChange: (selected: Set<number>) => void;
}

export default function KeyframeSelector({ frames, selectedFrames, onSelectionChange }: KeyframeSelectorProps) {
  const toggleSelection = (frameNum: number) => {
    const newSet = new Set(selectedFrames);
    if (newSet.has(frameNum)) {
      newSet.delete(frameNum);
    } else {
      newSet.add(frameNum);
    }
    onSelectionChange(newSet);
  };

  const selectAll = () => onSelectionChange(new Set(frames.map(f => f.frame_number)));
  const deselectAll = () => onSelectionChange(new Set());

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl backdrop-blur-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Selected: <span className="text-blue-600 dark:text-blue-400 font-black text-lg">{selectedFrames.size}</span> / {frames.length}
          </span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={selectAll}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 transition-colors"
          >
            <CheckSquare className="w-4 h-4 text-blue-500" /> Select All
          </button>
          <button 
            onClick={deselectAll}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 transition-colors"
          >
            <Square className="w-4 h-4 text-slate-400" /> Clear
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 pt-2 custom-scrollbar px-2">
        {frames.map((frame) => {
          const isSelected = selectedFrames.has(frame.frame_number);
          
          return (
            <button
              key={frame.frame_number}
              onClick={() => toggleSelection(frame.frame_number)}
              className={`relative shrink-0 w-48 aspect-video rounded-2xl overflow-hidden border-4 transition-all duration-300 transform outline-none group
                ${isSelected 
                  ? 'border-blue-500 shadow-lg shadow-blue-500/30 scale-[1.02] -translate-y-1' 
                  : 'border-transparent opacity-70 hover:opacity-100 hover:scale-[1.01] bg-slate-900'}
              `}
            >
              <img 
                src={frame.thumbnail_url} 
                alt={`F${frame.frame_number}`}
                loading="lazy"
                className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`}
              />
              <div className={`absolute inset-0 transition-colors duration-300 ${isSelected ? 'bg-blue-500/20' : 'group-hover:bg-black/20'}`} />
              
              {isSelected && (
                <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1 shadow-lg transform scale-in-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8 flex justify-between items-end">
                <span className="text-white font-black text-xs uppercase tracking-wider">F{frame.frame_number}</span>
                <span className="text-slate-300 font-medium text-[10px]">{formatTime(frame.timestamp_ms)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
