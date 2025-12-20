import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Settings, X, Wand2, Sparkles, Loader2, Download, Music, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { SetupPanel } from "./SetupPanel";
import { AudioUploadPanel } from "./AudioUploadPanel";
import { SoraTimeline } from "./SoraTimeline";
import { CompactSceneCard } from "./CompactSceneCard";
import { Scene, StoryboardSettings, StoryboardStep } from "./types";
import { AudioSegment } from "@/utils/audioSplitter";
import { batchMergeAudioWithVideos, downloadMergedVideo } from "@/utils/audioVideoMerger";

interface StoryboardEditorProps {
  onComplete?: () => void;
}

function generateFallbackPrompts(
  basePrompt: string,
  segments: AudioSegment[]
): string[] {
  const moods = [
    "with intense energy and dynamic movement",
    "with emotional depth and cinematic lighting",
    "with vibrant colors and fluid motion",
    "building dramatic tension",
    "with powerful visual storytelling",
    "in an atmospheric, moody setting",
    "with striking visual contrast",
    "capturing raw emotion and expression",
    "with sweeping camera movements",
    "in a climactic, powerful moment",
  ];

  return segments.map((segment, i) => {
    const mood = moods[i % moods.length];
    const avgEnergy = segment.waveformData.reduce((a, b) => a + b, 0) / segment.waveformData.length;
    const energyDesc = avgEnergy > 0.5 ? "high energy" : avgEnergy > 0.3 ? "moderate energy" : "calm";
    return `${basePrompt}, ${mood}, ${energyDesc} section`;
  });
}

