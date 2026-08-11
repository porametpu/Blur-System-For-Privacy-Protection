"use client";

import React, { useEffect } from 'react';
import { DetectedPerson, TimelineEntry } from '../lib/types';
import { X, Clock, Video } from 'lucide-react';

interface TimelineProps {
  person: DetectedPerson | null;
  entries: TimelineEntry[];
  isOpen: boolean;
  onClose: () => void;
}

export default function Timeline({ person, entries, isOpen, onClose }: TimelineProps) {
  if (!isOpen || !person) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-slide-in">
      <div className="glass-panel w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] shadow-2xl relative animate-scale-in">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700">
              {person.representative_thumbnail ? (
                <img 
                  src={`data:image/jpeg;base64,${person.representative_thumbnail}`} 
                  alt={person.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-200 dark:bg-slate-700" />
              )}
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-800 dark:text-slate-100">{person.label}</h3>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Video className="w-3 h-3" /> {entries.length} appearances
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* List */}
        <div className="overflow-y-auto p-4 custom-scrollbar flex-1 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="relative border-l-2 border-blue-200 dark:border-blue-900/50 ml-6 space-y-6 py-4">
            {entries.length === 0 ? (
              <div className="text-center text-slate-500 py-10">No timeline data available.</div>
            ) : (
              entries.map((entry, idx) => (
                <div key={idx} className="relative flex items-center group">
                  <div className="absolute -left-[29px] w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 bg-blue-500 group-hover:scale-125 transition-transform" />
                  <div className="ml-6 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm w-full flex justify-between items-center group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" /> {entry.timestamp_formatted}
                    </span>
                    <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md">
                      Frame {entry.frame_number}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
