"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ManualBlurBox, PreviewFrame, BlurType } from '../lib/types';
import { Trash2, ArrowLeft, Grid, Square, Circle } from 'lucide-react';
import { saveManualBlurBoxes } from '../lib/api';

interface ImageManualRedactionProps {
  videoId: number;
  previewFrames: PreviewFrame[];
  onSave: (type: BlurType, strength: number) => void;
  onCancel: () => void;
}

export default function ImageManualRedaction({ videoId, previewFrames, onSave, onCancel }: ImageManualRedactionProps) {
  const [boxes, setBoxes] = useState<ManualBlurBox[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Settings state
  const [blurType, setBlurType] = useState<BlurType>('gaussian');
  const [blurStrength, setBlurStrength] = useState<number>(50);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<Partial<ManualBlurBox> | null>(null);
  
  const preview = previewFrames[0];
  const [imageScale, setImageScale] = useState({ x: 1, y: 1 });

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
    if ((e.target as HTMLElement).closest('.zone-box')) return;
    
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
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && currentBox) {
      if ((currentBox.width || 0) > 10 && (currentBox.height || 0) > 10) {
        setBoxes([...boxes, { ...currentBox, id: Date.now(), is_tracking: false } as ManualBlurBox]);
      }
    }
    setIsDrawing(false);
    setCurrentBox(null);
  };

  const deleteBox = (id: number) => {
    setBoxes(boxes.filter(b => b.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const scaledBoxes = boxes.map(b => ({
        start_frame_number: b.start_frame_number,
        x: Math.round(b.x * imageScale.x),
        y: Math.round(b.y * imageScale.y),
        width: Math.round(b.width * imageScale.x),
        height: Math.round(b.height * imageScale.y),
        is_tracking: false,
      }));
      
      await saveManualBlurBoxes(videoId, scaledBoxes);
      onSave(blurType, blurStrength);
    } catch (err) {
      console.error(err);
      alert('Failed to save manual boxes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fade-slide-in min-h-[80vh] flex flex-col bg-slate-50 p-4 md:p-8 rounded-[2rem]">
      {/* Top Navigation */}
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={onCancel} 
          className="flex items-center gap-2 bg-white text-slate-700 font-bold px-6 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all border border-slate-200"
        >
          <ArrowLeft className="w-5 h-5" /> Go Back
        </button>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-white px-5 py-2 rounded-full font-bold text-xs tracking-wider text-green-500 border border-slate-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            READY
          </div>
          <div className="bg-white px-5 py-2 rounded-full font-bold text-xs tracking-wider text-blue-600 border border-slate-200 shadow-sm">
            MANUAL
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        
        {/* Left Canvas Panel */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden relative">
          {preview ? (
            <div 
              ref={containerRef}
              className="relative cursor-crosshair touch-none rounded-xl overflow-hidden shadow-lg"
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
                className="max-w-full max-h-[70vh] object-contain pointer-events-none rounded-xl" 
                draggable={false}
              />

              {/* Existing Zones */}
              {boxes.map((box, index) => (
                <div
                  key={box.id}
                  className="zone-box absolute border-[3px] border-indigo-500 bg-indigo-500/20 group hover:bg-indigo-500/30 transition-colors"
                  style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
                >
                  <div className="absolute -top-7 left-[-3px] bg-indigo-600 text-white text-[10px] font-black tracking-wider px-3 py-1 rounded-full shadow-md z-10 whitespace-nowrap">
                    ZONE_{index + 1}
                  </div>
                  
                  {/* Delete Button (Optional on canvas, since it's in sidebar too) */}
                  <button 
                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-md"
                    onClick={(e) => { e.stopPropagation(); deleteBox(box.id!); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Drawing Box */}
              {isDrawing && currentBox && (
                <div 
                  className="absolute border-[3px] border-indigo-400 bg-indigo-400/20"
                  style={{ left: currentBox.x, top: currentBox.y, width: currentBox.width, height: currentBox.height }}
                />
              )}
            </div>
          ) : (
            <div className="text-slate-400 font-bold">Loading...</div>
          )}
        </div>

        {/* Right Sidebar Panel */}
        <div className="lg:col-span-4 flex flex-col h-full">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">Manual Redaction</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Surgical precision for documents.</p>
          </div>

          <div className="flex-1 space-y-8 overflow-y-auto pr-2 pb-20">
            {/* Zones List */}
            <div className="space-y-3">
              {boxes.length === 0 && (
                <div className="text-slate-400 text-sm italic py-4">No zones drawn yet. Draw on the image to create a zone.</div>
              )}
              {boxes.map((box, index) => (
                <div key={box.id} className="flex items-center justify-between bg-white border border-slate-200 px-5 py-4 rounded-2xl shadow-sm">
                  <span className="font-black text-slate-800 text-sm tracking-widest">ZONE {index + 1}</span>
                  <button onClick={() => deleteBox(box.id!)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Engine Preset */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">ENGINE_PRESET</p>
              <div className="space-y-3">
                {/* Gaussian */}
                <label className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${blurType === 'gaussian' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 shadow-sm'}`}>
                  <input type="radio" name="preset" className="hidden" checked={blurType === 'gaussian'} onChange={() => setBlurType('gaussian')} />
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${blurType === 'gaussian' ? 'border-white bg-blue-600' : 'border-slate-300 bg-white'}`}>
                    {blurType === 'gaussian' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                  </div>
                  <Circle className={`w-5 h-5 ${blurType === 'gaussian' ? 'text-blue-200' : 'text-blue-500'}`} fill={blurType !== 'gaussian' ? "currentColor" : "none"} />
                  <span className="font-black tracking-wide text-sm">GAUSSIAN BLUR</span>
                </label>

                {/* Pixelate */}
                <label className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${blurType === 'pixelate' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 shadow-sm'}`}>
                  <input type="radio" name="preset" className="hidden" checked={blurType === 'pixelate'} onChange={() => setBlurType('pixelate')} />
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${blurType === 'pixelate' ? 'border-white bg-blue-600' : 'border-slate-300 bg-white'}`}>
                    {blurType === 'pixelate' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                  </div>
                  <Grid className={`w-5 h-5 ${blurType === 'pixelate' ? 'text-green-300' : 'text-green-500'}`} />
                  <span className="font-black tracking-wide text-sm">PIXELATE</span>
                </label>

                {/* Black Box */}
                <label className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${blurType === 'black' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 shadow-sm'}`}>
                  <input type="radio" name="preset" className="hidden" checked={blurType === 'black'} onChange={() => setBlurType('black')} />
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${blurType === 'black' ? 'border-white bg-blue-600' : 'border-slate-300 bg-white'}`}>
                    {blurType === 'black' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                  </div>
                  <Square className={`w-5 h-5 ${blurType === 'black' ? 'text-slate-300' : 'text-slate-900'}`} fill="currentColor" />
                  <span className="font-black tracking-wide text-sm">BLACK BOX</span>
                </label>
              </div>
            </div>

            {/* Blur Intensity */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">BLUR INTENSITY</p>
                <div className="bg-blue-50 text-blue-600 font-bold text-xs px-3 py-1 rounded-full">{blurStrength}px</div>
              </div>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={blurStrength} 
                onChange={(e) => setBlurStrength(parseInt(e.target.value))}
                className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between mt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <span>SUBTLE</span>
                <span>ABSOLUTE</span>
              </div>
            </div>
            
            {/* Absolute bottom actions could go here, or we just put Save button */}
            <div className="pt-4">
               <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-4 rounded-2xl transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50 text-lg"
                >
                  {isSaving ? 'Processing...' : 'APPLY REDACTION'}
               </button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
