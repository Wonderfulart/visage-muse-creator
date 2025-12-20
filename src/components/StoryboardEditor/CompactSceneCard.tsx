import { useState } from "react";
import { Play, Pause, Check, Loader2, XCircle, RefreshCw, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Scene } from "./types";
import { formatTime } from "@/utils/audioSplitter";
import { cn } from "@/lib/utils";

interface CompactSceneCardProps {
  scene: Scene;
  onToggleSelect: (id: string) => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onPlayAudio?: (scene: Scene) => void;
  onRetry?: (scene: Scene) => void;
  isPlaying?: boolean;
  disabled?: boolean;
  showVideo?: boolean;
}

export function CompactSceneCard({
  scene,
  onToggleSelect,
  onUpdatePrompt,
  onPlayAudio,
  onRetry,
  isPlaying,
  disabled,
  showVideo = false,
}: CompactSceneCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.prompt);
  const [isHovering, setIsHovering] = useState(false);

  const handleSavePrompt = () => {
    onUpdatePrompt(scene.id, editedPrompt);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "group relative flex-shrink-0 w-48 rounded-lg overflow-hidden transition-all duration-200",
        "border bg-card/50 hover:bg-card/80",
        scene.selected
          ? "border-primary/60 ring-1 ring-primary/30"
          : "border-border/40 hover:border-border",
        disabled && "opacity-40 pointer-events-none"
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Video/Thumbnail Area */}
      <div className="aspect-video relative bg-secondary/50">
        {scene.videoUrl && showVideo ? (
          <video
            src={scene.videoUrl}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            autoPlay={isHovering}
            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
            onMouseLeave={(e) => {
              const video = e.currentTarget as HTMLVideoElement;
              video.pause();
              video.currentTime = 0;
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {scene.status === "generating" ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : scene.status === "completed" ? (
              <Check className="w-6 h-6 text-green-400" />
            ) : scene.status === "failed" ? (
              <div className="flex flex-col items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                {onRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRetry(scene)}
                    className="h-6 text-xs px-2"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            ) : (
              <span className="text-2xl font-bold text-muted-foreground/30">
                {scene.index + 1}
              </span>
            )}
          </div>
        )}

        {/* Mini Waveform */}
        {scene.audioSegment && (
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background/90 to-transparent">
            <div className="flex items-end h-full px-0.5 gap-[1px]">
              {scene.audioSegment.waveformData.slice(0, 30).map((value, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-t transition-colors",
                    scene.selected ? "bg-primary/70" : "bg-muted-foreground/40"
                  )}
                  style={{ height: `${value * 100}%` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Selection Checkbox */}
        <div className="absolute top-2 left-2">
          <Checkbox
            checked={scene.selected}
            onCheckedChange={() => onToggleSelect(scene.id)}
            disabled={disabled}
            className="bg-background/80 border-border/60"
          />
        </div>

        {/* Play Button */}
        {onPlayAudio && (
          <button
            onClick={() => onPlayAudio(scene)}
            className={cn(
              "absolute top-2 right-2 p-1.5 rounded-full transition-all",
              "bg-background/80 hover:bg-background text-foreground",
              "opacity-0 group-hover:opacity-100"
            )}
          >
            {isPlaying ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </button>
        )}

        {/* Status Badge */}
        {scene.status !== "pending" && (
          <div className="absolute top-2 right-2">
            {scene.status === "completed" && (
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-green-400" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-2 space-y-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            Scene {scene.index + 1}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {scene.duration.toFixed(1)}s
          </span>
        </div>

        {/* Time Range */}
        <div className="text-[10px] text-muted-foreground">
          {formatTime(scene.startTime)} → {formatTime(scene.endTime)}
        </div>

        {/* Prompt */}
        {isEditing ? (
          <div className="space-y-1">
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="text-[10px] min-h-[40px] resize-none p-1.5"
              placeholder="Scene prompt..."
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={handleSavePrompt}
                className="h-5 text-[10px] px-2"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditedPrompt(scene.prompt);
                  setIsEditing(false);
                }}
                className="h-5 text-[10px] px-2"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full text-left group/prompt"
          >
            <p className="text-[10px] text-muted-foreground line-clamp-2 group-hover/prompt:text-foreground transition-colors">
              {scene.prompt || "Click to add prompt..."}
            </p>
            <Edit2 className="w-2.5 h-2.5 mt-0.5 text-muted-foreground opacity-0 group-hover/prompt:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </div>
  );
}
