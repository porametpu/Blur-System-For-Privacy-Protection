"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ManualBlurBox, PreviewFrame } from '../lib/types';
import { Trash2, Shield, Save, ArrowLeft } from 'lucide-react';
import { saveManualBlurBoxes } from '../lib/api';

interface ManualControlProps {
  videoId: number;
  previewFrames: PreviewFrame[];
  onSave: () => void;
  onCancel: () => void;
}

export default function ManualControl({ videoId, previewFrames, onSave, onCancel }: ManualControlProps) {
  const [boxes, setBoxes] = useState<ManualBlurBox[]>([]);
  const [trackObjects, setTrackObjects] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<Partial<ManualBlurBox> | null>(null);

  // Dragging state
  const [dragState, setDragState] = useState<{ id: number; startX: number; startY: number; initX: number; initY: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ id: number; handle: string; startX: number; startY: number; initBox: ManualBlurBox } | null>(null);

  const preview = previewFrames[0]; // For now, we only use the first frame

  // Handle image intrinsic dimensions vs rendered dimensions
  const [imageScale, setImageScale] = useState({ x: 1, y: 1 });
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current) {
      const updateScale = () => {
        const { naturalWidth, naturalHeight, width, height } = imgRef.current!;
        if (naturalWidth && width) {
          setImageScale({
            x: naturalWidth / width,
            y: naturalHeight / height
          });
        }
      };
      imgRef.current.onload = updateScale;
      window.addEventListener('resize', updateScale);
      updateScale();
      return () => window.removeEventListener('resize', updateScale);
    }
  }, [preview]);

  const getRelativeCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    // If clicking on a box or handle, it's handled by their own onMouseDown
    if ((e.target as HTMLElement).closest('.blur-box')) return;

    e.preventDefault();
    const coords = getRelativeCoords(e);
    setIsDrawing(true);
    setStartPos(coords);
    setCurrentBox({
      x: coords.x,
      y: coords.y,
      width: 0,
      height: 0,
      start_frame_number: preview?.frame_number || 0
    });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDrawing && currentBox) {
      const coords = getRelativeCoords(e);
      const x = Math.min(coords.x, startPos.x);
      const y = Math.min(coords.y, startPos.y);
      const width = Math.abs(coords.x - startPos.x);
      const height = Math.abs(coords.y - startPos.y);
      setCurrentBox({ ...currentBox, x, y, width, height });
    } else if (dragState) {
      const coords = getRelativeCoords(e);
      const dx = coords.x - dragState.startX;
      const dy = coords.y - dragState.startY;
      setBoxes(boxes.map(b => b.id === dragState.id ? { ...b, x: dragState.initX + dx, y: dragState.initY + dy } : b));
    } else if (resizeState) {
      const coords = getRelativeCoords(e);
      const dx = coords.x - resizeState.startX;
      const dy = coords.y - resizeState.startY;
      const { id, handle, initBox } = resizeState;

      setBoxes(boxes.map(b => {
        if (b.id !== id) return b;
        let { x, y, width, height } = initBox;

        if (handle.includes('e')) width += dx;
        if (handle.includes('s')) height += dy;
        if (handle.includes('w')) { x += dx; width -= dx; }
        if (handle.includes('n')) { y += dy; height -= dy; }

        // Prevent negative dimensions
        if (width < 20) { width = 20; if (handle.includes('w')) x = initBox.x + initBox.width - 20; }
        if (height < 20) { height = 20; if (handle.includes('n')) y = initBox.y + initBox.height - 20; }

        return { ...b, x, y, width, height };
      }));
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && currentBox) {
      if ((currentBox.width || 0) > 10 && (currentBox.height || 0) > 10) {
        setBoxes([...boxes, { ...currentBox, id: Date.now(), is_tracking: trackObjects } as ManualBlurBox]);
      }
    }
    setIsDrawing(false);
    setCurrentBox(null);
    setDragState(null);
    setResizeState(null);
  };

  const deleteBox = (id: number) => {
    setBoxes(boxes.filter(b => b.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Scale coordinates back to original video dimensions
      const scaledBoxes = boxes.map(b => ({
        start_frame_number: b.start_frame_number,
        x: Math.round(b.x * imageScale.x),
        y: Math.round(b.y * imageScale.y),
        width: Math.round(b.width * imageScale.x),
        height: Math.round(b.height * imageScale.y),
        is_tracking: trackObjects,
      }));

      await saveManualBlurBoxes(videoId, scaledBoxes);
      onSave();
    } catch (err) {
      console.error(err);
      alert('Failed to save manual boxes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fade-slide-in flex flex-col space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <button onClick={onCancel} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold px-4 py-2 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Manual Control</h2>
          <p className="text-xs font-bold text-slate-400">Draw boxes over objects to track and blur</p>
        </div>
        <div className="flex items-center space-x-4 mb-2">
          <label className="inline-flex items-center">
            <input type="checkbox" checked={trackObjects} onChange={e => setTrackObjects(e.target.checked)} className="form-checkbox h-5 w-5 text-indigo-600" />
            <span className="ml-2 text-slate-700">Track Objects</span>
          </label>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-500/30 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save & Preview</>}
        </button>
      </div>

      <div className="bg-slate-100 rounded-3xl p-4 md:p-8 flex items-center justify-center relative overflow-hidden select-none">
        {preview ? (
          <div
            ref={containerRef}
            className="relative cursor-crosshair touch-none shadow-2xl rounded-xl overflow-hidden w-full max-w-5xl mx-auto"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            <img
              ref={imgRef}
              src={preview.thumbnail_url}
              alt="Preview"
              className="w-full h-auto pointer-events-none block"
              draggable={false}
            />

            {/* Existing Boxes */}
            {boxes.map((box) => (
              <div
                key={box.id}
                className="blur-box absolute border-2 border-indigo-500 bg-indigo-500/20 group hover:bg-indigo-500/30 transition-colors"
                style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
              >
                {/* Drag Handle (Whole Box) */}
                <div
                  className="absolute inset-0 cursor-move"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({ id: box.id!, startX: e.clientX, startY: e.clientY, initX: box.x, initY: box.y });
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setDragState({ id: box.id!, startX: e.touches[0].clientX, startY: e.touches[0].clientY, initX: box.x, initY: box.y });
                  }}
                />

                {/* Delete Button */}
                <button
                  className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-md"
                  onClick={(e) => { e.stopPropagation(); deleteBox(box.id!); }}
                  title="Delete Box"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                {/* Tracking Toggle Button */}
                <button
                  className={`absolute -bottom-3 -right-3 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-md ${box.is_tracking !== false ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-500 hover:bg-slate-600'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBoxes(boxes.map(b => b.id === box.id ? { ...b, is_tracking: b.is_tracking === false ? true : false } : b));
                  }}
                  title={box.is_tracking !== false ? "Tracking: ON (Click to turn OFF)" : "Tracking: OFF (Click to turn ON)"}
                >
                  {box.is_tracking !== false ? <Shield className="w-3 h-3" /> : <Shield className="w-3 h-3 opacity-50" />}
                </button>

                {/* Tracking Status Text (Visible inside box) */}
                <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  {box.is_tracking !== false ? 'Tracking ON' : 'Static (No Track)'}
                </div>

                {/* Resize Handles */}
                {['nw', 'ne', 'sw', 'se'].map(handle => (
                  <div
                    key={handle}
                    className={`absolute w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-${handle}-resize z-10`}
                    style={{
                      top: handle.includes('n') ? -6 : 'auto',
                      bottom: handle.includes('s') ? -6 : 'auto',
                      left: handle.includes('w') ? -6 : 'auto',
                      right: handle.includes('e') ? -6 : 'auto',
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setResizeState({ id: box.id!, handle, startX: e.clientX, startY: e.clientY, initBox: box });
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      setResizeState({ id: box.id!, handle, startX: e.touches[0].clientX, startY: e.touches[0].clientY, initBox: box });
                    }}
                  />
                ))}
              </div>
            ))}

            {/* Currently Drawing Box */}
            {isDrawing && currentBox && (
              <div
                className="absolute border-2 border-indigo-400 bg-indigo-400/20"
                style={{ left: currentBox.x, top: currentBox.y, width: currentBox.width, height: currentBox.height }}
              />
            )}
          </div>
        ) : (
          <div className="w-full aspect-video flex items-center justify-center text-slate-400 font-bold">
            Loading frame...
          </div>
        )}
      </div>

      <div className="bg-indigo-50 p-4 rounded-xl text-indigo-800 text-sm font-medium border border-indigo-100 flex items-start gap-3">
        <Shield className="w-5 h-5 shrink-0 text-indigo-500" />
        <p><strong>Pro Tip:</strong> Draw a box over any object you want to blur. Our AI tracker will automatically follow that object across the rest of the video frames! You can draw multiple boxes.</p>
      </div>
    </div>
  );
}
