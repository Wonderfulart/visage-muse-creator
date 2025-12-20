import { useState, useRef } from "react";
import { Play, Pause, Check, X, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Scene } from "./types";
import { formatTime } from "@/utils/audioSplitter";

interface SceneCardProps {
  scene: Scene;
  onToggleSelect: (id: string) => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onPlayAudio: (scene: Scene) => void;
  isPlaying: boolean;
  disabled?: boolean;
}

export function SceneCard({
  scene,
  onToggleSelect,
  onUpdatePrompt,
  onPlayAudio,
  isPlaying,
  disabled,
}: SceneCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.prompt);

  const handleSavePrompt = () => {
    onUpdatePrompt(scene.id, editedPrompt);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedPrompt(scene.prompt);
    setIsEditing(false);
  };

  const getStatusBadge = () => {
    switch (scene.status) {
      case "generating":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-green-500/20 text-green-400 border-green-500/30">
            <Check className="w-3 h-3" />
            Done
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <X className="w-3 h-3" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`relative flex flex-col rounded-xl border-2 transition-all ${
        scene.selected
          ? "border-primary bg-primary/5"
          : "border-border/50 bg-card/50 hover:border-border"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={scene.selected}
            onCheckedChange={() => onToggleSelect(scene.id)}
            disabled={disabled}
          />
          <span className="font-medium text-sm">Scene {scene.index + 1}</span>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPlayAudio(scene)}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Thumbnail / Video Preview */}
      <div className="aspect-video bg-secondary/30 relative overflow-hidden">
        {scene.videoUrl ? (
          <video
            src={scene.videoUrl}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
            onMouseLeave={(e) => {
              const video = e.currentTarget as HTMLVideoElement;
              video.pause();
              video.currentTime = 0;
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground/30">
                {scene.index + 1}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
              </div>
            </div>
          </div>
        )}

        {/* Mini Waveform */}
        {scene.audioSegment && (
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background/80 to-transparent">
            <div className="flex items-end h-full px-1 gap-[1px]">
              {scene.audioSegment.waveformData.slice(0, 50).map((value, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/60 rounded-t"
                  style={{ height: `${value * 100}%` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Prompt */}
      <div className="p-3 flex-1">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="text-xs min-h-[60px] resize-none"
              placeholder="Scene prompt..."
            />
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={handleSavePrompt} className="h-7 text-xs">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 text-xs">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="group">
            <p className="text-xs text-muted-foreground line-clamp-3">{scene.prompt}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 mt-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
        )}
      </div>

      {/* Time Range */}
      <div className="px-3 pb-3">
        <div className="text-[10px] text-muted-foreground text-center py-1 rounded bg-secondary/30">
          {formatTime(scene.startTime)} → {formatTime(scene.endTime)} ({scene.duration.toFixed(1)}s)
        </div>
      </div>
    </div>
  );
}
