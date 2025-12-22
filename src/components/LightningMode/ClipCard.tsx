import { useState } from "react";
import { Play, RefreshCw, Check, Loader2, AlertCircle, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface LightningClip {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  prompt: string;
  originalPrompt: string;
  videoUrl: string | null;
  syncedVideoUrl: string | null;
  status: 'pending' | 'generating' | 'video_ready' | 'syncing' | 'complete' | 'error';
  error?: string;
  requestId?: string;
}

interface ClipCardProps {
  clip: LightningClip;
  onGenerate: (clipId: string) => void;
  onRegenerate: (clipId: string, newPrompt: string) => void;
  onPromptChange: (clipId: string, newPrompt: string) => void;
  disabled?: boolean;
}

const statusConfig = {
  pending: { label: "Ready", color: "bg-muted text-muted-foreground", icon: null },
  generating: { label: "Generating...", color: "bg-yellow-500/20 text-yellow-500", icon: Loader2 },
  video_ready: { label: "Video Ready", color: "bg-green-500/20 text-green-500", icon: Check },
  syncing: { label: "Syncing...", color: "bg-blue-500/20 text-blue-500", icon: Loader2 },
  complete: { label: "Complete", color: "bg-primary/20 text-primary", icon: Check },
  error: { label: "Error", color: "bg-destructive/20 text-destructive", icon: AlertCircle },
};

export function ClipCard({ clip, onGenerate, onRegenerate, onPromptChange, disabled }: ClipCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(clip.prompt);
  
  const status = statusConfig[clip.status];
  const StatusIcon = status.icon;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSavePrompt = () => {
    onPromptChange(clip.id, editedPrompt);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedPrompt(clip.prompt);
    setIsEditing(false);
  };

  const handleRegenerate = () => {
    onRegenerate(clip.id, editedPrompt);
  };

  return (
    <div className={cn(
      "relative rounded-xl border bg-card p-4 transition-all",
      clip.status === 'generating' && "border-yellow-500/50 shadow-lg shadow-yellow-500/10",
      clip.status === 'video_ready' && "border-green-500/50",
      clip.status === 'complete' && "border-primary/50 shadow-lg shadow-primary/10",
      clip.status === 'error' && "border-destructive/50",
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Clip {clip.index + 1}
          </span>
          <span className="text-xs text-muted-foreground/70">
            {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
          </span>
        </div>
        <Badge className={cn("text-xs", status.color)}>
          {StatusIcon && <StatusIcon className={cn("w-3 h-3 mr-1", clip.status === 'generating' || clip.status === 'syncing' ? "animate-spin" : "")} />}
          {status.label}
        </Badge>
      </div>

      {/* Video Preview or Placeholder */}
      <div className="aspect-video bg-muted/50 rounded-lg mb-3 overflow-hidden relative">
        {clip.videoUrl ? (
          <video 
            src={clip.videoUrl} 
            className="w-full h-full object-cover"
            controls
            muted
          />
        ) : clip.status === 'generating' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Generating with Veo 3.1...</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Prompt Section */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">Prompt</span>
          {!isEditing && clip.status !== 'generating' && clip.status !== 'syncing' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
        
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="text-sm min-h-[80px] resize-none"
              placeholder="Describe the visual scene..."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSavePrompt} className="h-7">
                <Save className="w-3 h-3 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7">
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground/80 line-clamp-3">{clip.prompt}</p>
        )}
      </div>

      {/* Error Message */}
      {clip.error && (
        <div className="mb-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{clip.error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {clip.status === 'pending' && (
          <Button
            onClick={() => onGenerate(clip.id)}
            disabled={disabled}
            className="flex-1"
            size="sm"
          >
            <Play className="w-4 h-4 mr-1" />
            Generate
          </Button>
        )}
        
        {(clip.status === 'video_ready' || clip.status === 'error') && (
          <Button
            onClick={handleRegenerate}
            disabled={disabled}
            variant="outline"
            className="flex-1"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Regenerate
          </Button>
        )}

        {clip.status === 'complete' && (
          <Button
            variant="outline"
            className="flex-1"
            size="sm"
            disabled
          >
            <Check className="w-4 h-4 mr-1" />
            Synced
          </Button>
        )}
      </div>
    </div>
  );
}
