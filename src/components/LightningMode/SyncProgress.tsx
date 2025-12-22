import { Loader2, Check, AlertCircle, Music } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { LightningClip } from "./ClipCard";
import { cn } from "@/lib/utils";

interface SyncProgressProps {
  clips: LightningClip[];
  currentSyncIndex: number;
  isComplete: boolean;
}

export function SyncProgress({ clips, currentSyncIndex, isComplete }: SyncProgressProps) {
  const completedCount = clips.filter(c => c.status === 'complete').length;
  const progress = (completedCount / clips.length) * 100;

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "p-2 rounded-lg",
          isComplete ? "bg-green-500/20" : "bg-primary/20"
        )}>
          <Music className={cn(
            "w-5 h-5",
            isComplete ? "text-green-500" : "text-primary"
          )} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            {isComplete ? "Sync Complete!" : "Syncing Audio to Videos"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isComplete 
              ? "All clips have been synced with audio"
              : `Processing clip ${currentSyncIndex + 1} of ${clips.length}`
            }
          </p>
        </div>
      </div>

      <Progress value={progress} className="h-2 mb-4" />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {clips.map((clip, index) => (
          <div
            key={clip.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg text-sm",
              clip.status === 'complete' && "bg-green-500/10 text-green-500",
              clip.status === 'syncing' && "bg-blue-500/10 text-blue-500",
              clip.status === 'error' && "bg-destructive/10 text-destructive",
              clip.status !== 'complete' && clip.status !== 'syncing' && clip.status !== 'error' && "bg-muted/50 text-muted-foreground"
            )}
          >
            {clip.status === 'complete' ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : clip.status === 'syncing' ? (
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            ) : clip.status === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-current flex-shrink-0" />
            )}
            <span className="truncate">Clip {index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
