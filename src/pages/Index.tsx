// VeoStudio Pro - Main Generator Page
import { useState, useCallback, useEffect, useRef } from "react";
import { Clapperboard, Zap, Sparkles, Layers, Palette, FileText, Music, Crown, Scissors, Volume2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ReferenceImageUpload } from "@/components/ReferenceImageUpload";
import { PromptInput } from "@/components/PromptInput";
import { LyricsInput } from "@/components/LyricsInput";
import { VideoSettings } from "@/components/VideoSettings";
import { GenerationStatus } from "@/components/GenerationStatus";
import { VideoGallery } from "@/components/VideoGallery";
import { TemplateSelector } from "@/components/TemplateSelector";
import { BatchGenerationPanel } from "@/components/BatchGenerationPanel";
import { CoverArtGenerator } from "@/components/CoverArtGenerator";
import { SafetyAnalyzer } from "@/components/SafetyAnalyzer";
import { LyricsToVideoSync } from "@/components/LyricsToVideoSync";
import { StitchVideos } from "@/components/StitchVideos";
import { AudioEditor } from "@/components/AudioEditor";
import { AuthButton } from "@/components/AuthButton";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { GenerationTimeEstimator } from "@/components/GenerationTimeEstimator";
import { PromptSafetyChecker } from "@/components/PromptSafetyChecker";
import { PromptGuide } from "@/components/PromptGuide";

type GenerationStatusType = "idle" | "processing" | "completed" | "failed";
type GenerationMode = "single" | "batch" | "lyrics-sync" | "stitch" | "audio";
type FaceConsistencyLevel = "strict" | "moderate" | "loose";

