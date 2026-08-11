import re

with open("frontend/src/app/page.tsx", "r") as f:
    content = f.read()

# Replace the DETECT & SELECT click handler
content = content.replace(
    "onClick={() => {\n                          setStep('face_map');\n                        }}",
    "onClick={handleDetectAndSelect}"
)

# Replace the Engine Preset buttons in face_map
old_preset = """                      <div className="space-y-3">
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
                      </div>"""

new_preset = """                      <div className="space-y-3">
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
                      </div>"""
content = content.replace(old_preset, new_preset)

# Replace intensity slider
old_intensity = """                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BLUR INTENSITY</h4>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">50px</span>
                      </div>
                      <input type="range" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                      <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         <span>SUBTLE</span>
                         <span>ABSOLUTE</span>
                      </div>
                    </div>"""
new_intensity = """                    <div>
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
                    </div>"""
content = content.replace(old_intensity, new_intensity)

# Replace blur buttons
old_blur_btns = """                    <div className="space-y-3 pt-4">
                      <button className="w-full bg-[#cce0ff] text-blue-600 font-bold py-4 rounded-[1.5rem] flex justify-center items-center gap-2 hover:bg-blue-200 transition-colors">
                        <Scan className="w-5 h-5" /> Blur Selected Person (Track)
                      </button>
                      <button className="w-full bg-slate-200 text-slate-600 font-bold py-4 rounded-[1.5rem] flex justify-center items-center gap-2 hover:bg-slate-300 transition-colors">
                        <Shield className="w-5 h-5" /> Blur EVERYONE EXCEPT Selected
                      </button>
                    </div>"""
new_blur_btns = """                    <div className="space-y-3 pt-4">
                      <button 
                        onClick={saveBlurSelections}
                        disabled={isLoading}
                        className="w-full bg-[#cce0ff] text-blue-600 font-bold py-4 rounded-[1.5rem] flex justify-center items-center gap-2 hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />} Blur Selected Person (Track)
                      </button>
                      <button className="w-full bg-slate-200 text-slate-600 font-bold py-4 rounded-[1.5rem] flex justify-center items-center gap-2 hover:bg-slate-300 transition-colors">
                        <Shield className="w-5 h-5" /> Blur EVERYONE EXCEPT Selected
                      </button>
                    </div>"""
content = content.replace(old_blur_btns, new_blur_btns)

# Replace the "loading..." in face map to use DetectionProgress
old_face_map_loading = """                  <div className="flex-1 min-h-[150px]">
                    {isLoading && <SkeletonGrid count={2} />}
                    {!isLoading && detectedPersons.length === 0 && (
                       <div className="text-slate-400 text-center py-8">No faces detected yet. Click Scan New Frame to detect.</div>
                    )}
                    {!isLoading && detectedPersons.length > 0 && (
                       <RecognitionResults persons={detectedPersons} onViewTimeline={handleViewTimeline} />
                    )}
                  </div>"""
new_face_map_loading = """                  <div className="flex-1 min-h-[150px]">
                    {isLoading && detectionProgress.progress > 0 ? (
                      <div className="py-8">
                         <DetectionProgress progress={detectionProgress.progress} statusText={detectionProgress.status} />
                      </div>
                    ) : isLoading ? (
                      <SkeletonGrid count={2} />
                    ) : detectedPersons.length === 0 ? (
                       <div className="text-slate-400 text-center py-8">No faces detected yet. Use the scan option to detect.</div>
                    ) : (
                       <RecognitionResults persons={detectedPersons} onViewTimeline={handleViewTimeline} />
                    )}
                  </div>"""
content = content.replace(old_face_map_loading, new_face_map_loading)


# Restore preview_blur and export views (hidden previously in fallback)
old_fallback = """          {/* Fallbacks for other states if needed during dev */}
          {['preview', 'keyframes', 'detecting', 'results', 'blur_manager', 'preview_blur', 'export'].includes(step) && (
            <div className="text-center py-20 text-slate-500">
               <p className="mb-4">This step ({step}) is currently being integrated into the new design.</p>
               <button onClick={resetFlow} className="text-blue-500 font-bold hover:underline">Start Over</button>
            </div>
          )}"""
          
new_preview_and_export = """
          {step === 'preview_blur' && (
            <div className="space-y-6 fade-slide-in">
              <div className="flex justify-between items-end max-w-4xl mx-auto mb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Preview Results</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">Review the video with blur applied before final export.</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setStep('face_map')} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
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

              <VideoPreviewPlayer src={previewVideoUrl || ''} isLoading={isLoading} />
            </div>
          )}

          {step === 'export' && (
            <div className="space-y-6 fade-slide-in">
              <div className="flex justify-between items-end max-w-3xl mx-auto mb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Export Video</h2>
                </div>
                {!exportData && (
                  <button onClick={() => setStep('preview_blur')} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
              </div>

              <ExportPanel
                onExport={(type, strength) => handleExport(blurType, blurStrength)} // Uses state now
                isExporting={isLoading}
                downloadUrl={exportData?.downloadUrl || null}
                cloudinaryUrl={exportData?.cloudinaryUrl}
              />
            </div>
          )}"""
content = content.replace(old_fallback, new_preview_and_export)

with open("frontend/src/app/page.tsx", "w") as f:
    f.write(content)
