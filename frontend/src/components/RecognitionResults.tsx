"use client";

import React, { useState, useMemo } from 'react';
import { DetectedPerson } from '../lib/types';
import { History, ShieldAlert, Search, CheckSquare, Square, Users } from 'lucide-react';

interface RecognitionResultsProps {
  persons: DetectedPerson[];
  onViewTimeline: (person: DetectedPerson) => void;
  selections?: Map<number, boolean>;
  onToggleSelection?: (id: number) => void;
}

export default function RecognitionResults({ persons, onViewTimeline, selections, onToggleSelection }: RecognitionResultsProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() =>
    query.trim() === ''
      ? persons
      : persons.filter(p => p.label.toLowerCase().includes(query.toLowerCase())),
    [persons, query]
  );

  const selectedCount = useMemo(() =>
    persons.filter(p => selections?.get(p.id)).length,
    [persons, selections]
  );

  const handleSelectAll = () => {
    if (!onToggleSelection) return;
    const allSelected = filtered.every(p => selections?.get(p.id));
    filtered.forEach(p => {
      const cur = selections?.get(p.id) ?? false;
      if (allSelected ? cur : !cur) onToggleSelection(p.id);
    });
  };

  if (persons.length === 0) {
    return (
      <div className="text-center p-10 flex flex-col items-center gap-3">
        <ShieldAlert className="w-12 h-12 text-slate-300" />
        <p className="text-slate-500 font-medium">No identities found. Try scanning more frames.</p>
      </div>
    );
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selections?.get(p.id));

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search person..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-100 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 placeholder-slate-400"
          />
        </div>

        {/* Bulk select toggle */}
        <button
          onClick={handleSelectAll}
          title={allFilteredSelected ? 'Deselect all' : 'Select all'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors whitespace-nowrap"
        >
          {allFilteredSelected
            ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
            : <Square className="w-3.5 h-3.5" />
          }
          {allFilteredSelected ? 'None' : 'All'}
        </button>
      </div>

      {/* Counter */}
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <Users className="w-3 h-3" />
        <span>{selectedCount} / {persons.length} selected</span>
        {query && <span className="ml-auto text-slate-300 normal-case font-medium">{filtered.length} shown</span>}
      </div>

      {/* Grid */}
      <div className="overflow-y-auto pr-1" style={{ maxHeight: '320px' }}>
        {filtered.length === 0 ? (
          <p className="text-center text-slate-400 text-xs py-6">No match for "{query}"</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((person, idx) => {
              const isSelected = selections?.get(person.id) ?? false;
              return (
                <div
                  key={person.id}
                  onClick={() => onToggleSelection?.(person.id)}
                  className={`
                    relative rounded-2xl p-3 flex flex-col items-center gap-1.5 cursor-pointer
                    border-2 transition-all duration-200 hover:-translate-y-0.5
                    fade-slide-in
                    ${isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/20'
                      : 'border-transparent bg-white hover:border-slate-200 shadow-sm'}
                  `}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  {/* Selection badge */}
                  <div className={`absolute top-2 right-2 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all
                    ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>

                  {/* Avatar */}
                  <div className={`w-14 h-14 rounded-full overflow-hidden border-2 shadow-sm
                    ${isSelected ? 'border-blue-500' : 'border-slate-200'}`}>
                    {person.representative_thumbnail ? (
                      <img
                        src={`data:image/jpeg;base64,${person.representative_thumbnail}`}
                        alt={person.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-400">?</div>
                    )}
                  </div>

                  {/* Name */}
                  <span className={`text-[11px] font-black tracking-tight text-center leading-tight
                    ${isSelected ? 'text-blue-600' : 'text-slate-800'}`}>
                    {person.label}
                  </span>

                  {/* Stats row */}
                  <div className="w-full space-y-1">
                    <div className="flex justify-between text-[9px] text-slate-400 font-semibold">
                      <span>{person.appearance_count}×</span>
                      <span>{Math.round(person.avg_confidence * 100)}%</span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full transition-all"
                        style={{ width: `${person.avg_confidence * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Timeline button */}
                  <button
                    onClick={e => { e.stopPropagation(); onViewTimeline(person); }}
                    title="View Timeline"
                    className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110
                      ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                  >
                    <History className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