export function StoryboardEditor({ onComplete }: StoryboardEditorProps) {
  const [currentStep, setCurrentStep] = useState<StoryboardStep>("setup");
  const [settings, setSettings] = useState<StoryboardSettings>({
    basePrompt: "",
    referenceImage: null,
    aspectRatio: "16:9",
    clipDuration: 8,
    preserveFace: true,
  });
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [fullWaveform, setFullWaveform] = useState<number[]>([]);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState<Record<string, number>>({});
  const [completedCount, setCompletedCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const pollingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const selectedScenes = useMemo(() => scenes.filter((s) => s.selected), [scenes]);
  const allCompleted = selectedScenes.length > 0 && selectedScenes.every((s) => s.status === "completed");
  const anyGenerating = selectedScenes.some((s) => s.status === "generating");
  const maxScenes = 10;

  // Cleanup polling intervals
  useEffect(() => {
    return () => {
      pollingIntervals.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  // Audio time update
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setPlayingSceneId(null);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  const generateAIPrompts = useCallback(async (currentScenes: Scene[]) => {
    if (!settings.basePrompt || currentScenes.length === 0) return;

    setIsGeneratingPrompts(true);
    try {
      const sceneData = currentScenes.map(scene => {
        const avgEnergy = scene.audioSegment?.waveformData 
          ? scene.audioSegment.waveformData.reduce((a, b) => a + b, 0) / scene.audioSegment.waveformData.length
          : 0.5;
        
        return {
          index: scene.index,
          startTime: scene.startTime,
          endTime: scene.endTime,
          duration: scene.duration,
          energyLevel: avgEnergy,
          tempo: avgEnergy > 0.6 ? "fast" : avgEnergy > 0.35 ? "medium" : "slow"
        };
      });

      const { data, error } = await supabase.functions.invoke('generate-scene-prompts', {
        body: {
          basePrompt: settings.basePrompt,
          scenes: sceneData,
          aspectRatio: settings.aspectRatio,
          preserveFace: settings.preserveFace
        }
      });

      if (error) throw error;

      if (data?.success && data?.prompts) {
        setScenes(prev => prev.map(scene => {
          const aiPrompt = data.prompts.find((p: { index: number; prompt: string }) => p.index === scene.index);
          return aiPrompt ? { ...scene, prompt: aiPrompt.prompt } : scene;
        }));
        toast.success("AI prompts generated!");
      } else {
        throw new Error(data?.error || "Failed to generate prompts");
      }
    } catch (err) {
      console.error("AI prompt generation failed:", err);
      toast.error("AI prompts failed, using fallback prompts");
    } finally {
      setIsGeneratingPrompts(false);
    }
  }, [settings.basePrompt, settings.aspectRatio, settings.preserveFace]);

  const handleAudioProcessed = useCallback(
    (segments: AudioSegment[], waveform: number[], duration: number, file: File) => {
      setFullWaveform(waveform);
      setAudioDuration(duration);
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));

      const fallbackPrompts = generateFallbackPrompts(settings.basePrompt, segments);

      const newScenes: Scene[] = segments.map((segment, i) => ({
        id: segment.id,
        index: i,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration,
        prompt: fallbackPrompts[i],
        audioSegment: segment,
        status: "pending",
        selected: i < 10,
      }));

      setScenes(newScenes);
      setCurrentStep("timeline");
      generateAIPrompts(newScenes);
    },
    [settings.basePrompt, generateAIPrompts]
  );

  const pollSceneStatus = useCallback((sceneId: string, requestId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-video-status", {
          body: { requestId },
        });

        if (error) return;

        if (data.status === "completed" && data.videoUrl) {
          clearInterval(interval);
          pollingIntervals.current.delete(sceneId);

          setScenes(prev =>
            prev.map((s) =>
              s.id === sceneId ? { ...s, status: "completed", videoUrl: data.videoUrl } : s
            )
          );

          setCompletedCount((prev) => prev + 1);
          toast.success(`Scene completed!`);
        } else if (data.status === "failed") {
          clearInterval(interval);
          pollingIntervals.current.delete(sceneId);

          setScenes(prev =>
            prev.map((s) =>
              s.id === sceneId ? { ...s, status: "failed" } : s
            )
          );

          toast.error(`Scene failed`);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 5000);

    pollingIntervals.current.set(sceneId, interval);
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setCompletedCount(0);

    setScenes(prev =>
      prev.map((s) =>
        s.selected ? { ...s, status: "generating" } : s
      )
    );

    try {
      const scenesToGenerate = selectedScenes.map((scene) => ({
        id: scene.id,
        order: scene.index + 1,
        prompt: scene.prompt,
        duration: Math.min(Math.max(scene.duration, 5), 8),
      }));

      const { data, error } = await supabase.functions.invoke("generate-batch-videos", {
        body: {
          scenes: scenesToGenerate,
          referenceImage: settings.referenceImage,
          preserveFace: settings.preserveFace,
          aspectRatio: settings.aspectRatio,
        },
      });

      if (error) throw error;

      if (data.operations) {
        setScenes(prev => prev.map((scene) => {
          const operation = data.operations.find(
            (op: any) => op.sceneId === scene.id || op.order === scene.index + 1
          );

          if (operation?.success && operation.requestId) {
            pollSceneStatus(scene.id, operation.requestId);
            return { ...scene, requestId: operation.requestId };
          }

          return scene;
        }));

        toast.success(`Started generating ${data.successCount} scenes!`);
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to start generation");

      setScenes(prev =>
        prev.map((s) =>
          s.selected ? { ...s, status: "pending" } : s
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyAudio = async () => {
    if (!audioFile) return;

    setIsMerging(true);
    const scenesToMerge = selectedScenes.filter((s) => s.videoUrl);

    try {
      const results = await batchMergeAudioWithVideos(
        scenesToMerge.map((s) => ({
          id: s.id,
          videoUrl: s.videoUrl!,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
        audioFile,
        (sceneId, progress) => {
          setMergeProgress((prev) => ({ ...prev, [sceneId]: progress }));
        }
      );

      results.forEach((result, i) => {
        downloadMergedVideo(result.blob, `scene-${i + 1}-with-audio.webm`);
      });

      toast.success(`${results.length} videos merged with audio!`);
    } catch (error) {
      console.error("Merge error:", error);
      toast.error("Failed to merge audio");
    } finally {
      setIsMerging(false);
      setMergeProgress({});
    }
  };

  const retryFailedScene = async (scene: Scene) => {
    setScenes(prev =>
      prev.map((s) =>
        s.id === scene.id ? { ...s, status: "generating" } : s
      )
    );

    try {
      const { data, error } = await supabase.functions.invoke("generate-batch-videos", {
        body: {
          scenes: [{
            id: scene.id,
            order: scene.index + 1,
            prompt: scene.prompt,
            duration: Math.min(Math.max(scene.duration, 5), 8),
          }],
          referenceImage: settings.referenceImage,
          preserveFace: settings.preserveFace,
          aspectRatio: settings.aspectRatio,
        },
      });

      if (error) throw error;

      if (data.operations?.[0]?.success) {
        pollSceneStatus(scene.id, data.operations[0].requestId);
        setScenes(prev =>
          prev.map((s) =>
            s.id === scene.id ? { ...s, requestId: data.operations[0].requestId } : s
          )
        );
        toast.success(`Retrying scene ${scene.index + 1}`);
      } else {
        throw new Error(data.operations?.[0]?.error || "Failed to retry");
      }
    } catch (error) {
      console.error("Retry error:", error);
      setScenes(prev =>
        prev.map((s) =>
          s.id === scene.id ? { ...s, status: "failed" } : s
        )
      );
      toast.error(`Failed to retry scene ${scene.index + 1}`);
    }
  };

  const toggleSelect = (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene) return;

    if (!scene.selected && selectedScenes.length >= maxScenes) {
      toast.error(`Maximum ${maxScenes} scenes can be selected`);
      return;
    }

    setScenes(prev =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  // Drag and drop state
  const [draggedScene, setDraggedScene] = useState<Scene | null>(null);
  const [dragOverSceneId, setDragOverSceneId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, scene: Scene) => {
    setDraggedScene(scene);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", scene.id);
  };

  const handleDragOver = (e: React.DragEvent, sceneId: string) => {
    e.preventDefault();
    if (draggedScene && draggedScene.id !== sceneId) {
      setDragOverSceneId(sceneId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetScene: Scene) => {
    e.preventDefault();
    if (!draggedScene || draggedScene.id === targetScene.id) {
      setDraggedScene(null);
      setDragOverSceneId(null);
      return;
    }

    setScenes(prev => {
      const newScenes = [...prev];
      const draggedIndex = newScenes.findIndex(s => s.id === draggedScene.id);
      const targetIndex = newScenes.findIndex(s => s.id === targetScene.id);
      
      const [removed] = newScenes.splice(draggedIndex, 1);
      newScenes.splice(targetIndex, 0, removed);
      
      return newScenes.map((scene, i) => ({ ...scene, index: i }));
    });

    setDraggedScene(null);
    setDragOverSceneId(null);
    toast.success("Scene reordered");
  };

  const handleDragEnd = () => {
    setDraggedScene(null);
    setDragOverSceneId(null);
  };

  const updatePrompt = (id: string, prompt: string) => {
    setScenes(prev =>
      prev.map((s) => (s.id === id ? { ...s, prompt } : s))
    );
  };

  const playSceneAudio = (scene: Scene) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playingSceneId === scene.id) {
      audio.pause();
      setPlayingSceneId(null);
      setIsPlaying(false);
    } else {
      audio.currentTime = scene.startTime;
      audio.play();
      setPlayingSceneId(scene.id);
      setIsPlaying(true);

      const checkEnd = setInterval(() => {
        if (audio.currentTime >= scene.endTime) {
          audio.pause();
          clearInterval(checkEnd);
          setPlayingSceneId(null);
          setIsPlaying(false);
        }
      }, 100);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const downloadAll = () => {
    selectedScenes
      .filter((s) => s.videoUrl)
      .forEach((scene) => {
        const link = document.createElement("a");
        link.href = scene.videoUrl!;
        link.download = `scene-${scene.index + 1}.mp4`;
        link.click();
      });
  };

  const hasAudio = audioUrl && scenes.length > 0;

  return (
    <div className="min-h-screen bg-sora pb-60">
      {/* Header Bar */}
      <div className="sticky top-0 z-40 bg-sora-elevated border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Left: Logo + Settings */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gradient-primary tracking-tight">
              VEOSTUDIO STORYBOARD
            </h1>
            
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2 btn-sora"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-sora-elevated border-l border-border">
                <SheetHeader>
                  <SheetTitle className="text-foreground">Project Settings</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <SetupPanel
                    settings={settings}
                    onSettingsChange={setSettings}
                    onNext={() => setSettingsOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Center: Status */}
          <div className="flex items-center gap-3">
            {isGeneratingPrompts && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Generating AI prompts...</span>
              </div>
            )}
            {anyGenerating && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-muted-foreground">
                  Generating {completedCount}/{selectedScenes.length}
                </span>
              </div>
            )}
            {isMerging && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Merging audio...</span>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {allCompleted && (
              <Button
                variant="outline"
                size="sm"
                onClick={downloadAll}
                className="btn-sora"
              >
                <Download className="w-4 h-4 mr-2" />
                Download All
              </Button>
            )}

            {hasAudio && !allCompleted && !anyGenerating && (
              <Button
                onClick={handleGenerate}
                size="sm"
                className="btn-gradient-primary px-5"
              >
                Generate Selected ({selectedScenes.length}/{maxScenes})
              </Button>
            )}

            {allCompleted && (
              <Button onClick={onComplete} size="sm" className="bg-green-600 hover:bg-green-700">
                Finish
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {anyGenerating && (
          <div className="px-6 pb-2">
            <Progress value={(completedCount / selectedScenes.length) * 100} className="h-1" />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {currentStep === "setup" && !hasAudio && (
          <div className="space-y-6">
            <SetupPanel
              settings={settings}
              onSettingsChange={setSettings}
              onNext={() => setCurrentStep("audio")}
            />
          </div>
        )}

        {currentStep === "audio" && !hasAudio && (
          <AudioUploadPanel
            clipDuration={settings.clipDuration}
            onAudioProcessed={handleAudioProcessed}
            onNext={() => setCurrentStep("timeline")}
            onBack={() => setCurrentStep("setup")}
          />
        )}

        {/* Scene Cards Strip */}
        {hasAudio && (
          <div className="space-y-6">
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4 scrollbar-sora" onDragEnd={handleDragEnd}>
                {scenes.map((scene) => (
                  <CompactSceneCard
                    key={scene.id}
                    scene={scene}
                    onToggleSelect={toggleSelect}
                    onUpdatePrompt={updatePrompt}
                    onPlayAudio={playSceneAudio}
                    onRetry={retryFailedScene}
                    isPlaying={playingSceneId === scene.id}
                    disabled={!scene.selected && selectedScenes.length >= maxScenes}
                    showVideo={scene.status === "completed"}
                    onDragStart={handleDragStart}
                    onDragOver={(e) => handleDragOver(e, scene.id)}
                    onDrop={handleDrop}
                    isDragging={draggedScene?.id === scene.id}
                    isDragOver={dragOverSceneId === scene.id}
                  />
                ))}
                
                {/* Add Scene Card */}
                <div className="add-scene-card h-[calc(112px+120px)]">
                  <Plus className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Add Scene</span>
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}

      {/* Sora-style Timeline */}
      {hasAudio && (
        <SoraTimeline
          scenes={scenes}
          fullWaveform={fullWaveform}
          audioDuration={audioDuration}
          audioUrl={audioUrl}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          onPlayPause={togglePlayPause}
          onSceneClick={(scene) => {
            handleSeek(scene.startTime);
            toggleSelect(scene.id);
          }}
        />
      )}
    </div>
  );
}

export default StoryboardEditor;