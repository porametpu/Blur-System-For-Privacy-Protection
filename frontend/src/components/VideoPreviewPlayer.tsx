"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Maximize, RotateCcw } from 'lucide-react';

interface VideoPreviewPlayerProps {
  src: string;
  isLoading?: boolean;
}

export default function VideoPreviewPlayer({ src, isLoading = false }: VideoPreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [duration, setDuration] = useState('00:00');

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (videoRef.current && src) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => setIsPlaying(true))
              .catch(error => {
                console.error("Video playback failed:", error);
                setIsPlaying(false);
              });
          } else {
            setIsPlaying(true);
          }
        } catch (error) {
          console.error("Video play threw sync error:", error);
          setIsPlaying(false);
        }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100);
      setCurrentTime(formatTime(current));
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(formatTime(videoRef.current.duration));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = (val / 100) * videoRef.current.duration;
      setProgress(val);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };
  
  const handleEnded = () => setIsPlaying(false);

  return (
    <div className="relative rounded-3xl overflow-hidden bg-black border-4 border-slate-800 aspect-video shadow-2xl group w-full max-w-4xl mx-auto fade-slide-in">
      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <span className="text-white font-bold tracking-widest uppercase text-sm">Rendering Preview...</span>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onClick={togglePlay}
          />
          
          {/* Controls Overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex flex-col gap-2">
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={progress || 0}
                onChange={handleSeek}
                className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
              />
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                  <button onClick={togglePlay} className="hover:text-blue-400 transition-colors">
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                  </button>
                  <button onClick={() => { 
                    if(videoRef.current && src) { 
                      videoRef.current.currentTime = 0; 
                      try {
                        const p = videoRef.current.play(); 
                        if(p !== undefined) {
                          p.then(() => setIsPlaying(true)).catch(e => console.error(e));
                        } else {
                          setIsPlaying(true);
                        }
                      } catch(e) {
                        console.error(e);
                        setIsPlaying(false);
                      }
                    } 
                  }} className="hover:text-blue-400 transition-colors">
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-bold font-mono tracking-wider">{currentTime} / {duration}</span>
                </div>
                <button onClick={toggleFullscreen} className="hover:text-blue-400 transition-colors">
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Big Play Button Center */}
          {!isPlaying && !isLoading && (
            <button 
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-20 h-20 bg-blue-600/80 hover:bg-blue-600 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-900/50 transition-transform hover:scale-110"
            >
              <Play className="w-10 h-10 fill-current ml-2" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
