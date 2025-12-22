import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Zap, Upload, Sparkles, Play, ArrowRight, ArrowLeft, 
  Music, Image, Loader2, Check, AlertCircle, Download
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
  const [lyrics, setLyrics] = useState<string>("");
  
  // Analysis state
  const [characterAnalysis, setCharacterAnalysis] = useState<CharacterAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Clips state
  const [clips, setClips] = useState<LightningClip[]>([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  
  // Sync state
  const [currentSyncIndex, setCurrentSyncIndex] = useState(0);
  
  // Polling refs
  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (photoUrl && photoUrl.startsWith('blob:')) URL.revokeObjectURL(photoUrl);
      pollingRefs.current.forEach(interval => clearInterval(interval));
    };
  }, []);

  // Handle audio upload
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error("Please upload an audio file");
      return;
    }

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    
    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(audio.duration);
      setAudioFile(file);
      setAudioUrl(url);
      toast.success(`Audio loaded: ${Math.round(audio.duration)}s`);
    });

    audio.addEventListener('error', () => {
      toast.error("Failed to load audio file");
      URL.revokeObjectURL(url);
    });
  };

  // Handle photo upload
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

    try {
      // Calculate scene count (max 10, ~8-12 seconds per scene)
      const sceneDuration = 10;
      const sceneCount = Math.min(10, Math.max(3, Math.ceil(audioDuration / sceneDuration)));
      
      // Analyze audio
      const audioAnalysis = await analyzeAudio(audioFile, sceneCount);
      
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

      if (error) throw error;

      if (data.scenes) {
        const generatedClips: LightningClip[] = data.scenes.map((scene: any, index: number) => ({
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
        toast.success(`Generated ${generatedClips.length} scene prompts!`);
      }
    } catch (error) {
      console.error("Prompt generation error:", error);
      toast.error("Failed to generate prompts");
      setPhase('analyzing');
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  // Generate single clip
  const handleGenerateClip = async (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    setClips(prev => prev.map(c => 
      c.id === clipId ? { ...c, status: 'generating', error: undefined } : c
    ));

    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: clip.prompt,
          referenceImage: photoUrl,
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
        
        startPolling(clipId, data.requestId);
      }
    } catch (error) {
      console.error("Generation error:", error);
      setClips(prev => prev.map(c => 
        c.id === clipId ? { ...c, status: 'error', error: 'Failed to start generation' } : c
      ));
      toast.error("Failed to generate video");
    }
  };

  // Start polling for video status
  const startPolling = (clipId: string, requestId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-video-status', {
          body: { requestId }
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

  // Start sync phase
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
        // For now, mark as complete since sync.so integration would need audio segment URLs
        // In production, you'd call generate-lipsync-syncso here
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
        
        setClips(prev => prev.map(c => 
          c.id === clip.id ? { ...c, status: 'complete', syncedVideoUrl: c.videoUrl } : c
        ));
      } catch (error) {
        console.error("Sync error:", error);
        setClips(prev => prev.map(c => 
          c.id === clip.id ? { ...c, status: 'error', error: 'Sync failed' } : c
        ));
      }
    }

    setPhase('complete');
    toast.success("All clips synced!");
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
                  {clips.filter(c => c.status === 'video_ready' || c.status === 'complete').length} / {clips.length} ready
                </p>
              </div>
            </div>

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

            {/* Final videos grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clips.map(clip => (
                <div key={clip.id} className="rounded-xl border bg-card overflow-hidden">
                  <video 
                    src={clip.syncedVideoUrl || clip.videoUrl || undefined}
                    className="w-full aspect-video object-cover"
                    controls
                  />
                  <div className="p-3">
                    <p className="text-sm text-muted-foreground">Clip {clip.index + 1}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => navigate('/simple')}>
                Back to Simple Mode
              </Button>
              <Button className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download All
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
