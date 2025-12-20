import { useState, useEffect, useRef } from "react";
import { Wand2, Download, Loader2, CheckCircle, XCircle, Music, Play, Pause, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Scene, StoryboardSettings } from "./types";
import { formatTime } from "@/utils/audioSplitter";

interface GenerationPanelProps {
  scenes: Scene[];
  settings: StoryboardSettings;
  audioUrl: string;
  onScenesChange: (scenes: Scene[]) => void;
  onBack: () => void;
  onComplete: () => void;
}

export function GenerationPanel({
  scenes,
  settings,
  audioUrl,
  onScenesChange,
  onBack,
  onComplete,
}: GenerationPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingAudio, setIsApplyingAudio] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const pollingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const audioRef = useRef<HTMLAudioElement>(null);

  const selectedScenes = scenes.filter((s) => s.selected);
  const allCompleted = selectedScenes.every((s) => s.status === "completed");
  const anyGenerating = selectedScenes.some((s) => s.status === "generating");

  useEffect(() => {
    return () => {
      // Cleanup polling intervals
      pollingIntervals.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  const pollSceneStatus = (sceneId: string, requestId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-video-status", {
          body: { requestId },
        });

        if (error) {
          console.error(`Polling error for scene ${sceneId}:`, error);
          return;
        }

        if (data.status === "completed" && data.videoUrl) {
          clearInterval(interval);
          pollingIntervals.current.delete(sceneId);

          onScenesChange(
            scenes.map((s) =>
              s.id === sceneId ? { ...s, status: "completed", videoUrl: data.videoUrl } : s
            )
          );

          setCompletedCount((prev) => prev + 1);
          toast.success(`Scene ${scenes.find((s) => s.id === sceneId)?.index! + 1} completed!`);
        } else if (data.status === "failed") {
          clearInterval(interval);
          pollingIntervals.current.delete(sceneId);

          onScenesChange(
            scenes.map((s) =>
              s.id === sceneId ? { ...s, status: "failed" } : s
            )
          );

          toast.error(`Scene ${scenes.find((s) => s.id === sceneId)?.index! + 1} failed`);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 5000);

    pollingIntervals.current.set(sceneId, interval);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setCompletedCount(0);

    // Mark all selected as generating
    onScenesChange(
      scenes.map((s) =>
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
        // Update scenes with request IDs and start polling
        const updatedScenes = scenes.map((scene) => {
          const operation = data.operations.find(
            (op: any) => op.sceneId === scene.id || op.order === scene.index + 1
          );

          if (operation?.success && operation.requestId) {
            pollSceneStatus(scene.id, operation.requestId);
            return { ...scene, requestId: operation.requestId };
          }

          return scene;
        });

        onScenesChange(updatedScenes);
        toast.success(`Started generating ${data.successCount} scenes!`);
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to start generation");

      // Reset status
      onScenesChange(
        scenes.map((s) =>
          s.selected ? { ...s, status: "pending" } : s
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyAudio = async () => {
    setIsApplyingAudio(true);
    toast.info("Audio overlay feature coming soon - videos generated without audio for now");
    setIsApplyingAudio(false);
  };

  const retryFailedScene = async (scene: Scene) => {
    // Mark as generating
    onScenesChange(
      scenes.map((s) =>
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
        onScenesChange(
          scenes.map((s) =>
            s.id === scene.id ? { ...s, requestId: data.operations[0].requestId } : s
          )
        );
        toast.success(`Retrying scene ${scene.index + 1}`);
      } else {
        throw new Error(data.operations?.[0]?.error || "Failed to retry");
      }
    } catch (error) {
      console.error("Retry error:", error);
      onScenesChange(
        scenes.map((s) =>
          s.id === scene.id ? { ...s, status: "failed" } : s
        )
      );
      toast.error(`Failed to retry scene ${scene.index + 1}`);
    }
  };

  const playScene = (scene: Scene) => {
    const audio = audioRef.current;
    if (!audio || !scene.videoUrl) return;

    if (playingId === scene.id) {
      setPlayingId(null);
    } else {
      audio.currentTime = scene.startTime;
      audio.play();
      setPlayingId(scene.id);

      // Stop at scene end
      const checkEnd = setInterval(() => {
        if (audio.currentTime >= scene.endTime) {
          audio.pause();
          clearInterval(checkEnd);
          setPlayingId(null);
        }
      }, 100);
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-primary">
            <Wand2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Generate & Export</h2>
            <p className="text-sm text-muted-foreground">
              {allCompleted
                ? "All scenes completed! Apply audio and download."
                : anyGenerating
                ? `Generating... ${completedCount}/${selectedScenes.length} complete`
                : `Ready to generate ${selectedScenes.length} scenes`}
            </p>
          </div>
        </div>

        {allCompleted && (
          <Button onClick={downloadAll} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download All
          </Button>
        )}
      </div>

      {/* Progress Overview */}
      {anyGenerating && (
        <div className="card-elevated rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Generation Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedCount}/{selectedScenes.length}
            </span>
          </div>
          <Progress value={(completedCount / selectedScenes.length) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Estimated time: ~{(selectedScenes.length - completedCount) * 2} minutes remaining
          </p>
        </div>
      )}

      {/* Scene Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {selectedScenes.map((scene) => (
          <div
            key={scene.id}
            className="card-elevated rounded-xl overflow-hidden"
          >
            {/* Video Preview */}
            <div className="aspect-video bg-secondary/30 relative group">
              {scene.videoUrl ? (
                <>
                  <video
                    src={scene.videoUrl}
                    className="w-full h-full object-cover"
                    muted={playingId !== scene.id}
                    loop
                    playsInline
                    autoPlay={playingId === scene.id}
                  />
                  <button
                    onClick={() => playScene(scene)}
                    className="absolute inset-0 flex items-center justify-center bg-background/30 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {playingId === scene.id ? (
                      <Pause className="w-8 h-8 text-white" />
                    ) : (
                      <Play className="w-8 h-8 text-white" />
                    )}
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  {scene.status === "generating" ? (
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  ) : scene.status === "failed" ? (
                    <>
                      <XCircle className="w-6 h-6 text-destructive" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryFailedScene(scene)}
                        className="text-xs h-7"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    </>
                  ) : (
                    <span className="text-3xl font-bold text-muted-foreground/20">
                      {scene.index + 1}
                    </span>
                  )}
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                {scene.status === "completed" && (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                )}
                {scene.status === "failed" && (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
              </div>
            </div>

            {/* Scene Info */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Scene {scene.index + 1}</span>
                <Badge
                  variant={
                    scene.status === "completed"
                      ? "default"
                      : scene.status === "failed"
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-[10px]"
                >
                  {scene.status}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Audio overlay for preview */}
      <audio ref={audioRef} src={audioUrl} />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button variant="outline" onClick={onBack} disabled={anyGenerating}>
          Back to Timeline
        </Button>

        <div className="flex-1" />

        {!allCompleted && !anyGenerating && (
          <Button
            onClick={handleGenerate}
            variant="hero"
            size="lg"
            className="min-w-[200px]"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Generate {selectedScenes.length} Scenes
          </Button>
        )}

        {allCompleted && (
          <>
            <Button
              onClick={handleApplyAudio}
              disabled={isApplyingAudio}
              variant="outline"
              size="lg"
            >
              <Music className="w-4 h-4 mr-2" />
              {isApplyingAudio ? "Applying..." : "Apply Audio"}
            </Button>
            <Button onClick={onComplete} variant="hero" size="lg">
              <CheckCircle className="w-4 h-4 mr-2" />
              Finish
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
