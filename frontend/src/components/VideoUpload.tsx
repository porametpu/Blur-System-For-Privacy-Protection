"use client";

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';

interface VideoUploadProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export default function VideoUpload({ onUpload, isLoading }: VideoUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
      'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  return (
    <div className="flex justify-center fade-slide-in mt-12">
      <div 
        {...getRootProps()}
        className={`w-full max-w-2xl bg-white rounded-[2rem] shadow-[0_15px_50px_-15px_rgba(0,0,0,0.05)] border-2 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-16 ${
          isDragActive ? 'border-[#1a73e8] bg-blue-50/50' : 'border-transparent hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)]'
        } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} />
        
        {/* Icon Circle */}
        <div className="w-20 h-20 rounded-full border border-slate-200 flex items-center justify-center mb-6 shadow-sm">
          {isLoading ? (
            <div className="w-8 h-8 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin" />
          ) : (
            <CloudUpload className="w-10 h-10 text-slate-400" />
          )}
        </div>

        <h3 className="text-2xl font-black text-slate-800 mb-2">
          {isDragActive ? "Drop video here!" : "Drag & Drop your media"}
        </h3>
        
        <p className="text-sm font-medium text-slate-500 mb-8 max-w-sm text-center leading-relaxed">
          Upload images or videos to automatically detect and blur sensitive information.
        </p>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white shadow-sm">
            <ImageIcon className="w-4 h-4 text-[#1a73e8]" />
            <span className="text-xs font-bold text-slate-600">Images up to 20MB</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white shadow-sm">
            <VideoIcon className="w-4 h-4 text-[#e11d48]" />
            <span className="text-xs font-bold text-slate-600">Videos up to 100MB</span>
          </div>
        </div>

      </div>
    </div>
  );
}
