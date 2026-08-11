"use client";

import React from 'react';
import { DetectedPerson, BlurSelection } from '../lib/types';
import { Shield, ShieldOff, CheckCircle2 } from 'lucide-react';

interface BlurManagerProps {
  persons: DetectedPerson[];
  selections: Map<number, boolean>;
  onSelectionChange: (newSelections: Map<number, boolean>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export default function BlurManager({ persons, selections, onSelectionChange, onSave, isSaving }: BlurManagerProps) {
  
  const togglePerson = (id: number) => {
    const newSels = new Map(selections);
    newSels.set(id, !newSels.get(id));
    onSelectionChange(newSels);
  };

  const setAll = (value: boolean) => {
    const newSels = new Map();
    persons.forEach(p => newSels.set(p.id, value));
    onSelectionChange(newSels);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 fade-slide-in">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">Identity Protection List</h3>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setAll(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
          >
            <Shield className="w-4 h-4" /> Blur All
          </button>
          <button 
            onClick={() => setAll(false)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 px-5 py-2.5 rounded-xl transition-colors"
          >
            <ShieldOff className="w-4 h-4" /> Unblur All
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50">
        {persons.map((person) => {
          const isBlurred = selections.get(person.id) ?? true;
          
          return (
            <div key={person.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-5">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 shrink-0">
                  {person.representative_thumbnail ? (
                    <img 
                      src={`data:image/jpeg;base64,${person.representative_thumbnail}`} 
                      alt={person.label}
                      className={`w-full h-full object-cover transition-all duration-500 ${isBlurred ? 'blur-md scale-110 brightness-75' : ''}`}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-200 dark:bg-slate-700" />
                  )}
                  {isBlurred && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Shield className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">{person.label}</h4>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{person.appearance_count} frames</p>
                </div>
              </div>
              
              <button 
                onClick={() => togglePerson(person.id)}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${isBlurred ? 'bg-blue-600 shadow-lg shadow-blue-500/30' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <span className="sr-only">Toggle blur</span>
                <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${isBlurred ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4">
        <button 
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-blue-500/20 hover:-translate-y-1 transition-all active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <span className="animate-pulse">Saving...</span>
          ) : (
            <>Save & Preview <CheckCircle2 className="w-5 h-5" /></>
          )}
        </button>
      </div>
    </div>
  );
}
