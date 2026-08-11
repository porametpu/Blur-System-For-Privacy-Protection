"use client";

import React, { useState, useEffect } from 'react';
import { ToastProvider, useToast } from '../components/Toast';
import StepIndicator from '../components/StepIndicator';
import VideoUpload from '../components/VideoUpload';
import FramePreview from '../components/FramePreview';
import KeyframeSelector from '../components/KeyframeSelector';
import DetectionProgress from '../components/DetectionProgress';
import RecognitionResults from '../components/RecognitionResults';
import BlurManager from '../components/BlurManager';
import Timeline from '../components/Timeline';
import VideoPreviewPlayer from '../components/VideoPreviewPlayer';
import ExportPanel from '../components/ExportPanel';
import ManualControl from '../components/ManualControl';
import ImageManualRedaction from '../components/ImageManualRedaction';
import { SkeletonCard, SkeletonGrid } from '../components/SkeletonLoader';

import { AppStep, Video, PreviewFrame, DetectedPerson, TimelineEntry, BlurType } from '../lib/types';
import * as api from '../lib/api';

import { Shield, ArrowRight, ArrowLeft, RefreshCcw, Scan, Sparkles, Maximize, PenTool, UserX, CreditCard } from 'lucide-react';

function BlurApp() {
  const { addToast } = useToast();

  // State
  const [step, setStep] = useState<AppStep>('upload');
  const [videoId, setVideoId] = useState<number | null>(null);
  const [videoInfo, setVideoInfo] = useState<Video | null>(null);

  // Data
  const [previewFrames, setPreviewFrames] = useState<PreviewFrame[]>([]);
  const [selectedKeyframes, setSelectedKeyframes] = useState<Set<number>>(new Set());
  const [detectedPersons, setDetectedPersons] = useState<DetectedPerson[]>([]);
  const [blurSelections, setBlurSelections] = useState<Map<number, boolean>>(new Map());

  // Timeline Modal
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [activePerson, setActivePerson] = useState<DetectedPerson | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);

  // Settings
  const [blurType, setBlurType] = useState<BlurType>('gaussian');
  const [blurStrength, setBlurStrength] = useState<number>(50);

  // Export & Preview
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [exportData, setExportData] = useState<{ downloadUrl: string, cloudinaryUrl?: string } | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState({ progress: 0, status: '' });
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Set Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Handlers
  const handleUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const vid = await api.uploadVideo(file);
      setVideoId(vid.video_id);
      setVideoInfo(vid);
      addToast('Video uploaded successfully', 'success');
      setStep('tools_selection');
      fetchPreviewFrames(vid.video_id);
    } catch (err: any) {
      addToast(err.message || 'Upload failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPreviewFrames = async (vid: number) => {
    setIsLoading(true);
    try {
      const frames = await api.getPreviewFrames(vid);
      setPreviewFrames(frames);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyframesConfirm = async () => {
    if (!videoId) return;
    setIsLoading(true);
    try {
      await api.selectKeyframes(videoId, Array.from(selectedKeyframes));
      setStep('detecting');
      startDetection();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };


  const handleDetectAndSelect = async () => {
    if (!videoId) return;
    setIsLoading(true);

    // Automatically use all preview frames as keyframes
    const framesToUse = previewFrames.map(f => f.frame_number);
    setSelectedKeyframes(new Set(framesToUse));
    setStep('face_map');

    try {
      await api.selectKeyframes(videoId, framesToUse);
      startDetection(framesToUse);
    } catch (err: any) {
      addToast(err.message, 'error');
      setIsLoading(false);
      setStep('tools_selection');
    }
  };

  const handleAutoBlur = async () => {
    if (!videoId) return;
    setIsLoading(true);

    const framesToUse = previewFrames.map(f => f.frame_number);
    setSelectedKeyframes(new Set(framesToUse));
    setStep('detecting');

    try {
      await api.selectKeyframes(videoId, framesToUse);
      await api.startDetection(videoId, framesToUse);

      const interval = setInterval(async () => {
        try {
          const status = await api.checkStatus(videoId);
          setDetectionProgress({
            progress: status.progress || 0,
            status: status.status === 'processing' ? 'Auto-Blurring...' : 'Finalizing...'
          });

          if (status.status === 'completed') {
            clearInterval(interval);
            const persons = await api.getRecognizedPersons(videoId);
            setDetectedPersons(persons);

            // Auto blur all
            const payload = persons.map(p => ({ identity_id: p.id, should_blur: true }));
            await api.updateBlurSelections(videoId, payload);

            setStep('preview_blur');
            generatePreviewVideo();
          } else if (status.status === 'error') {
            clearInterval(interval);
            addToast(`Detection error: ${status.error}`, 'error');
            setStep('tools_selection');
            setIsLoading(false);
          }
        } catch (e) {
          // ignore
        }
      }, 2000);
    } catch (err: any) {
      addToast(err.message, 'error');
      setIsLoading(false);
      setStep('tools_selection');
    }
  };

  const startDetection = async (frames?: number[]) => {
    if (!videoId) return;
    const framesToUse = frames || Array.from(selectedKeyframes);
    try {
      await api.startDetection(videoId, framesToUse);

      const interval = setInterval(async () => {
        try {
          const status = await api.checkStatus(videoId);
          setDetectionProgress({
            progress: status.progress || 0,
            status: status.status === 'processing' ? 'Analyzing frames...' : 'Finalizing...'
          });

          if (status.status === 'completed') {
            clearInterval(interval);
            fetchResults();
          } else if (status.status === 'error') {
            clearInterval(interval);
            addToast(`Detection error: ${status.error}`, 'error');
            setStep('tools_selection');
          }
        } catch (e) {
          // ignore
        }
      }, 2000);

    } catch (err: any) {
      addToast(err.message, 'error');
      setStep('tools_selection');
    }
  };

  const fetchResults = async () => {
    if (!videoId) return;
    setIsLoading(true);
    try {
      const persons = await api.getRecognizedPersons(videoId);
      setDetectedPersons(persons);

      const sels = new Map();
      persons.forEach(p => sels.set(p.id, p.should_blur));
      setBlurSelections(sels);

      // Keep step as face_map instead of results
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const handleViewTimeline = async (person: DetectedPerson) => {
    if (!videoId) return;
    try {
      const timeline = await api.getTimeline(videoId, person.id);
      setActivePerson(person);
      setTimelineEntries(timeline);
      setIsTimelineOpen(true);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const saveBlurSelections = async () => {
    if (!videoId) return;
    setIsLoading(true);
    try {
      const payload = Array.from(blurSelections.entries()).map(([id, should_blur]) => ({ identity_id: id, should_blur }));
      await api.updateBlurSelections(videoId, payload);
      setStep('preview_blur');
      generatePreviewVideo();
    } catch (err: any) {
      addToast(err.message, 'error');
      setIsLoading(false);
    }
  };

  const saveBlurExceptSelections = async () => {
    if (!videoId) return;
    setIsLoading(true);
    try {
      // Invert: blur everyone EXCEPT the selected (checked) persons
      const payload = Array.from(blurSelections.entries()).map(([id, should_blur]) => ({ identity_id: id, should_blur: !should_blur }));
      await api.updateBlurSelections(videoId, payload);
      setStep('preview_blur');
      generatePreviewVideo();
    } catch (err: any) {
      addToast(err.message, 'error');
      setIsLoading(false);
    }
  };

  const generatePreviewVideo = async () => {
    if (!videoId) return;
    setIsLoading(true);
    setPreviewVideoUrl(null);
    try {
      const res = await api.renderPreview(videoId, blurType, blurStrength);
      setPreviewVideoUrl(res.preview_url);
    } catch (err: any) {
      addToast(err.message, 'error');
      setStep('blur_manager');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerExport = async () => {
    handleExport(blurType, blurStrength);
  };

  const handleExport = async (type: BlurType, strength: number) => {
    if (!videoId) return;
    setIsLoading(true);
    try {
      const res = await api.exportVideo(videoId, type, strength);
      setExportData({ downloadUrl: res.download_url, cloudinaryUrl: res.cloudinary_url });
      addToast('Video exported successfully!', 'success');
      setStep('export');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const resetFlow = () => {
    setStep('upload');
    setVideoId(null);
    setVideoInfo(null);
    setPreviewFrames([]);
    setSelectedKeyframes(new Set());
    setDetectedPersons([]);
    setPreviewVideoUrl(null);
    setExportData(null);
  };

  // Renders
  return (
    <div className="min-h-screen pb-20">
      {/* Main Content */}
      <main className="w-full h-full relative">
        <div className="transition-all duration-500">

          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center pt-10 md:pt-20 fade-slide-in">
              <h1 className="text-4xl md:text-[4.5rem] font-black text-slate-800 tracking-tight leading-[1.1] text-center">
                Blur System For <br />
                <span className="text-gradient">Privacy Protection</span>
              </h1>
              <p className="text-slate-400 mt-6 text-sm md:text-lg font-bold tracking-widest uppercase">
                Blur your information .................
              </p>
              <div className="w-full mt-12 px-4 relative z-10">
                <VideoUpload onUpload={handleUpload} isLoading={isLoading} />
              </div>
              
              {/* Features Section */}
              <div className="w-full max-w-[1200px] mt-32 px-4 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-blue-900/5 hover:-translate-y-2 transition-transform duration-500">
                    <div className="w-16 h-16 rounded-3xl bg-blue-50/50 flex items-center justify-center mb-8 shadow-sm shadow-blue-100/50">
                      <UserX className="w-7 h-7 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-4 tracking-tight">FULL AUTO-ANONYMIZE</h3>
                    <p className="text-slate-400 font-bold text-sm leading-relaxed">
                      One-click processing for rapid identity protection across large datasets.
                    </p>
                  </div>

                  <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-blue-900/5 hover:-translate-y-2 transition-transform duration-500">
                    <div className="w-16 h-16 rounded-3xl bg-blue-50/50 flex items-center justify-center mb-8 shadow-sm shadow-blue-100/50">
                      <Shield className="w-7 h-7 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-4 tracking-tight">DYNAMIC INTENSITY</h3>
                    <p className="text-slate-400 font-bold text-sm leading-relaxed">
                      Adjust blur strength from subtle to absolute to meet your specific legal requirements.
                    </p>
                  </div>

                  <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-blue-900/5 hover:-translate-y-2 transition-transform duration-500">
                    <div className="w-16 h-16 rounded-3xl bg-blue-50/50 flex items-center justify-center mb-8 shadow-sm shadow-blue-100/50">
                      <CreditCard className="w-7 h-7 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-4 tracking-tight">SELECTIVE PRIVACY</h3>
                    <p className="text-slate-400 font-bold text-sm leading-relaxed">
                      Review detected identities and choose specifically who to keep or protect.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'tools_selection' && (
            <div className="fade-slide-in flex flex-col">
              <div className="flex justify-between items-center mb-8">
                <button
                  onClick={resetFlow}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Go Back
                </button>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-600 text-xs font-bold uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Ready
                  </div>
                  <button className="px-6 py-2 rounded-full border-2 border-blue-100 text-blue-600 font-bold hover:bg-blue-50 transition-colors uppercase tracking-wider text-sm">
                    Preview
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Side: Preview */}
                <div className="space-y-6">
                  <div className="glass-panel p-2 rounded-[2rem] overflow-hidden">
                    {previewFrames.length > 0 ? (
                      <img src={previewFrames[0].thumbnail_url} className="w-full rounded-[1.5rem] object-cover aspect-video" alt="Video Preview" />
                    ) : (
                      <div className="w-full aspect-video bg-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-400">Loading preview...</div>
                    )}
                  </div>

                  <div className="glass-panel p-8 rounded-[2rem]">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="text-slate-400">
                        <Shield className="w-5 h-5" />
                      </div>
                      <h3 className="font-black text-slate-800 tracking-widest text-sm">SETTINGS</h3>
                    </div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">ENGINE_PRESET</h4>

                    <div className="space-y-3">
                      <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-600 text-white font-bold transition-transform shadow-lg shadow-blue-500/20">
                        <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                        </div>
                        GAUSSIAN BLUR
                      </button>
                      <button className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white text-slate-500 font-bold hover:bg-slate-50 transition-colors">
                        <div className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center"></div>
                        <span className="w-4 h-4 bg-green-500 rounded-sm"></span> PIXELATE
                      </button>
                      <button className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white text-slate-500 font-bold hover:bg-slate-50 transition-colors">
                        <div className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center"></div>
                        <span className="w-4 h-4 bg-slate-800 rounded-sm"></span> BLACK BOX
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Side: Tools */}
                <div className="pl-0 lg:pl-4">
                  <h2 className="text-[2.5rem] font-black text-slate-800 tracking-tight leading-none mb-1">TOOLS</h2>
                  <p className="text-slate-500 font-medium mb-8">Configuration</p>

                  <div className="space-y-6">
                    {/* AI Auto-Blur */}
                    <div
                      onClick={handleAutoBlur}
                      className="relative glass-panel p-8 rounded-[2rem] border-2 border-blue-100 hover:border-blue-500 transition-colors cursor-pointer group"
                    >
                      <div className="absolute top-0 right-8 -translate-y-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                        Recommended
                      </div>
                      <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-2xl font-black text-slate-800 mb-2">AI AUTO-BLUR</h3>
                      <p className="text-slate-500 font-medium">Full AI Detection.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Detect & Select */}
                      <div
                        onClick={handleDetectAndSelect}
                        className="glass-panel p-8 rounded-[2rem] border-2 border-[#dcfce7] hover:border-teal-400 transition-colors cursor-pointer group"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-teal-500 flex items-center justify-center mb-6 shadow-lg shadow-teal-500/30 group-hover:scale-110 transition-transform">
                          <Maximize className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight">DETECT & SELECT</h3>
                        <p className="text-slate-500 font-medium text-sm">AI Detection and Select Specifics Face.</p>
                      </div>

                      {/* Manual Control */}
                      <div
                        onClick={() => setStep('manual_control')}
                        className="glass-panel p-8 rounded-[2rem] border-2 border-purple-100 hover:border-indigo-400 transition-colors cursor-pointer group"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform">
                          <PenTool className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight">MANUAL CONTROL</h3>
                        <p className="text-slate-500 font-medium text-sm">Crop,Drawing Shape for blur</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'manual_control' && videoId && (
            videoInfo?.total_frames === 1 ? (
              <ImageManualRedaction
                videoId={videoId}
                previewFrames={previewFrames}
                onSave={(type, strength) => {
                  setBlurType(type);
                  setBlurStrength(strength);
                  setStep('preview_blur');
                  generatePreviewVideo();
                }}
                onCancel={() => setStep('tools_selection')}
              />
            ) : (
              <ManualControl
                videoId={videoId}
                previewFrames={previewFrames}
                onSave={() => {
                  setStep('preview_blur');
                  generatePreviewVideo();
                }}
                onCancel={() => setStep('tools_selection')}
              />
            )
          )}

          {step === 'detecting' && (
            <div className="fade-slide-in flex flex-col items-center justify-center min-h-[400px]">
              <div className="glass-panel p-8 md:p-12 rounded-[2rem] w-full max-w-2xl text-center space-y-8">
                <div className="w-20 h-20 bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-10 h-10 animate-pulse" />
                </div>
                <h2 className="text-3xl font-black text-slate-800">AI Auto-Blur in Progress</h2>
                <p className="text-slate-500 text-lg">We are analyzing the frames and detecting faces...</p>
                <div className="pt-4">
                  <DetectionProgress progress={detectionProgress.progress} statusText={detectionProgress.status} />
                </div>
              </div>
            </div>
          )}

          {step === 'face_map' && (
            <div className="fade-slide-in flex flex-col">
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">

                {/* Left Side: Video Player */}
                <div className="xl:col-span-3 space-y-6">
                  <div className="glass-panel p-2 rounded-[2rem]">
                    {previewFrames.length > 0 ? (
                      <img src={previewFrames[0].thumbnail_url} className="w-full rounded-[1.5rem] object-cover aspect-video" alt="Video Preview" />
                    ) : (
                      <div className="w-full aspect-video bg-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-400">Loading preview...</div>
                    )}
                  </div>

                  <button
                    onClick={handleKeyframesConfirm}
                    disabled={isLoading}
                    className="w-full glass-panel py-5 rounded-[1.5rem] flex items-center justify-center gap-2 text-slate-800 font-bold hover:bg-slate-50 transition-colors text-lg shadow-sm"
                  >
                    <RefreshCcw className="w-5 h-5" /> Scan New Frame
                  </button>
                </div>

                {/* Right Side: Settings & Faces */}
                <div className="xl:col-span-2 glass-panel p-8 rounded-[2rem] flex flex-col">
                  <div className="mb-6 border-b border-slate-100 pb-6">
                    <h2 className="text-[2.5rem] font-black text-slate-800 tracking-tight leading-none mb-2">Face Map</h2>
                    <p className="text-slate-500 font-medium">{detectedPersons.length} identities found.</p>
                  </div>

                  <div className="flex-1 min-h-[150px]">
                    {isLoading && detectionProgress.progress > 0 ? (
                      <div className="py-8">
                        <DetectionProgress progress={detectionProgress.progress} statusText={detectionProgress.status} />
                      </div>
                    ) : isLoading ? (
                      <SkeletonGrid count={2} />
                    ) : detectedPersons.length === 0 ? (
                      <div className="text-slate-400 text-center py-8">No faces detected yet. Use the scan option to detect.</div>
                    ) : (
                      <RecognitionResults
                        persons={detectedPersons}
                        onViewTimeline={handleViewTimeline}
                        selections={blurSelections}
                        onToggleSelection={(id) => {
                          setBlurSelections(prev => {
                            const newMap = new Map(prev);
                            newMap.set(id, !prev.get(id));
                            return newMap;
                          });
                        }}
                      />
                    )}
                  </div>

                  <div className="mt-8 space-y-8">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">ENGINE_PRESET</h4>
                      <div className="space-y-3">
                        <button onClick={() => setBlurType('gaussian')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-transform ${blurType === 'gaussian' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'border border-slate-100 bg-white text-slate-500 hover:bg-slate-50'}`}>
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${blurType === 'gaussian' ? 'bg-white' : 'border border-slate-200'}`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${blurType === 'gaussian' ? 'bg-blue-600' : 'bg-transparent'}`}></div>
                          </div>
                          GAUSSIAN BLUR
                        </button>
                        <button onClick={() => setBlurType('pixelate')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-transform ${blurType === 'pixelate' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'border border-slate-100 bg-white text-slate-500 hover:bg-slate-50'}`}>
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${blurType === 'pixelate' ? 'bg-white' : 'border border-slate-200'}`}>
                            <span className={`w-4 h-4 rounded-sm ${blurType === 'pixelate' ? 'bg-green-500' : 'bg-green-500'}`}></span>
                          </div>
                          PIXELATE
                        </button>
                        <button onClick={() => setBlurType('black')} className={`w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-transform ${blurType === 'black' ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20' : 'border border-slate-100 bg-white text-slate-500 hover:bg-slate-50'}`}>
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${blurType === 'black' ? 'bg-white' : 'border border-slate-200'}`}>
                            <span className={`w-4 h-4 rounded-sm ${blurType === 'black' ? 'bg-slate-800' : 'bg-slate-800'}`}></span>
                          </div>
                          BLACK BOX
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BLUR INTENSITY</h4>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{blurStrength}px</span>
                      </div>
                      <input
                        type="range"
                        min="1" max="100"
                        value={blurStrength}
                        onChange={(e) => setBlurStrength(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>SUBTLE</span>
                        <span>ABSOLUTE</span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4">
                      <button
                        onClick={saveBlurSelections}
                        disabled={isLoading}
                        className="w-full bg-[#cce0ff] text-blue-600 font-bold py-4 rounded-[1.5rem] flex justify-center items-center gap-2 hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />} Blur Selected Person (Track)
                      </button>
                      <button
                        onClick={saveBlurExceptSelections}
                        disabled={isLoading}
                        className="w-full bg-slate-200 text-slate-600 font-bold py-4 rounded-[1.5rem] flex justify-center items-center gap-2 hover:bg-slate-300 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />} Blur EVERYONE EXCEPT Selected
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}


          {step === 'preview_blur' && (
            <div className="space-y-6 fade-slide-in">
              <div className="flex justify-between items-end max-w-4xl mx-auto mb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight text-color-black">Preview Results</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">Review the video with blur applied before final export.</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setStep('face_map')} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-color-black" />
                  </button>
                  <button
                    onClick={triggerExport}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-blue-500/20"
                  >
                    Continue to Export <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {videoInfo?.total_frames === 1 ? (
                <div className="rounded-[2rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 relative bg-black flex items-center justify-center min-h-[400px]">
                  {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10">
                      <div className="flex flex-col items-center gap-4">
                        <RefreshCcw className="w-8 h-8 text-white animate-spin" />
                        <span className="text-white font-bold tracking-widest text-sm">RENDERING PREVIEW...</span>
                      </div>
                    </div>
                  ) : null}
                  <img src={previewVideoUrl || ''} className="w-full max-h-[70vh] object-contain" alt="Preview Result" />
                </div>
              ) : (
                <VideoPreviewPlayer src={previewVideoUrl || ''} isLoading={isLoading} />
              )}
            </div>
          )}

          {step === 'export' && (
            <div className="space-y-6 fade-slide-in">
              <div className="flex justify-between items-end max-w-3xl mx-auto mb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight text-color-black">Export Video</h2>
                </div>
                {!exportData && (
                  <button onClick={() => setStep('preview_blur')} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
              </div>

              <ExportPanel
                onExport={(type, strength) => handleExport(type, strength)}
                isExporting={isLoading}
                downloadUrl={exportData?.downloadUrl || null}
                cloudinaryUrl={exportData?.cloudinaryUrl}
                isImage={videoInfo?.total_frames === 1}
              />
            </div>
          )}

        </div>
      </main>

      {/* Modals */}
      <Timeline
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        person={activePerson}
        entries={timelineEntries}
      />
    </div>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <BlurApp />
    </ToastProvider>
  );
}
