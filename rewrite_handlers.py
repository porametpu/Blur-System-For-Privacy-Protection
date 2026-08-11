import re

with open("frontend/src/app/page.tsx", "r") as f:
    content = f.read()

# 1. Inject state
state_injection = """  // Settings
  const [blurType, setBlurType] = useState<BlurType>('gaussian');
  const [blurStrength, setBlurStrength] = useState<number>(50);

  // Export & Preview"""
content = content.replace("  // Export & Preview", state_injection)

# 2. Add handleDetectAndSelect and update fetchResults
detect_injection = """
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
"""

# Replace existing startDetection
content = re.sub(r'  const startDetection = async \(\) => \{.*?(?=\n  const fetchResults = async \(\) => \{)', detect_injection, content, flags=re.DOTALL)

# Update fetchResults to NOT setStep('results')
fetch_results_replacement = """  const fetchResults = async () => {
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
  };"""
content = re.sub(r'  const fetchResults = async \(\) => \{.*?(?=\n  const handleViewTimeline = async)', fetch_results_replacement, content, flags=re.DOTALL)


# Update handleExport to use the state
export_replacement = """  const triggerExport = async () => {
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
  };"""
content = re.sub(r'  const handleExport = async \(blurType: BlurType, strength: number\) => \{.*?(?=\n  const resetFlow = \(\) => \{)', export_replacement, content, flags=re.DOTALL)


with open("frontend/src/app/page.tsx", "w") as f:
    f.write(content)
