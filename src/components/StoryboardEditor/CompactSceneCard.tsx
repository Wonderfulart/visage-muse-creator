import { useState } from "react";
import { Play, Pause, Check, Loader2, XCircle, RefreshCw, GripVertical, Music } from "lucide-react";
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
  onDragStart?: (e: React.DragEvent, scene: Scene) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, scene: Scene) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}

// Gradient classes for scene thumbnails
const gradientClasses = [
  "scene-gradient-1",
  "scene-gradient-2",
  "scene-gradient-3",
  "scene-gradient-4",
];

export function CompactSceneCard({
  scene,
  onToggleSelect,
  onUpdatePrompt,
  onPlayAudio,
  onRetry,
  isPlaying,
  disabled,
  showVideo = false,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  isDragOver,
}: CompactSceneCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.prompt);
  const [isHovering, setIsHovering] = useState(false);

  const handleSavePrompt = () => {
    onUpdatePrompt(scene.id, editedPrompt);
    setIsEditing(false);
  };

  const gradientClass = gradientClasses[scene.index % gradientClasses.length];

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => onDragStart?.(e, scene)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => onDrop?.(e, scene)}
      className={cn(
        "group relative flex-shrink-0 w-[200px] rounded-xl overflow-hidden transition-all duration-300",
        "border bg-card cursor-grab active:cursor-grabbing scene-card-hover",
        scene.selected
          ? "border-primary selected-glow"
          : "border-border/40 hover:border-primary",
        disabled && "opacity-40 pointer-events-none",
        isDragging && "opacity-50 scale-95",
        isDragOver && "ring-2 ring-primary border-primary"
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Thumbnail Area - 16:9 aspect ratio */}
      <div className={cn("w-[200px] h-[112px] relative overflow-hidden", gradientClass)}>
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
              <Loader2 className="w-8 h-8 animate-spin text-white/80" />
            ) : scene.status === "completed" ? (
              <Check className="w-8 h-8 text-white" />
            ) : scene.status === "failed" ? (
              <div className="flex flex-col items-center gap-2">
                <XCircle className="w-6 h-6 text-white/80" />
                {onRetry && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry(scene);
                    }}
                    className="h-6 text-xs px-2 bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Play Icon Overlay - appears on hover */}
        {onPlayAudio && scene.status !== "generating" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayAudio(scene);
            }}
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity",
              "bg-black/40 backdrop-blur-sm",
              isHovering && !scene.videoUrl ? "opacity-100" : "opacity-0"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-4 h-4 text-white" />
              ) : (
                <Play className="w-4 h-4 text-white ml-0.5" />
              )}
            </div>
          </button>
        )}

        {/* Selection Checkbox */}
        <div className="absolute top-2 left-2">
          <Checkbox
            checked={scene.selected}
            onCheckedChange={() => onToggleSelect(scene.id)}
            disabled={disabled}
            className="bg-black/60 border-white/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>

        {/* Drag Handle */}
        <div className="absolute top-2 right-2 p-1 rounded bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical className="w-3 h-3 text-white/80" />
        </div>
      </div>

      {/* Info Section */}
      <div className="p-3 space-y-2">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">
            Scene {scene.index + 1}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            {formatTime(scene.startTime)}-{Math.round(scene.duration)}s
          </span>
        </div>

        {/* Icons Row */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-secondary/80 flex items-center justify-center">
            <Play className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="w-5 h-5 rounded bg-secondary/80 flex items-center justify-center">
            <Music className="w-3 h-3 text-muted-foreground" />
          </div>
          {scene.status === "completed" && (
            <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center ml-auto">
              <Check className="w-3 h-3 text-green-400" />
            </div>
          )}
        </div>

        {/* Prompt */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="text-[11px] min-h-[50px] resize-none p-2 bg-secondary/50 border-border"
              placeholder="Scene prompt..."
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={handleSavePrompt}
                className="h-6 text-[10px] px-2 btn-gradient-primary"
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
                className="h-6 text-[10px] px-2"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            "{scene.prompt || "Click Edit to add prompt..."}"
          </p>
        )}

        {/* Edit Button */}
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="w-full h-7 text-[11px] bg-secondary/30 border-border/50 hover:bg-secondary hover:border-primary"
          >
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}