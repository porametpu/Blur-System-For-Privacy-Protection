"use client";

import React from 'react';
import { Upload, Eye, Grid3X3, Scan, Users, Shield, Play, Download, Check } from 'lucide-react';
import { AppStep } from '../lib/types';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const STEPS = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'keyframes', label: 'Keyframes', icon: Grid3X3 },
  { id: 'detecting', label: 'Detection', icon: Scan },
  { id: 'results', label: 'Results', icon: Users },
  { id: 'blur_manager', label: 'Blur', icon: Shield },
  { id: 'preview_blur', label: 'Preview', icon: Play },
  { id: 'export', label: 'Export', icon: Download },
];

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="w-full max-w-5xl mx-auto mb-10 overflow-x-auto pb-4 custom-scrollbar">
      <div className="flex items-center min-w-max px-4">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.id}>
              {/* Step Node */}
              <div className="flex flex-col items-center gap-2 relative z-10 w-20">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shadow-md ${
                    isCurrent 
                      ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 text-white scale-110 shadow-blue-500/30' 
                      : isCompleted 
                        ? 'bg-green-500 text-white shadow-green-500/20' 
                        : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider text-center ${
                  isCurrent ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'
                }`}>
                  {step.label}
                </span>
              </div>

              {/* Connecting Line */}
              {index < STEPS.length - 1 && (
                <div className="flex-1 h-1 mx-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shrink-0 min-w-[30px]">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-700 ease-out"
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
