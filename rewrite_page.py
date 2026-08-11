import re

with open("frontend/src/app/page.tsx", "r") as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "import { Shield, ArrowRight, ArrowLeft, RefreshCcw, Scan } from 'lucide-react';",
    "import { Shield, ArrowRight, ArrowLeft, RefreshCcw, Scan, Sparkles, Maximize, PenTool } from 'lucide-react';"
)

# 2. Update setStep('preview') -> setStep('tools_selection')
content = content.replace(
    "setStep('preview');",
    "setStep('tools_selection');"
)

# 3. Replace the return statement
# We will find the start of // Renders and replace to the end of the file except the last } export default function Page() { ... }
start_idx = content.find("  // Renders")
if start_idx != -1:
    end_idx = content.find("export default function Page() {")
    if end_idx != -1:
        # Get the new return block
        new_return = """  // Renders
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
              <div className="w-full mt-12 px-4">
                <VideoUpload onUpload={handleUpload} isLoading={isLoading} />
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
                    <div className="relative glass-panel p-8 rounded-[2rem] border-2 border-blue-100 hover:border-blue-500 transition-colors cursor-pointer group">
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
                        onClick={() => {
                          setStep('face_map');
                        }}
                        className="glass-panel p-8 rounded-[2rem] border-2 border-[#dcfce7] hover:border-teal-400 transition-colors cursor-pointer group"
                      >
                         <div className="w-14 h-14 rounded-2xl bg-teal-500 flex items-center justify-center mb-6 shadow-lg shadow-teal-500/30 group-hover:scale-110 transition-transform">
                            <Maximize className="w-7 h-7 text-white" />
                         </div>
                         <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight">DETECT & SELECT</h3>
                         <p className="text-slate-500 font-medium text-sm">AI Detection and Select Specifics Face.</p>
                      </div>

                      {/* Manual Control */}
                      <div className="glass-panel p-8 rounded-[2rem] border-2 border-purple-100 hover:border-indigo-400 transition-colors cursor-pointer group">
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
                    {isLoading && <SkeletonGrid count={2} />}
                    {!isLoading && detectedPersons.length === 0 && (
                       <div className="text-slate-400 text-center py-8">No faces detected yet. Click Scan New Frame to detect.</div>
                    )}
                    {!isLoading && detectedPersons.length > 0 && (
                       <RecognitionResults persons={detectedPersons} onViewTimeline={handleViewTimeline} />
                    )}
                  </div>
                  
                  <div className="mt-8 space-y-8">
                    <div>
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

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BLUR INTENSITY</h4>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">50px</span>
                      </div>
                      <input type="range" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                      <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         <span>SUBTLE</span>
                         <span>ABSOLUTE</span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4">
                      <button className="w-full bg-[#cce0ff] text-blue-600 font-bold py-4 rounded-[1.5rem] flex justify-center items-center gap-2 hover:bg-blue-200 transition-colors">
                        <Scan className="w-5 h-5" /> Blur Selected Person (Track)
                      </button>
                      <button className="w-full bg-slate-200 text-slate-600 font-bold py-4 rounded-[1.5rem] flex justify-center items-center gap-2 hover:bg-slate-300 transition-colors">
                        <Shield className="w-5 h-5" /> Blur EVERYONE EXCEPT Selected
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* Fallbacks for other states if needed during dev */}
          {['preview', 'keyframes', 'detecting', 'results', 'blur_manager', 'preview_blur', 'export'].includes(step) && (
            <div className="text-center py-20 text-slate-500">
               <p className="mb-4">This step ({step}) is currently being integrated into the new design.</p>
               <button onClick={resetFlow} className="text-blue-500 font-bold hover:underline">Start Over</button>
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

"""
        content = content[:start_idx] + new_return + content[end_idx:]

with open("frontend/src/app/page.tsx", "w") as f:
    f.write(content)
