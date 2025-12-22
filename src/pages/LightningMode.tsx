import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Zap, Upload, Sparkles, Play, ArrowRight, ArrowLeft, 
  Music, Image, Loader2, Check, AlertCircle, Download, Film, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ClipCard, LightningClip } from "@/components/LightningMode/ClipCard";
import { SyncProgress } from "@/components/LightningMode/SyncProgress";
import { AuthButton } from "@/components/AuthButton";
import { Textarea } from "@/components/ui/textarea";
import { analyzeAudio, getNarrativePosition, getTempoDescription, getEnergyDescription } from "@/utils/audioAnalyzer";
import { parseLyrics, analyzeSongNarrative } from "@/utils/lyricsParser";
import { cn } from "@/lib/utils";
import { downloadClipsAsZip } from "@/utils/zipDownloader";
import { stitchVideos, revokeStitchedVideo, StitchProgress } from "@/utils/videoStitcher";

type Phase = 'upload' | 'analyzing' | 'prompts' | 'editing' | 'syncing' | 'complete';

interface CharacterAnalysis {
  mood: string[];
  colorPalette: string[];
  visualStyle: string;
  characterDescription: string;
  suggestedCameraWork: string;
  emotionalTone: string;
  settingSuggestions: string[];
}

export default function LightningMode() {
  const navigate = useNavigate();
  
  // Phase state
  const [phase, setPhase] = useState<Phase>('upload');
  
  // Upload state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [photoBase64, setPhotoBase64] = useState<string>("");
  const [lyrics, setLyrics] = useState<string>("");
  
  // Analysis state
  const [characterAnalysis, setCharacterAnalysis] = useState<CharacterAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Clips state
  const [clips, setClips] = useState<LightningClip[]>([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  
  // Sync state
  const [currentSyncIndex, setCurrentSyncIndex] = useState(0);
  
  // Generation state
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  
  // Download/Stitch state
  const [isDownloading, setIsDownloading] = useState(false);
  const [isStitching, setIsStitching] = useState(false);
  const [stitchProgress, setStitchProgress] = useState<StitchProgress | null>(null);
  const [stitchedVideoUrl, setStitchedVideoUrl] = useState<string | null>(null);
  
  // Polling refs
  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (photoUrl && photoUrl.startsWith('blob:')) URL.revokeObjectURL(photoUrl);
      if (stitchedVideoUrl) revokeStitchedVideo(stitchedVideoUrl);
      pollingRefs.current.forEach(interval => clearInterval(interval));
    };
  }, []);

  // Handle audio upload
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept more audio types - check file extension as fallback
    const isAudioFile = file.type.startsWith('audio/') || 
      /\.(mp3|wav|m4a|ogg|flac|aac|wma|aiff)$/i.test(file.name);
    
    if (!isAudioFile) {
      toast.error("Please upload an audio file");
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading("Loading audio file...");

    const url = URL.createObjectURL(file);
    const audio = new Audio();
    
    // Set a timeout in case metadata never loads
    const timeout = setTimeout(() => {
      console.warn('[Lightning] Audio metadata timeout, using file-based estimate');
      toast.dismiss(loadingToast);
      
      // Estimate duration from file size (rough: ~1MB per minute for MP3)
      const estimatedDuration = Math.max(30, Math.min(300, file.size / 16000));
      setAudioDuration(estimatedDuration);
      setAudioFile(file);
      setAudioUrl(url);
      toast.success(`Audio loaded (estimated ${Math.round(estimatedDuration)}s)`);
    }, 5000); // 5 second timeout

    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      toast.dismiss(loadingToast);
      setAudioDuration(audio.duration);
      setAudioFile(file);
      setAudioUrl(url);
      toast.success(`Audio loaded: ${Math.round(audio.duration)}s`);
    });

    audio.addEventListener('error', (e) => {
      clearTimeout(timeout);
      toast.dismiss(loadingToast);
      console.error('[Lightning] Audio load error:', e);
      
      // Still try to use the file with estimated duration
      const estimatedDuration = Math.max(30, Math.min(300, file.size / 16000));
      setAudioDuration(estimatedDuration);
      setAudioFile(file);
      setAudioUrl(url);
      toast.warning(`Audio loaded with estimated duration (${Math.round(estimatedDuration)}s)`);
    });

    // Explicitly set src and load
    audio.src = url;
    audio.load(); // Force loading to start
  };

  // Handle photo upload - convert to base64 for API calls
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoUrl(url);
    
    // Convert to base64 for API calls
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    toast.success("Photo uploaded");
  };

  // Analyze character
  const analyzeCharacter = async () => {
    if (!photoFile) {
      toast.error("Please upload a character photo first");
      return;
    }

    setIsAnalyzing(true);
    setPhase('analyzing');

    try {
      // Convert to base64 for API
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(photoFile);
      const base64Image = await base64Promise;

      const { data, error } = await supabase.functions.invoke('analyze-character', {
        body: { imageUrl: base64Image }
      });

      if (error) throw error;

      if (data.analysis) {
        setCharacterAnalysis(data.analysis);
        toast.success("Character analyzed successfully!");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze character");
      setPhase('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate prompts for all clips
  const generatePrompts = async () => {
    if (!audioFile || !characterAnalysis) {
      toast.error("Missing required data");
      return;
    }

    setIsGeneratingPrompts(true);
    setPhase('prompts');

    const toastId = toast.loading("Preparing to generate prompts...");

    try {
      // Calculate scene count (max 10, ~8-12 seconds per scene)
      const sceneDuration = 10;
      const sceneCount = Math.min(10, Math.max(3, Math.ceil(audioDuration / sceneDuration)));
      
      console.log('[Lightning] Scene count:', sceneCount, 'for duration:', audioDuration);
      
      // Create default analysis - skip audio analysis entirely for reliability
      // The AI will generate appropriate prompts based on lyrics and character
      const audioAnalysis = {
        segments: Array.from({ length: sceneCount }, (_, i) => ({
          segmentIndex: i,
          energy: 0.5 + (i / sceneCount) * 0.3, // Gradual energy increase
          tempo: 120,
          beatDensity: 2,
          dynamics: (i < sceneCount * 0.3 ? 'building' : i > sceneCount * 0.7 ? 'fading' : 'peak') as 'quiet' | 'building' | 'peak' | 'fading'
        })),
        averageEnergy: 0.6,
        averageTempo: 120,
        energyProgression: 'dynamic' as const
      };
      
      console.log('[Lightning] Using optimized analysis for', sceneCount, 'scenes');
      
      toast.loading("Generating scene prompts...", { id: toastId });
      console.log('[Lightning] Parsing lyrics...');
      
      // Parse lyrics
      const lyricSections = parseLyrics(lyrics || "Instrumental track - create visual narrative", sceneCount);
      const songAnalysis = analyzeSongNarrative(lyrics || "Instrumental");
      
      // Build scenes data
      const scenes = Array.from({ length: sceneCount }, (_, i) => {
        const startTime = (i / sceneCount) * audioDuration;
        const endTime = ((i + 1) / sceneCount) * audioDuration;
        const segmentIndex = Math.floor((i / sceneCount) * (audioAnalysis?.segments?.length || 1));
        const segment = audioAnalysis?.segments?.[segmentIndex];
        
        return {
          index: i,
          startTime,
          endTime,
          duration: endTime - startTime,
          energyLevel: segment?.energy || 0.6,
          tempo: segment?.tempo || 120,
          beatDensity: segment?.beatDensity || 0.5,
          narrativePosition: getNarrativePosition(i, sceneCount),
          sectionType: lyricSections[Math.min(i, lyricSections.length - 1)]?.type || 'verse',
          lyrics: lyricSections[Math.min(i, lyricSections.length - 1)]?.text || ''
        };
      });

      // Build enhanced base prompt
      const basePrompt = `
REFERENCE IMAGE STYLE: Maintain visual consistency with the reference character.
Character: ${characterAnalysis.characterDescription}
Visual Style: ${characterAnalysis.visualStyle}
Color Palette: ${characterAnalysis.colorPalette.join(', ')}
Mood: ${characterAnalysis.mood.join(', ')}
Camera Work: ${characterAnalysis.suggestedCameraWork}
Setting Options: ${characterAnalysis.settingSuggestions.join(', ')}
Song Theme: ${songAnalysis.overallTheme}
Narrative Type: ${songAnalysis.narrativeType}
      `.trim();

      console.log('[Lightning] Calling generate-scene-prompts edge function...');
      
      // Call generate-scene-prompts
      const { data, error } = await supabase.functions.invoke('generate-scene-prompts', {
        body: {
          basePrompt,
          scenes,
          lyricSections,
          songAnalysis,
          referenceImage: photoUrl
        }
      });

      if (error) {
        console.error('[Lightning] Edge function error:', error);
        throw error;
      }

      console.log('[Lightning] Edge function response:', data);

      // Handle response - the edge function returns 'prompts' not 'scenes'
      const promptsData = data.prompts || data.scenes;
      if (promptsData && promptsData.length > 0) {
        const generatedClips: LightningClip[] = promptsData.map((scene: any, index: number) => ({
          id: `clip-${index}`,
          index,
          startTime: scenes[index].startTime,
          endTime: scenes[index].endTime,
          prompt: scene.prompt || scene.sceneDescription,
          originalPrompt: scene.prompt || scene.sceneDescription,
          videoUrl: null,
          syncedVideoUrl: null,
          status: 'pending' as const
        }));

        setClips(generatedClips);
        setPhase('editing');
        toast.success(`Generated ${generatedClips.length} scene prompts!`, { id: toastId });
        console.log('[Lightning] Successfully generated', generatedClips.length, 'clips');
      } else {
        throw new Error("No prompts generated from API response");
      }
    } catch (error) {
      console.error("[Lightning] Prompt generation error:", error);
      toast.error("Failed to generate prompts. Please try again.", { id: toastId });
      setPhase('analyzing');
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  // Generate single clip - use base64 for reference image
  const handleGenerateClip = async (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    if (!photoBase64) {
      toast.error("Photo not ready. Please re-upload.");
      return;
    }

    setClips(prev => prev.map(c => 
      c.id === clipId ? { ...c, status: 'generating', error: undefined } : c
    ));

    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: clip.prompt,
          referenceImage: photoBase64, // Use base64 instead of blob URL
          preserveFace: true,
          duration: Math.min(8, clip.endTime - clip.startTime),
          aspectRatio: "9:16"
        }
      });

      if (error) throw error;

      if (data.requestId) {
        // Update clip with requestId and start polling
        setClips(prev => prev.map(c => 
          c.id === clipId ? { ...c, requestId: data.requestId } : c
        ));
        
        startPolling(clipId, data.requestId, clip.prompt);
      }
    } catch (error) {
      console.error("Generation error:", error);
      setClips(prev => prev.map(c => 
        c.id === clipId ? { ...c, status: 'error', error: 'Failed to start generation' } : c
      ));
      toast.error("Failed to generate video");
    }
  };

  // Generate all pending clips
  const handleGenerateAll = async () => {
    const pendingClips = clips.filter(c => c.status === 'pending' || c.status === 'error');
    if (pendingClips.length === 0) {
      toast.info("All clips already generated or in progress");
      return;
    }

    setIsGeneratingAll(true);
    toast.success(`Starting generation for ${pendingClips.length} clips...`);

    // Start all pending clips in parallel
    for (const clip of pendingClips) {
      handleGenerateClip(clip.id);
      // Small delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsGeneratingAll(false);
  };

  // Start polling for video status
  const startPolling = (clipId: string, requestId: string, prompt: string) => {
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-video-status', {
          body: { requestId, prompt } // Pass prompt for database storage
        });

        if (error) throw error;

        if (data.status === 'completed' && data.videoUrl) {
          clearInterval(interval);
          pollingRefs.current.delete(clipId);
          
          setClips(prev => prev.map(c => 
            c.id === clipId ? { ...c, status: 'video_ready', videoUrl: data.videoUrl } : c
          ));
          toast.success(`Clip generated!`);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          pollingRefs.current.delete(clipId);
          
          setClips(prev => prev.map(c => 
            c.id === clipId ? { ...c, status: 'error', error: data.error || 'Generation failed' } : c
          ));
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 5000);

    pollingRefs.current.set(clipId, interval);
  };

  // Regenerate clip
  const handleRegenerate = (clipId: string, newPrompt: string) => {
    setClips(prev => prev.map(c => 
      c.id === clipId ? { ...c, prompt: newPrompt, videoUrl: null } : c
    ));
    handleGenerateClip(clipId);
  };

  // Update prompt
  const handlePromptChange = (clipId: string, newPrompt: string) => {
    setClips(prev => prev.map(c => 
      c.id === clipId ? { ...c, prompt: newPrompt } : c
    ));
  };

  // Check if all clips have videos
  const allClipsReady = clips.length > 0 && clips.every(c => c.status === 'video_ready' || c.status === 'complete');

  // Upload audio segment to storage and get signed URL
  const uploadAudioSegment = async (clipIndex: number): Promise<string> => {
    if (!audioFile) throw new Error("No audio file");
    
    const clip = clips[clipIndex];
    const startTime = clip.startTime;
    const endTime = clip.endTime;
    
    // Create audio context to extract segment
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const segmentLength = endSample - startSample;
    
    // Create new buffer for segment
    const segmentBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      segmentLength,
      sampleRate
    );
    
    // Copy segment data
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const sourceData = audioBuffer.getChannelData(channel);
      const segmentData = segmentBuffer.getChannelData(channel);
      for (let i = 0; i < segmentLength; i++) {
        segmentData[i] = sourceData[startSample + i];
      }
    }
    
    // Convert to WAV blob
    const wavBlob = await audioBufferToWav(segmentBuffer);
    
    // Upload to Supabase storage
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not authenticated");
    
    const filePath = `${userData.user.id}/lightning-segment-${Date.now()}-${clipIndex}.wav`;
    
    const { error: uploadError } = await supabase.storage
      .from('background-music')
      .upload(filePath, wavBlob, { upsert: true });
    
    if (uploadError) throw uploadError;
    
    // Get signed URL
    const { data: signedData, error: signedError } = await supabase.storage
      .from('background-music')
      .createSignedUrl(filePath, 3600);
    
    if (signedError) throw signedError;
    
    await audioContext.close();
    return signedData.signedUrl;
  };

  // Convert AudioBuffer to WAV Blob
  const audioBufferToWav = (buffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const numChannels = buffer.numberOfChannels;
      const sampleRate = buffer.sampleRate;
      const format = 1; // PCM
      const bitDepth = 16;
      
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numChannels * bytesPerSample;
      
      const data = [];
      for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
          const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          data.push(intSample & 0xFF);
          data.push((intSample >> 8) & 0xFF);
        }
      }
      
      const dataLength = data.length;
      const bufferArray = new ArrayBuffer(44 + dataLength);
      const view = new DataView(bufferArray);
      
      // WAV header
      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + dataLength, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, format, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitDepth, true);
      writeString(36, 'data');
      view.setUint32(40, dataLength, true);
      
      // Write audio data
      const uint8Array = new Uint8Array(bufferArray);
      for (let i = 0; i < dataLength; i++) {
        uint8Array[44 + i] = data[i];
      }
      
      resolve(new Blob([bufferArray], { type: 'audio/wav' }));
    });
  };

  // Poll for sync.so job status
  const pollSyncStatus = (jobId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('generate-lipsync-syncso?action=status', {
            body: { jobId }
          });

          if (error) throw error;

          if (data.status === 'completed' && data.outputUrl) {
            clearInterval(interval);
            resolve(data.outputUrl);
          } else if (data.status === 'failed') {
            clearInterval(interval);
            reject(new Error(data.error || 'Sync.so generation failed'));
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, 5000);
    });
  };

  // Start sync phase with real sync.so integration
  const startSync = async () => {
    if (!allClipsReady) {
      toast.error("Not all clips have videos ready");
      return;
    }

    setPhase('syncing');
    setCurrentSyncIndex(0);

    // Process each clip sequentially
    for (let i = 0; i < clips.length; i++) {
      setCurrentSyncIndex(i);
      const clip = clips[i];
      
      setClips(prev => prev.map(c => 
        c.id === clip.id ? { ...c, status: 'syncing' } : c
      ));

      try {
        // Step 1: Extract and upload audio segment for this clip
        toast.info(`Preparing audio for clip ${i + 1}...`);
        const audioSegmentUrl = await uploadAudioSegment(i);
        
        // Step 2: Call sync.so to generate lip-synced video
        toast.info(`Syncing clip ${i + 1}...`);
        const { data: syncData, error: syncError } = await supabase.functions.invoke('generate-lipsync-syncso', {
          body: {
            characterImageUrl: clip.videoUrl, // Using video URL as input
            audioUrl: audioSegmentUrl,
            model: 'lipsync-2' // Use lipsync-2 for video input
          }
        });

        if (syncError) throw syncError;
        if (!syncData.success) throw new Error(syncData.error || 'Failed to start sync');

        // Step 3: Poll for completion
        const syncedVideoUrl = await pollSyncStatus(syncData.jobId);
        
        setClips(prev => prev.map(c => 
          c.id === clip.id ? { ...c, status: 'complete', syncedVideoUrl } : c
        ));
        
        toast.success(`Clip ${i + 1} synced!`);
      } catch (error) {
        console.error("Sync error:", error);
        // On error, fallback to using the original video
        setClips(prev => prev.map(c => 
          c.id === clip.id ? { 
            ...c, 
            status: 'complete', 
            syncedVideoUrl: c.videoUrl, // Fallback to original video
            error: error instanceof Error ? error.message : 'Sync failed'
          } : c
        ));
        toast.error(`Clip ${i + 1} sync failed, using original video`);
      }
    }

    setPhase('complete');
    toast.success("All clips processed!");
  };

  // Download all clips as ZIP
  const handleDownloadZip = async () => {
    const clipsWithVideos = clips.filter(c => c.syncedVideoUrl || c.videoUrl);
    if (clipsWithVideos.length === 0) {
      toast.error("No videos to download");
      return;
    }

    setIsDownloading(true);
    try {
      const clipsForZip = clipsWithVideos.map(clip => ({
        url: clip.syncedVideoUrl || clip.videoUrl || '',
        filename: `clip-${clip.index + 1}.mp4`
      }));
      
      await downloadClipsAsZip(clipsForZip, 'lightning-music-video-clips.zip');
      toast.success("ZIP downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download ZIP");
    } finally {
      setIsDownloading(false);
    }
  };

  // Stitch all videos into final video
  const handleStitchVideos = async () => {
    const videoUrls = clips
      .map(c => c.syncedVideoUrl || c.videoUrl)
      .filter(Boolean) as string[];
    
    if (videoUrls.length === 0) {
      toast.error("No videos to stitch");
      return;
    }

    setIsStitching(true);
    setStitchProgress(null);
    
    try {
      const result = await stitchVideos(videoUrls, setStitchProgress);
      setStitchedVideoUrl(result.url);
      toast.success(`Video stitched! Duration: ${Math.round(result.duration)}s`);
    } catch (error) {
      console.error("Stitch error:", error);
      toast.error("Failed to stitch videos");
    } finally {
      setIsStitching(false);
    }
  };

  // Download stitched video
  const handleDownloadStitched = () => {
    if (!stitchedVideoUrl) return;
    const a = document.createElement('a');
    a.href = stitchedVideoUrl;
    a.download = 'final-music-video.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };


  // Render phase content
  const renderPhase = () => {
    switch (phase) {
      case 'upload':
        return (
          <div className="space-y-8">
            {/* Audio Upload */}
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Music className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Upload Audio</h3>
                  <p className="text-sm text-muted-foreground">Your song or audio track (max 2 minutes recommended)</p>
                </div>
              </div>
              
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
                {audioFile ? (
                  <div className="flex items-center gap-2 text-primary">
                    <Check className="w-5 h-5" />
                    <span>{audioFile.name} ({Math.round(audioDuration)}s)</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="w-8 h-8" />
                    <span className="text-sm">Click to upload audio</span>
                  </div>
                )}
              </label>
            </div>

            {/* Photo Upload */}
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Image className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Upload Character Photo</h3>
                  <p className="text-sm text-muted-foreground">Reference image for visual consistency</p>
                </div>
              </div>
              
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors overflow-hidden">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                {photoUrl ? (
                  <img src={photoUrl} alt="Character" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="w-8 h-8" />
                    <span className="text-sm">Click to upload photo</span>
                  </div>
                )}
              </label>
            </div>

            {/* Lyrics Input */}
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Lyrics (Optional)</h3>
                  <p className="text-sm text-muted-foreground">Paste lyrics to guide the visual narrative</p>
                </div>
              </div>
              
              <Textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder="Paste your song lyrics here..."
                className="min-h-[150px] resize-none"
              />
            </div>

            {/* Continue Button */}
            <Button
              onClick={analyzeCharacter}
              disabled={!audioFile || !photoFile}
              className="w-full"
              size="lg"
            >
              Analyze & Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );

      case 'analyzing':
        return (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-primary/20 mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Analyzing Character...</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Our AI is studying the mood, colors, and style from your reference image
            </p>
          </div>
        );

      case 'prompts':
        return (
          <div className="space-y-6">
            {/* Analysis Results */}
            {characterAnalysis && (
              <div className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold mb-4">Character Analysis</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Visual Style:</span>
                    <p className="font-medium">{characterAnalysis.visualStyle}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Emotional Tone:</span>
                    <p className="font-medium">{characterAnalysis.emotionalTone}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mood:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {characterAnalysis.mood.map((m, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Colors:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {characterAnalysis.colorPalette.slice(0, 4).map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isGeneratingPrompts ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Generating Scene Prompts...</h3>
                <p className="text-muted-foreground">Creating narrative-driven video prompts</p>
              </div>
            ) : (
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setPhase('upload')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={generatePrompts} className="flex-1">
                  Generate Scene Prompts
                  <Sparkles className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        );

      case 'editing':
        const pendingCount = clips.filter(c => c.status === 'pending' || c.status === 'error').length;
        const generatingCount = clips.filter(c => c.status === 'generating').length;
        const readyCount = clips.filter(c => c.status === 'video_ready' || c.status === 'complete').length;
        
        return (
          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Edit & Generate Clips</h3>
                <p className="text-sm text-muted-foreground">
                  Generate videos selectively. Edit prompts before generating.
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {readyCount} / {clips.length} ready
                  {generatingCount > 0 && <span className="text-primary ml-2">({generatingCount} generating...)</span>}
                </p>
              </div>
            </div>

            {/* Generate All Button */}
            {pendingCount > 0 && (
              <Button 
                onClick={handleGenerateAll}
                disabled={isGeneratingAll}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              >
                {isGeneratingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting Generation...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Generate All ({pendingCount} clips)
                  </>
                )}
              </Button>
            )}

            {/* Clips Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clips.map(clip => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  onGenerate={handleGenerateClip}
                  onRegenerate={handleRegenerate}
                  onPromptChange={handlePromptChange}
                />
              ))}
            </div>

            {/* Sync Button */}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setPhase('prompts')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={startSync}
                disabled={!allClipsReady}
                className="flex-1"
              >
                {allClipsReady ? (
                  <>
                    Sync All Videos
                    <Music className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  "Generate all clips first"
                )}
              </Button>
            </div>
          </div>
        );

      case 'syncing':
        return (
          <div className="space-y-6">
            <SyncProgress
              clips={clips}
              currentSyncIndex={currentSyncIndex}
              isComplete={false}
            />
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-6">
            <SyncProgress
              clips={clips}
              currentSyncIndex={clips.length}
              isComplete={true}
            />

            {/* Stitched Video Section */}
            {stitchedVideoUrl ? (
              <div className="rounded-xl border-2 border-primary bg-card p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary" />
                  Final Music Video
                </h3>
                <video 
                  src={stitchedVideoUrl} 
                  className="w-full rounded-lg aspect-video" 
                  controls 
                />
                <Button 
                  className="w-full mt-4"
                  onClick={handleDownloadStitched}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Final Video
                </Button>
              </div>
            ) : (
              <Button 
                onClick={handleStitchVideos}
                disabled={isStitching}
                className="w-full bg-gradient-to-r from-primary to-primary/80"
                size="lg"
              >
                {isStitching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Stitching... {stitchProgress?.progress?.toFixed(0) || 0}%
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4 mr-2" />
                    Stitch into Final Video
                  </>
                )}
              </Button>
            )}

            {/* Final videos grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clips.map(clip => (
                <div key={clip.id} className="rounded-xl border bg-card overflow-hidden">
                  <video 
                    src={clip.syncedVideoUrl || clip.videoUrl || undefined}
                    className="w-full aspect-video object-cover"
                    controls
                  />
                  <div className="p-3 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Clip {clip.index + 1}</p>
                    {clip.error && (
                      <Badge variant="outline" className="text-xs text-orange-500">
                        Used original
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <Button variant="outline" onClick={() => navigate('/simple')}>
                Back to Simple Mode
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setStitchedVideoUrl(null);
                  setPhase('editing');
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Edit & Regenerate
              </Button>
              <Button 
                onClick={handleDownloadZip} 
                disabled={isDownloading}
                className="flex-1"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating ZIP...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download All Clips (ZIP)
                  </>
                )}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/30 bg-glass sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-foreground text-lg">Lightning Mode</h1>
              <p className="text-xs text-muted-foreground">Selective batch generation</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/simple')}>
              ← Simple Mode
            </Button>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Phase Progress */}
      <div className="border-b border-border/30 bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2">
            {(['upload', 'analyzing', 'prompts', 'editing', 'syncing', 'complete'] as Phase[]).map((p, i) => (
              <div key={p} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  phase === p ? "bg-primary text-primary-foreground" :
                  (['upload', 'analyzing', 'prompts', 'editing', 'syncing', 'complete'].indexOf(phase) > i) 
                    ? "bg-primary/20 text-primary" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {i + 1}
                </div>
                {i < 5 && (
                  <div className={cn(
                    "w-8 h-0.5 mx-1",
                    (['upload', 'analyzing', 'prompts', 'editing', 'syncing', 'complete'].indexOf(phase) > i)
                      ? "bg-primary/50"
                      : "bg-border"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {renderPhase()}
        </div>
      </main>
    </div>
  );
}
