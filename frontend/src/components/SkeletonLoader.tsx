"use client";

import React from 'react';

export const SkeletonBox = ({ className = "" }: { className?: string }) => {
  return <div className={`shimmer rounded-xl bg-slate-200 dark:bg-slate-800 ${className}`} />;
};

export const SkeletonText = ({ className = "" }: { className?: string }) => {
  return <div className={`shimmer h-4 rounded-md bg-slate-200 dark:bg-slate-800 w-3/4 ${className}`} />;
};

export const SkeletonCard = () => {
  return (
    <div className="glass-panel p-6 w-full flex flex-col gap-4">
      <SkeletonBox className="w-16 h-16 rounded-full" />
      <div className="space-y-2">
        <SkeletonText className="w-1/2" />
        <SkeletonText className="w-1/3" />
      </div>
      <SkeletonBox className="w-full h-10 rounded-lg mt-2" />
    </div>
  );
};

export const SkeletonGrid = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBox key={i} className="aspect-video w-full rounded-2xl" />
      ))}
    </div>
  );
};
