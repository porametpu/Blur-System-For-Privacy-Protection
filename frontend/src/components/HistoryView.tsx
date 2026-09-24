"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { Download, Film, Image as ImageIcon, Loader2, PlayCircle, Clock } from 'lucide-react';

interface HistoryItem {
  id: number;
  filename: string;
  status: string;
  is_image: boolean;
  created_at: string;
  download_url: string;
  preview_url: string | null;
}

export default function HistoryView() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      api.getUserHistory()
        .then(data => setHistory(data))
        .catch(err => setError(err.message))
        .finally(() => setIsLoading(false));
    } else if (!isAuthLoading) {
      setIsLoading(false);
    }
  }, [user, isAuthLoading]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto fade-slide-in">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Sign in to view history</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Create an account or sign in to save and access your past blurred videos and images.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh] text-red-500 font-bold">
        Error loading history: {error}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full fade-slide-in pb-20 pt-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Your History</h2>
          <p className="text-slate-500 font-medium text-sm">Past processed media linked to your account.</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
            <Film className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-1">No history yet</h3>
          <p className="text-slate-500 text-sm">Process your first video or image to see it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {history.map(item => (
            <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">

              {/* Media Preview Area */}
              <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-slate-800">
                {item.preview_url ? (
                  item.is_image ? (
                    <img src={item.preview_url} alt={item.filename} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <video src={item.preview_url} className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayCircle className="w-12 h-12 text-white/90 drop-shadow-lg" />
                      </div>
                    </>
                  )
                ) : (
                  <div className="text-slate-400 flex flex-col items-center">
                    {item.is_image ? <ImageIcon className="w-8 h-8 mb-2 opacity-50" /> : <Film className="w-8 h-8 mb-2 opacity-50" />}
                    <span className="text-[10px] font-bold uppercase tracking-widest">No Preview</span>
                  </div>
                )}

                {/* Type Badge */}
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-white flex items-center gap-1.5 border border-white/10 shadow-sm">
                  {item.is_image ? <ImageIcon className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                  <span className="text-[9px] font-black uppercase tracking-wider">{item.is_image ? 'Image' : 'Video'}</span>
                </div>
              </div>

              {/* Details Area */}
              <div className="p-5 flex flex-col flex-1">
                <div className="mb-4">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate" title={item.filename}>
                    {item.filename}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : 'Unknown date'}
                  </p>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                  <a
                    href={item.download_url}
                    download={item.is_image ? `Blurred_${item.filename}` : `Blurred_${item.filename}.mp4`}
                    className="flex-1 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