const Index = () => {
  const navigate = useNavigate();
  const { subscription, refreshSubscription, canGenerateVideo, tierName } = useSubscription();
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [duration, setDuration] = useState(8);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [preserveFace, setPreserveFace] = useState(true);
  const [faceConsistencyLevel, setFaceConsistencyLevel] = useState<FaceConsistencyLevel>("strict");
  const [sceneExtension, setSceneExtension] = useState(false);
  const [status, setStatus] = useState<GenerationStatusType>("idle");
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [galleryRefresh, setGalleryRefresh] = useState(0);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("single");
  const [batchVideos, setBatchVideos] = useState<Array<{ url: string; prompt: string }>>([]);
  const [showCoverArt, setShowCoverArt] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [safetyWarnings, setSafetyWarnings] = useState<string[]>([]);
  const [batchScenes, setBatchScenes] = useState<any[]>([]);
  const [batchOperations, setBatchOperations] = useState<any[]>([]);
  const [batchStatus, setBatchStatus] = useState<"idle" | "generating" | "polling" | "completed">("idle");
  const [lyricsScenes, setLyricsScenes] = useState<any[]>([]);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Batch generation handler
  const handleBatchGenerate = async () => {
    if (batchScenes.length === 0) {
      toast.error("No scenes to generate");
      return;
    }

    setBatchStatus("generating");
    setBatchOperations([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-batch-videos", {
        body: {
          scenes: batchScenes,
          referenceImage,
          preserveFace,
          aspectRatio,
        },
      });

      if (error) throw error;

      if (data.operations) {
        setBatchOperations(data.operations);
        setBatchStatus("polling");
        toast.success(`Started generating ${data.successCount} scenes!`);

        // Start polling for each operation
        data.operations.forEach((op: any) => {
          if (op.success && op.requestId) {
            pollBatchOperation(op.requestId, op.order);
          }
        });
      }
    } catch (error) {
      console.error("Batch generation error:", error);
      toast.error("Failed to start batch generation");
      setBatchStatus("idle");
    }
  };

  // Lyrics sync batch generation handler
  const handleLyricsSyncGenerate = async () => {
    if (lyricsScenes.length === 0) {
      toast.error("No scenes generated from lyrics");
      return;
    }

    setBatchStatus("generating");
    setBatchOperations([]);

    try {
      // Convert lyrics scenes to batch scenes format
      const scenesToGenerate = lyricsScenes.map((scene, idx) => ({
        id: `lyrics-${idx}`,
        order: scene.order || idx + 1,
        prompt: scene.sceneDescription,
        duration: scene.endTime && scene.startTime ? scene.endTime - scene.startTime : 8,
      }));

      const { data, error } = await supabase.functions.invoke("generate-batch-videos", {
        body: {
          scenes: scenesToGenerate,
          referenceImage,
          preserveFace,
          aspectRatio,
        },
      });

      if (error) throw error;

      if (data.operations) {
        setBatchOperations(data.operations);
        setBatchStatus("polling");
        toast.success(`Started generating ${lyricsScenes.length} synced scenes!`);

        // Start polling for each operation
        data.operations.forEach((op: any) => {
          if (op.success && op.requestId) {
            pollBatchOperation(op.requestId, op.order);
          }
        });
      }
    } catch (error) {
      console.error("Lyrics sync generation error:", error);
      toast.error("Failed to start lyrics sync generation");
      setBatchStatus("idle");
    }
  };

  // Regenerate individual scene
  const handleRegenerateScene = async (sceneId: string, sceneDescription: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt: sceneDescription,
          referenceImage,
          preserveFace,
          duration: 8,
          aspectRatio,
        },
      });

      if (error) throw error;

      if (data.requestId) {
        toast.info(`Regenerating scene... Check gallery when complete.`);
        // Start polling for this single regeneration
        const pollInterval = setInterval(async () => {
          const { data: statusData } = await supabase.functions.invoke("check-video-status", {
            body: { requestId: data.requestId },
          });
          if (statusData?.status === "completed") {
            clearInterval(pollInterval);
            setGalleryRefresh((prev) => prev + 1);
            toast.success("Scene regenerated!");
          } else if (statusData?.status === "failed") {
            clearInterval(pollInterval);
            toast.error("Scene regeneration failed");
          }
        }, 5000);
      }
    } catch (error) {
      console.error("Regeneration error:", error);
      toast.error("Failed to regenerate scene");
    }
  };

  // Calculate prompt complexity
  const getPromptComplexity = (text: string): 'simple' | 'medium' | 'complex' => {
    const length = text.length;
    if (length < 50) return 'simple';
    if (length < 150) return 'medium';
    return 'complex';
  };

  // Poll individual batch operation
  const pollBatchOperation = async (requestId: string, order: number) => {
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-video-status", {
          body: { requestId },
        });

        if (error) {
          console.error(`Polling error for scene ${order}:`, error);
          clearInterval(pollInterval);
          return;
        }

        if (data.status === "completed" && data.videoUrl) {
          clearInterval(pollInterval);

          // Update batch operations
          setBatchOperations((prev) =>
            prev.map((op) => (op.order === order ? { ...op, status: "completed", videoUrl: data.videoUrl } : op)),
          );

          toast.success(`Scene ${order} completed!`);

          // Check if all completed
          setBatchOperations((prev) => {
            const allCompleted = prev.every((op) => op.status === "completed" || !op.success);
            if (allCompleted) {
              setBatchStatus("completed");
              setGalleryRefresh((prev) => prev + 1);
              toast.success("All scenes completed!");
            }
            return prev;
          });
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          setBatchOperations((prev) =>
            prev.map((op) => (op.order === order ? { ...op, status: "failed", error: data.error } : op)),
          );
          toast.error(`Scene ${order} failed`);
        }
      } catch (error) {
        console.error("Polling error:", error);
        clearInterval(pollInterval);
      }
    }, 5000);
  };

  const pollStatus = useCallback(
    async (requestId: string, modelId: string) => {
      try {
        // Update elapsed time
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedTime(elapsed);
          // Estimate progress based on elapsed time (assume ~60-90 seconds for video generation)
          const estimatedProgress = Math.min(95, Math.floor((elapsed / 75) * 100));
          setProgress(estimatedProgress);
        }

        const { data, error: fnError } = await supabase.functions.invoke("check-video-status", {
          body: {
            requestId,
            modelId,
            prompt,
            lyrics: lyrics || undefined,
            duration,
            aspectRatio,
          },
        });

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (data.status === "completed") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          // Check for video URL in multiple locations
          const videoUri = data.videoUrl || data.videos?.[0]?.uri;
          if (videoUri) {
            setProgress(100);
            setVideoUrl(videoUri);
            setStatus("completed");
            setGalleryRefresh((prev) => prev + 1); // Refresh gallery
            toast.success("Video generated and saved!");
          } else {
            throw new Error("No video URL in response");
          }
        } else if (data.status === "failed") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          throw new Error(data.error || "Video generation failed");
        } else if (data.progress) {
          // Use server-provided progress if available
          setProgress(data.progress);
        }
      } catch (err) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setError(err instanceof Error ? err.message : "Failed to check status");
        setStatus("failed");
      }
    },
    [prompt, lyrics, duration, aspectRatio],
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a video prompt");
      return;
    }

    setStatus("processing");
    setError(undefined);
    setVideoUrl(undefined);
    setProgress(0);
    setElapsedTime(0);
    startTimeRef.current = Date.now();

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt,
          lyrics: lyrics || undefined,
          referenceImage,
          preserveFace,
          faceConsistencyLevel,
          sceneExtension,
          duration,
          aspectRatio,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to start video generation");
      }

      toast.info("Video generation started! This may take a few minutes.");

      // Start polling for status - modelId is extracted from requestId in the edge function
      if (data.requestId) {
        pollingRef.current = setInterval(() => {
          pollStatus(data.requestId, data.modelId || "veo-3.1-generate-001");
        }, 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("failed");
      toast.error(err instanceof Error ? err.message : "Failed to generate video");
    }
  }, [prompt, lyrics, referenceImage, preserveFace, faceConsistencyLevel, sceneExtension, duration, aspectRatio, pollStatus]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/30 bg-glass sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-primary glow-rainbow-sm">
              <Clapperboard className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-foreground text-lg">VeoStudio Pro</h1>
              <p className="text-xs text-muted-foreground">AI Music Video Generator</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Subscription Status */}
            <button 
              onClick={() => navigate('/pricing')}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-glass border border-primary/20 hover:border-primary/40 transition-all cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">{tierName}</span>
              <span className="text-xs text-muted-foreground">
                {subscription?.videos_remaining ?? 0} left
              </span>
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-glass border border-border/30">
              <Zap className="w-3.5 h-3.5 text-rainbow-cyan" />
              <span className="text-xs text-muted-foreground">Veo 3.1</span>
            </div>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="font-heading text-4xl sm:text-5xl font-bold mb-4">
              <span className="text-gradient">Lyrics-Synced</span>
              <br />
              <span className="text-foreground">Music Videos</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              The only AI that understands your lyrics. Create professional music videos with scenes perfectly synced to
              your song's emotion.
            </p>
          </div>

          {/* Generation Mode Tabs */}
          <Tabs value={generationMode} onValueChange={(v) => setGenerationMode(v as GenerationMode)} className="mb-8">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
              <TabsTrigger value="single" className="gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Quick</span>
              </TabsTrigger>
              <TabsTrigger value="batch" className="gap-2">
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Batch</span>
              </TabsTrigger>
              <TabsTrigger value="lyrics-sync" className="gap-2">
                <Music className="w-4 h-4" />
                <span className="hidden sm:inline">Lyrics</span>
              </TabsTrigger>
              <TabsTrigger value="stitch" className="gap-2">
                <Scissors className="w-4 h-4" />
                <span className="hidden sm:inline">Stitch</span>
              </TabsTrigger>
              <TabsTrigger value="audio" className="gap-2">
                <Volume2 className="w-4 h-4" />
                <span className="hidden sm:inline">Audio</span>
              </TabsTrigger>
            </TabsList>

            {/* Single Generation Mode */}
            <TabsContent value="single" className="space-y-6 mt-6">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Left Panel */}
                <div className="space-y-6">
                  {/* Template Selector */}
                  <TemplateSelector
                    onSelectTemplate={(template) => {
                      setSelectedTemplate(template.id);
                      setPrompt(template.sceneDescription);
                      setDuration(template.duration);
                      setAspectRatio(template.aspectRatio);
                      toast.success(`Template "${template.name}" applied!`);
                    }}
                    selectedTemplateId={selectedTemplate}
                  />

                  {/* Reference Image */}
                  <div className="card-elevated rounded-2xl p-6">
                    <ReferenceImageUpload onImageChange={setReferenceImage} aspectRatio={aspectRatio} />
                  </div>

                  {/* Prompt & Lyrics */}
                  <div className="card-elevated rounded-2xl p-6">
                    <PromptInput value={prompt} onChange={setPrompt} />
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <LyricsInput value={lyrics} onChange={setLyrics} />
                    </div>
                  </div>

                  {/* Safety Analyzer */}
                  <SafetyAnalyzer
                    prompt={prompt}
                    lyrics={lyrics}
                    onAnalysisComplete={(analysis) => {
                      setSafetyWarnings(analysis.issues.map((i) => i.message));
                    }}
                  />

                  {/* Prompt Safety Checker */}
                  <PromptSafetyChecker
                    prompt={prompt}
                    referenceImage={referenceImage}
                    onSuggestionAccepted={(newPrompt) => setPrompt(newPrompt)}
                  />

                  {/* Prompt Guide */}
                  <PromptGuide />

                  {/* Video Settings */}
                  <div className="card-elevated rounded-2xl p-6">
                    <VideoSettings
                      duration={duration}
                      aspectRatio={aspectRatio}
                      preserveFace={preserveFace}
                      sceneExtension={sceneExtension}
                      faceConsistencyLevel={faceConsistencyLevel}
                      onDurationChange={setDuration}
                      onAspectRatioChange={setAspectRatio}
                      onPreserveFaceChange={setPreserveFace}
                      onSceneExtensionChange={setSceneExtension}
                      onFaceConsistencyLevelChange={setFaceConsistencyLevel}
                    />
                  </div>

                  {/* Generate Button */}
                  <Button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || status === "processing" || safetyWarnings.length > 0 || !canGenerateVideo}
                    variant="hero"
                    size="lg"
                    className="w-full"
                  >
                    {status === "processing" ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : !canGenerateVideo ? (
                      <>
                        <Crown className="w-5 h-5" />
                        Upgrade to Generate
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Video
                      </>
                    )}
                  </Button>
                  {!canGenerateVideo && (
                    <p className="text-xs text-center text-muted-foreground">
                      You've used all your videos this month.{" "}
                      <button onClick={() => navigate('/pricing')} className="text-primary underline">Upgrade your plan</button>
                    </p>
                  )}
                </div>

                {/* Right Panel - Preview */}
                <div className="space-y-6">
                  <div className="card-elevated rounded-2xl p-6 min-h-[400px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-heading font-semibold text-foreground">Preview</h3>
                      {status === "completed" && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          Ready
                        </span>
                      )}
                    </div>
                    <GenerationStatus
                      status={status}
                      videoUrl={videoUrl}
                      error={error}
                      aspectRatio={aspectRatio}
                      progress={progress}
                      elapsedTime={elapsedTime}
                    />
                  </div>

                  {/* Cover Art Generator */}
                  {status === "completed" && videoUrl && (
                    <CoverArtGenerator videoPrompt={prompt} lyrics={lyrics} artistName="" trackTitle="" />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Batch Generation Mode */}
            <TabsContent value="batch" className="space-y-6 mt-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  {/* Reference Image */}
                  <div className="card-elevated rounded-2xl p-6">
                    <ReferenceImageUpload onImageChange={setReferenceImage} aspectRatio={aspectRatio} />
                  </div>

                  {/* Batch Panel */}
                  <BatchGenerationPanel
                    onScenesChange={(scenes) => {
                      setBatchScenes(scenes);
                    }}
                    aspectRatio={aspectRatio}
                    onGenerateBatch={handleBatchGenerate}
                  />

                  {/* Generate Batch Button */}
                  <Button
                    onClick={handleBatchGenerate}
                    disabled={batchScenes.length === 0 || batchStatus === "generating" || batchStatus === "polling"}
                    variant="hero"
                    size="lg"
                    className="w-full"
                  >
                    <Layers className="w-5 h-5 mr-2" />
                    {batchStatus === "generating"
                      ? "Starting Generation..."
                      : batchStatus === "polling"
                        ? `Generating ${batchScenes.length} Scenes...`
                        : `Generate ${batchScenes.length} Scenes`}
                  </Button>
                  {/* Time Estimator */}
                  <GenerationTimeEstimator
                    sceneCount={batchScenes.length}
                    averageDuration={8}
                    complexity={getPromptComplexity(batchScenes.map(s => s.prompt).join(' '))}
                    hasReferenceImage={!!referenceImage}
                  />
                </div>

                <div className="space-y-6">
                  <div className="card-elevated rounded-2xl p-6">
                    <h3 className="font-heading font-semibold mb-4">Batch Progress</h3>
                    {batchOperations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Your scenes will appear here as they generate...</p>
                    ) : (
                      <div className="space-y-3">
                        {batchOperations.map((op, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-border/50 bg-card/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Scene {op.order}</span>
                              {op.success ? (
                                op.status === "completed" ? (
                                  <Badge variant="default">✓ Complete</Badge>
                                ) : op.status === "failed" ? (
                                  <Badge variant="destructive">✗ Failed</Badge>
                                ) : (
                                  <Badge variant="secondary">⏳ Generating...</Badge>
                                )
                              ) : (
                                <Badge variant="destructive">Error</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{op.sceneDescription}</p>
                            {op.videoUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => window.open(op.videoUrl, "_blank")}
                              >
                                View Video
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Lyrics Sync Mode */}
            <TabsContent value="lyrics-sync" className="space-y-6 mt-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  {/* Reference Image */}
                  <div className="card-elevated rounded-2xl p-6">
                    <ReferenceImageUpload onImageChange={setReferenceImage} aspectRatio={aspectRatio} />
                  </div>

                  {/* Base Visual Style */}
                  <div className="card-elevated rounded-2xl p-6">
                    <PromptInput value={prompt} onChange={setPrompt} />
                    <p className="text-xs text-muted-foreground mt-2">
                      This will be your base visual style for all scenes
                    </p>
                  </div>

                  {/* Lyrics Input */}
                  <div className="card-elevated rounded-2xl p-6">
                    <LyricsInput value={lyrics} onChange={setLyrics} />
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Time Estimator for Lyrics Sync */}
                  {lyricsScenes.length > 0 && (
                    <GenerationTimeEstimator
                      sceneCount={lyricsScenes.length}
                      averageDuration={audioDuration && lyricsScenes.length > 0 ? Math.floor(audioDuration / lyricsScenes.length) : 8}
                      complexity={getPromptComplexity(prompt)}
                      hasReferenceImage={!!referenceImage}
                    />
                  )}

                  {/* Lyrics to Video Sync */}
                  <LyricsToVideoSync
                    lyrics={lyrics}
                    baseVisualStyle={prompt}
                    audioDuration={audioDuration || undefined}
                    onScenesGenerated={(scenes) => {
                      setLyricsScenes(scenes);
                      console.log("Lyrics scenes:", scenes);
                      toast.success(`Generated ${scenes.length} synced scenes!`);
                    }}
                    onGenerateBatch={handleLyricsSyncGenerate}
                    onRegenerateScene={handleRegenerateScene}
                  />

                  {/* Batch Progress for Lyrics Sync */}
                  {batchOperations.length > 0 && (
                    <div className="card-elevated rounded-2xl p-6">
                      <h3 className="font-heading font-semibold mb-4">Generation Progress</h3>
                      <div className="space-y-3">
                        {batchOperations.map((op, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-border/50 bg-card/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Scene {op.order}</span>
                              {op.success ? (
                                op.status === "completed" ? (
                                  <Badge variant="default">✓ Complete</Badge>
                                ) : op.status === "failed" ? (
                                  <Badge variant="destructive">✗ Failed</Badge>
                                ) : (
                                  <Badge variant="secondary">⏳ Generating...</Badge>
                                )
                              ) : (
                                <Badge variant="destructive">Error</Badge>
                              )}
                            </div>
                            {op.videoUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => window.open(op.videoUrl, "_blank")}
                              >
                                View Video
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Stitch Mode */}
            <TabsContent value="stitch" className="space-y-6 mt-6">
              <StitchVideos />
            </TabsContent>

            {/* Audio Editor Mode */}
            <TabsContent value="audio" className="space-y-6 mt-6">
              <div className="max-w-3xl mx-auto">
                <div className="card-elevated rounded-2xl p-6 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 className="w-5 h-5 text-primary" />
                    <h3 className="font-heading font-semibold text-foreground">Audio Editor</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Upload your music to use for lyrics timing. The audio duration will automatically sync with the Lyrics tab.
                  </p>
                </div>
                <AudioEditor onAudioLoaded={(duration) => {
                  setAudioDuration(duration);
                  toast.success(`Audio loaded: ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`);
                }} />
              </div>
            </TabsContent>
          </Tabs>

          {/* Info Banner */}
          <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-glow-secondary/10 border border-primary/20">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="p-3 rounded-xl bg-primary/20">
                <Palette className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-heading font-semibold text-foreground mb-1">AI-Powered Lyrics Sync</h4>
                <p className="text-sm text-muted-foreground">
                  Our exclusive AI analyzes your lyrics and generates perfectly synchronized scenes matching the
                  emotional content of each line. No other platform has this.
                </p>
              </div>
            </div>
          </div>

          {/* Video History Gallery */}
          <div className="mt-12">
            <VideoGallery refreshTrigger={galleryRefresh} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>VeoStudio Pro • Powered by Veo 3.1 • The World's First Lyrics-Synced AI Music Video Generator</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
