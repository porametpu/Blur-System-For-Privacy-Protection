"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ManualBlurBox, PreviewFrame, EnginePreset, Video } from '../lib/types';
import { Trash2, Shield, Save, ArrowLeft, Layers, Square, Clock, Sparkles, Loader2 } from 'lucide-react';
import { saveManualBlurBoxes } from '../lib/api';

// ─── Engine Preset Config ─────────────────────────────────────────────────────
interface EngineOption {
  id: EnginePreset;
  label: string;
  description: string;
  icon: string;
  activeBg: string;
  trackColor: string;   // used in timeline strip
  previewStyle: React.CSSProperties;
}

const ENGINE_OPTIONS: EngineOption[] = [
  {
    id: 'gaussian',
    label: 'Gaussian Blur',
    description: 'Smooth, natural blur',
    icon: '◎',
    activeBg: 'bg-blue-600',
    trackColor: '#3b82f6',
    previewStyle: {
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
    },
  },
  {
    id: 'pixelate',
    label: 'Pixelate',
    description: 'Mosaic / pixel effect',
    icon: '⊞',
    activeBg: 'bg-purple-600',
    trackColor: '#9333ea',
    previewStyle: {
      backdropFilter: 'blur(6px) contrast(160%)',
      WebkitBackdropFilter: 'blur(6px) contrast(160%)',
      backgroundColor: 'rgba(147, 51, 234, 0.15)',
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 5px, transparent 5px, transparent 10px), repeating-linear-gradient(90deg, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 5px, transparent 5px, transparent 10px)',
    },
  },
  {
    id: 'black',
    label: 'Black Bar',
    description: 'Solid black redaction',
    icon: '▪',
    activeBg: 'bg-slate-800',
    trackColor: '#1e293b',
    previewStyle: {
      backgroundColor: '#000000',
    },
  },
  {
    id: 'frosted',
    label: 'Frosted Glass',
    description: 'Frosted / milky overlay',
    icon: '❄',
    activeBg: 'bg-cyan-600',
    trackColor: '#0891b2',
    previewStyle: {
      backdropFilter: 'blur(18px) saturate(180%) brightness(1.15)',
      WebkitBackdropFilter: 'blur(18px) saturate(180%) brightness(1.15)',
      backgroundColor: 'rgba(255, 255, 255, 0.35)',
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ManualControlProps {
  videoId: number;
  videoInfo: Video | null;
  previewFrames: PreviewFrame[];
  onSave: () => void;
  onCancel: () => void;
}

// ─── Timeline Row Component ───────────────────────────────────────────────────
interface TimelineRowProps {
  box: ManualBlurBox;
  duration: number;
  fps: number;
  isSelected: boolean;
  onUpdate: (patch: Partial<ManualBlurBox>) => void;
  onSelect: () => void;
  color: string;
  label: string;
  icon: string;
  index: number;
}

function TimelineRow({ box, duration, fps, isSelected, onUpdate, onSelect, color, label, icon, index }: TimelineRowProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const totalFrames = Math.round(duration * fps);

  const startSec = box.start_frame_number / fps;
  const endSec = (box.end_frame_number != null ? box.end_frame_number : totalFrames) / fps;

  const startPct = (startSec / duration) * 100;
  const endPct = (endSec / duration) * 100;

  // Drag handle logic
  const dragging = useRef<'start' | 'end' | 'range' | null>(null);
  const dragStartX = useRef(0);
  const dragStartSec = useRef({ start: 0, end: 0 });

  const secFromClientX = (clientX: number): number => {
    if (!railRef.current) return 0;
    const rect = railRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pct * duration;
  };

  const onHandleMouseDown = (e: React.MouseEvent, handle: 'start' | 'end' | 'range') => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = handle;
    dragStartX.current = e.clientX;
    dragStartSec.current = { start: startSec, end: endSec };
    onSelect();

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const sec = secFromClientX(ev.clientX);
      const dx = ev.clientX - dragStartX.current;
      const railW = railRef.current?.getBoundingClientRect().width || 1;
      const dSec = (dx / railW) * duration;

      let newStart = dragStartSec.current.start;
      let newEnd = dragStartSec.current.end;

      if (dragging.current === 'start') {
        newStart = Math.max(0, Math.min(sec, newEnd - 0.1));
      } else if (dragging.current === 'end') {
        newEnd = Math.max(newStart + 0.1, Math.min(sec, duration));
      } else {
        // drag whole range
        const rangeLen = newEnd - newStart;
        newStart = Math.max(0, Math.min(dragStartSec.current.start + dSec, duration - rangeLen));
        newEnd = newStart + rangeLen;
      }

      onUpdate({
        start_frame_number: Math.round(newStart * fps),
        end_frame_number: Math.round(newEnd * fps),
      });
    };

    const onUp = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Click on rail to set start
  const onRailClick = (e: React.MouseEvent) => {
    if (dragging.current) return;
    onSelect();
    const sec = secFromClientX(e.clientX);
    onUpdate({ start_frame_number: Math.round(sec * fps) });
  };

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors cursor-pointer select-none ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
      onClick={onSelect}
    >
      {/* Row label */}
      <div className="w-20 flex-shrink-0 flex items-center gap-1.5 min-w-0">
        <span className="text-sm flex-shrink-0">{icon}</span>
        <span className="text-[10px] font-black text-slate-500 truncate">Box {index + 1}</span>
      </div>

      {/* Timeline rail */}
      <div
        ref={railRef}
        className="relative flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden cursor-pointer"
        onClick={onRailClick}
      >
        {/* Filled range */}
        <div
          className="absolute top-0 h-full rounded-lg opacity-80 transition-none"
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            background: color,
            cursor: 'grab',
          }}
          onMouseDown={e => onHandleMouseDown(e, 'range')}
        >
          <span className="absolute inset-0 flex items-center justify-center text-white text-[9px] font-black pointer-events-none truncate px-1">
            {fmtTime(startSec)} – {fmtTime(endSec)}
          </span>
        </div>

        {/* Start handle */}
        <div
          className="absolute top-0 h-full w-2 cursor-ew-resize z-10 flex items-center justify-center"
          style={{ left: `calc(${startPct}% - 4px)` }}
          onMouseDown={e => onHandleMouseDown(e, 'start')}
        >
          <div className="w-1.5 h-5 bg-white border border-slate-300 rounded-full shadow-sm" />
        </div>

        {/* End handle */}
        <div
          className="absolute top-0 h-full w-2 cursor-ew-resize z-10 flex items-center justify-center"
          style={{ left: `calc(${endPct}% - 4px)` }}
          onMouseDown={e => onHandleMouseDown(e, 'end')}
        >
          <div className="w-1.5 h-5 bg-white border border-slate-300 rounded-full shadow-sm" />
        </div>
      </div>

      {/* Duration label */}
      <span className="text-[10px] font-bold text-slate-400 w-10 text-right flex-shrink-0">
        {fmtTime(endSec - startSec)}
      </span>
    </div>
  );
}

