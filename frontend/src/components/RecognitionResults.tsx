"use client";

import React from 'react';
import { DetectedPerson } from '../lib/types';
import { History, ShieldAlert } from 'lucide-react';

interface RecognitionResultsProps {
  persons: DetectedPerson[];
  onViewTimeline: (person: DetectedPerson) => void;
  selections?: Map<number, boolean>;
  onToggleSelection?: (id: number) => void;
}

export default function RecognitionResults({ persons, onViewTimeline, selections, onToggleSelection }: RecognitionResultsProps) {
  if (persons.length === 0) {
    return (
      <div className="text-center p-10 glass-panel max-w-2xl mx-auto">
        <ShieldAlert className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">No identities found</h3>
        <p className="text-slate-500 mt-2">Try selecting more keyframes or a different video.</p>
      </div>
    );
  }

  return (
    <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar snap-x">
      {persons.map((person, idx) => {
        const isSelected = selections ? selections.get(person.id) : false;
        
        return (
          <div 
            key={person.id} 
            onClick={() => onToggleSelection && onToggleSelection(person.id)}
            className={`snap-start min-w-[130px] max-w-[130px] rounded-[3rem] flex flex-col items-center bg-white shadow-sm hover:-translate-y-1 transition-all duration-300 cursor-pointer border-4 ${isSelected ? 'border-blue-500 shadow-blue-500/30 shadow-lg' : 'border-transparent hover:border-slate-200'} fade-slide-in`} 
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {/* Top part */}
            <div className="p-4 flex flex-col items-center w-full">
              <div className={`relative w-20 h-20 rounded-full overflow-hidden border-2 shadow-sm mb-3 ${isSelected ? 'border-blue-500' : 'border-white'}`}>
                {person.representative_thumbnail ? (
                  <img 
                    src={`data:image/jpeg;base64,${person.representative_thumbnail}`} 
                    alt={person.label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs">
                    No img
                  </div>
                )}
              </div>
              <h3 className={`text-sm font-black tracking-tight text-center ${isSelected ? 'text-blue-600' : 'text-slate-800'}`}>{person.label}</h3>
            </div>
            
            {/* Bottom part (Stats) */}
            <div className={`w-full flex-1 rounded-b-[2.5rem] p-4 flex flex-col items-center space-y-4 ${isSelected ? 'bg-blue-50' : 'bg-slate-100'}`}>
              
              <div className="w-full text-center space-y-1">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Appearances</span>
                <span className="block text-xs font-bold text-slate-700">{person.appearance_count}</span>
              </div>
              
              <div className="w-full space-y-1">
                <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Avg Conf</span>
                  <span>{Math.round(person.avg_confidence * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${person.avg_confidence * 100}%` }}
                  />
                </div>
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onViewTimeline(person);
                }}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-md ${isSelected ? 'bg-blue-600 text-white shadow-blue-500/40' : 'bg-slate-800 text-white'}`}
                title="View Timeline"
              >
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