// ─── Ruler Ticks ─────────────────────────────────────────────────────────────
function TimelineRuler({ duration }: { duration: number }) {
  const step = duration <= 10 ? 1 : duration <= 60 ? 5 : duration <= 300 ? 15 : 30;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) ticks.push(t);

  return (
    <div className="relative w-full h-5 flex-shrink-0 pl-[5.5rem] pr-14 select-none">
      <div className="relative w-full h-full">
        {ticks.map(t => (
          <div
            key={t}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${(t / duration) * 100}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-px h-1.5 bg-slate-300" />
            <span className="text-[8px] text-slate-400 font-bold mt-0.5">{fmtTime(t)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ManualControl({ videoId, videoInfo, previewFrames, onSave, onCancel }: ManualControlProps) {
  const [boxes, setBoxes] = useState<ManualBlurBox[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [defaultPreset, setDefaultPreset] = useState<EnginePreset>('gaussian');
  const [defaultTracking, setDefaultTracking] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<Partial<ManualBlurBox> | null>(null);

  const [dragState, setDragState] = useState<{ id: number; startX: number; startY: number; initX: number; initY: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ id: number; handle: string; startX: number; startY: number; initBox: ManualBlurBox } | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageScale, setImageScale] = useState({ x: 1, y: 1 });

  const preview = previewFrames[0];
  const duration = videoInfo?.duration_seconds ?? 0;
  const fps = videoInfo?.fps ?? 30;
  const totalFrames = videoInfo?.total_frames ?? Math.round(duration * fps);

  const updateImageScale = () => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const renderedWidth = rect.width || 1;
    const renderedHeight = rect.height || 1;

    const targetWidth = videoInfo?.width || imgRef.current.naturalWidth || 1;
    const targetHeight = videoInfo?.height || imgRef.current.naturalHeight || 1;

    setImageScale({
      x: targetWidth / renderedWidth,
      y: targetHeight / renderedHeight,
    });
  };

  useEffect(() => {
    updateImageScale();
    window.addEventListener('resize', updateImageScale);
    return () => window.removeEventListener('resize', updateImageScale);
  }, [preview, videoInfo]);

  const getRelativeCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.blur-box')) return;
    e.preventDefault();
    const coords = getRelativeCoords(e);
    setIsDrawing(true);
    setStartPos(coords);
    setSelectedId(null);
    setCurrentBox({ x: coords.x, y: coords.y, width: 0, height: 0, start_frame_number: 0, end_frame_number: totalFrames, engine_preset: defaultPreset, is_tracking: defaultTracking });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDrawing && currentBox) {
      const coords = getRelativeCoords(e);
      setCurrentBox({ ...currentBox, x: Math.min(coords.x, startPos.x), y: Math.min(coords.y, startPos.y), width: Math.abs(coords.x - startPos.x), height: Math.abs(coords.y - startPos.y) });
    } else if (dragState) {
      const coords = getRelativeCoords(e);
      setBoxes(prev => prev.map(b => b.id === dragState.id ? { ...b, x: dragState.initX + coords.x - dragState.startX, y: dragState.initY + coords.y - dragState.startY } : b));
    } else if (resizeState) {
      const coords = getRelativeCoords(e);
      const dx = coords.x - resizeState.startX;
      const dy = coords.y - resizeState.startY;
      const { id, handle, initBox } = resizeState;
      setBoxes(prev => prev.map(b => {
        if (b.id !== id) return b;
        let { x, y, width, height } = initBox;
        if (handle.includes('e')) width += dx; if (handle.includes('s')) height += dy;
        if (handle.includes('w')) { x += dx; width -= dx; } if (handle.includes('n')) { y += dy; height -= dy; }
        if (width < 20) { width = 20; if (handle.includes('w')) x = initBox.x + initBox.width - 20; }
        if (height < 20) { height = 20; if (handle.includes('n')) y = initBox.y + initBox.height - 20; }
        return { ...b, x, y, width, height };
      }));
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && currentBox && (currentBox.width || 0) > 10 && (currentBox.height || 0) > 10) {
      const newBox: ManualBlurBox = { ...currentBox, id: Date.now(), start_frame_number: 0, end_frame_number: totalFrames, engine_preset: defaultPreset, is_tracking: defaultTracking } as ManualBlurBox;
      setBoxes(prev => [...prev, newBox]);
      setSelectedId(newBox.id!);
    }
    setIsDrawing(false); setCurrentBox(null); setDragState(null); setResizeState(null);
  };

  const updateBox = (id: number, patch: Partial<ManualBlurBox>) => setBoxes(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  const deleteBox = (id: number) => { setBoxes(prev => prev.filter(b => b.id !== id)); if (selectedId === id) setSelectedId(null); };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const rect = imgRef.current?.getBoundingClientRect();
      const renderedWidth = rect?.width || 1;
      const renderedHeight = rect?.height || 1;

      const targetWidth = videoInfo?.width || imgRef.current?.naturalWidth || 1;
      const targetHeight = videoInfo?.height || imgRef.current?.naturalHeight || 1;

      const scaleX = targetWidth / renderedWidth;
      const scaleY = targetHeight / renderedHeight;

      const scaledBoxes = boxes.map(b => ({
        start_frame_number: b.start_frame_number,
        end_frame_number: b.end_frame_number ?? totalFrames,
        x: Math.round(b.x * scaleX),
        y: Math.round(b.y * scaleY),
        width: Math.round(b.width * scaleX),
        height: Math.round(b.height * scaleY),
        is_tracking: b.is_tracking ?? false,
        engine_preset: b.engine_preset ?? 'gaussian',
      }));
      await saveManualBlurBoxes(videoId, scaledBoxes);
      onSave();
    } catch (err) { console.error(err); alert('Failed to save manual boxes'); }
    finally { setIsSaving(false); }
  };

  const activeEngineOpt = ENGINE_OPTIONS.find(o => o.id === defaultPreset)!;

  return (
    <div className="fade-slide-in flex flex-col gap-4 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <button onClick={onCancel} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold px-4 py-2 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Manual Blur Control</h2>
          <p className="text-xs font-bold text-slate-400 mt-0.5">Draw boxes · Set time range · Choose effect</p>
        </div>
        <button onClick={handleSave} disabled={isSaving || boxes.length === 0}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Rendering Video…</span>
            </>
          ) : (
            <>
              <span>Render & Preview</span>
            </>
          )}
        </button>
      </div>

      {/* ── Canvas + Sidebar ───────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* Canvas */}
        <div className="flex-1 bg-slate-100 rounded-3xl p-4 md:p-6 flex items-center justify-center overflow-hidden select-none min-w-0">
          {preview ? (
            <div ref={containerRef} className="relative cursor-crosshair touch-none shadow-2xl rounded-xl overflow-hidden w-full"
              onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}>
              <img ref={imgRef} src={preview.thumbnail_url} alt="Preview frame" className="w-full h-auto pointer-events-none block" draggable={false} onLoad={updateImageScale} />

              {boxes.map(box => {
                const eng = ENGINE_OPTIONS.find(o => o.id === (box.engine_preset ?? 'gaussian'))!;
                const isSelected = selectedId === box.id;
                return (
                  <div key={box.id} className={`blur-box absolute group transition-all ${isSelected ? 'ring-2 ring-white ring-offset-1' : ''}`}
                    style={{ left: box.x, top: box.y, width: box.width, height: box.height, border: `2px solid ${isSelected ? '#6366f1' : 'rgba(99,102,241,0.6)'}`, ...eng.previewStyle }}
                    onClick={e => { e.stopPropagation(); setSelectedId(box.id!); }}>
                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none leading-tight z-10">
                      {eng.icon} {eng.label}
                    </div>
                    {duration > 0 && (
                      <div className="absolute top-1 right-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none leading-tight flex items-center gap-1 z-10">
                        <Clock className="w-2 h-2" />
                        {fmtTime(box.start_frame_number / fps)}–{fmtTime((box.end_frame_number ?? totalFrames) / fps)}
                      </div>
                    )}
                    {box.is_tracking && (
                      <div className="absolute bottom-1 left-1 bg-green-500/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none leading-tight z-10">🎯 Tracking</div>
                    )}
                    <div className="absolute inset-0 cursor-move"
                      onMouseDown={e => { e.stopPropagation(); setDragState({ id: box.id!, startX: e.clientX, startY: e.clientY, initX: box.x, initY: box.y }); }}
                      onTouchStart={e => { e.stopPropagation(); setDragState({ id: box.id!, startX: e.touches[0].clientX, startY: e.touches[0].clientY, initX: box.x, initY: box.y }); }} />
                    <button className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-md"
                      onClick={e => { e.stopPropagation(); deleteBox(box.id!); }} title="Delete box"><Trash2 className="w-3 h-3" /></button>
                    {(['nw', 'ne', 'sw', 'se'] as const).map(handle => (
                      <div key={handle} className="absolute w-3 h-3 bg-white border-2 border-indigo-500 rounded-full z-10"
                        style={{ cursor: `${handle}-resize`, top: handle.includes('n') ? -6 : 'auto', bottom: handle.includes('s') ? -6 : 'auto', left: handle.includes('w') ? -6 : 'auto', right: handle.includes('e') ? -6 : 'auto' }}
                        onMouseDown={e => { e.stopPropagation(); setResizeState({ id: box.id!, handle, startX: e.clientX, startY: e.clientY, initBox: { ...box } }); }}
                        onTouchStart={e => { e.stopPropagation(); setResizeState({ id: box.id!, handle, startX: e.touches[0].clientX, startY: e.touches[0].clientY, initBox: { ...box } }); }} />
                    ))}
                  </div>
                );
              })}

              {isDrawing && currentBox && (
                <div className="absolute border-2 border-dashed border-indigo-400 pointer-events-none"
                  style={{ left: currentBox.x, top: currentBox.y, width: currentBox.width, height: currentBox.height, ...activeEngineOpt.previewStyle }} />
              )}
            </div>
          ) : (
            <div className="w-full aspect-video flex items-center justify-center text-slate-400 font-bold">Loading preview…</div>
          )}
        </div>

        {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">

          {/* ENGINE PRESET */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Engine Preset</p>
            <div className="grid grid-cols-2 gap-2">
              {ENGINE_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setDefaultPreset(opt.id)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${defaultPreset === opt.id ? `${opt.activeBg} border-transparent text-white shadow-md` : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-300'}`}>
                  <span className="text-base">{opt.icon}</span>
                  <span className="text-[11px] font-black leading-tight">{opt.label}</span>
                  <span className={`text-[10px] font-normal leading-tight ${defaultPreset === opt.id ? 'text-white/70' : 'text-slate-400'}`}>{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* TRACK OBJECT */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Track Object</p>
            <button onClick={() => setDefaultTracking(v => !v)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 font-bold transition-all text-sm ${defaultTracking ? 'bg-green-600 border-green-500 text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${defaultTracking ? 'bg-white border-white' : 'border-slate-300 bg-white'}`}>
                {defaultTracking && <Shield className="w-3 h-3 text-green-600" />}
              </div>
              <div className="text-left">
                <div className="leading-tight">{defaultTracking ? 'Tracking ON' : 'Tracking OFF'}</div>
                <div className={`text-[10px] font-normal mt-0.5 ${defaultTracking ? 'text-white/70' : 'text-slate-400'}`}>{defaultTracking ? 'AI follows object across frames' : 'Static region for whole video'}</div>
              </div>
            </button>
            <p className="text-[10px] text-slate-400 mt-2 px-0.5">⚙ Default for new boxes. Changeable per-box below.</p>
          </div>

          {/* BOX LIST */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Boxes ({boxes.length})</p>
              {boxes.length > 0 && (
                <button onClick={() => { setBoxes([]); setSelectedId(null); }} className="text-[10px] text-red-400 hover:text-red-600 font-bold transition-colors">Clear all</button>
              )}
            </div>
            {boxes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-300">
                <Square className="w-8 h-8 mb-2" />
                <p className="text-xs font-bold text-center text-slate-400">Draw a box on the preview to get started</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-0.5">
                {boxes.map((box, idx) => {
                  const eng = ENGINE_OPTIONS.find(o => o.id === (box.engine_preset ?? 'gaussian'))!;
                  const isSelected = selectedId === box.id;
                  return (
                    <div key={box.id} onClick={() => setSelectedId(isSelected ? null : box.id!)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm flex-shrink-0">{eng.icon}</span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black text-slate-700 truncate">Box {idx + 1}</p>
                            <p className="text-[10px] text-slate-400 truncate">{eng.label} · {box.is_tracking ? '🎯 Tracking' : '📌 Static'}</p>
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteBox(box.id!); }}
                          className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0" title="Delete box"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {isSelected && (
                        <div className="mt-2 pt-2 border-t border-slate-200 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Effect for this box</p>
                          <div className="grid grid-cols-2 gap-1">
                            {ENGINE_OPTIONS.map(opt => (
                              <button key={opt.id} onClick={() => updateBox(box.id!, { engine_preset: opt.id })}
                                className={`text-[10px] font-bold py-1.5 px-2 rounded-lg border transition-all leading-tight text-left ${(box.engine_preset ?? 'gaussian') === opt.id ? `${opt.activeBg} text-white border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'}`}>
                                {opt.icon} {opt.label}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => updateBox(box.id!, { is_tracking: !box.is_tracking })}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold transition-all ${box.is_tracking ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${box.is_tracking ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
                              {box.is_tracking && <Shield className="w-2.5 h-2.5 text-white" />}
                            </div>
                            {box.is_tracking ? 'Track Object — ON' : 'Track Object — OFF'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tip */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-start gap-2">
            <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-700 font-medium leading-snug">
              Draw a box, then drag the timeline handles below to set <strong>when</strong> the blur appears.
            </p>
          </div>
        </div>
      </div>

      {/* ── Timeline Panel ─────────────────────────────────────────────────── */}
      {duration > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          {/* Panel header */}
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-slate-400" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeline</p>
            <span className="ml-auto text-[10px] font-bold text-slate-400">{fmtTime(duration)} total</span>
          </div>

          {/* Ruler */}
          <TimelineRuler duration={duration} />

          {/* Rows */}
          {boxes.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-slate-300 gap-2">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-bold text-slate-400">Draw boxes to set time ranges</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1 mt-1">
              {boxes.map((box, idx) => {
                const eng = ENGINE_OPTIONS.find(o => o.id === (box.engine_preset ?? 'gaussian'))!;
                return (
                  <TimelineRow
                    key={box.id}
                    box={box}
                    duration={duration}
                    fps={fps}
                    isSelected={selectedId === box.id}
                    onUpdate={patch => updateBox(box.id!, patch)}
                    onSelect={() => setSelectedId(box.id!)}
                    color={eng.trackColor}
                    label={eng.label}
                    icon={eng.icon}
                    index={idx}
                  />
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-3 px-1">
            💡 Drag the colored bar to move the range · Drag the white handles to resize start/end time
          </p>
        </div>
      )}
    </div>
  );
}
