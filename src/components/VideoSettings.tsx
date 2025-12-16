import { Settings, Clock, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoSettingsProps {
  duration: number;
  aspectRatio: string;
  preserveFace: boolean;
  onDurationChange: (duration: number) => void;
  onAspectRatioChange: (ratio: string) => void;
  onPreserveFaceChange: (preserve: boolean) => void;
  className?: string;
}

export function VideoSettings({
  duration,
  aspectRatio,
  preserveFace,
  onDurationChange,
  onAspectRatioChange,
  onPreserveFaceChange,
  className
}: VideoSettingsProps) {
  const durations = [5, 6, 8];
  const aspectRatios = [
    { value: '16:9', label: 'Landscape' },
    { value: '9:16', label: 'Portrait' },
  ];

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Video Settings</h3>
      </div>

      {/* Duration */}
      <div className="space-y-3">
        <label className="text-xs text-muted-foreground flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Duration
        </label>
        <div className="flex gap-2">
          {durations.map((d) => (
            <button
              key={d}
              onClick={() => onDurationChange(d)}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
                duration === d
                  ? "bg-primary text-primary-foreground glow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-3">
        <label className="text-xs text-muted-foreground flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5" />
          Aspect Ratio
        </label>
        <div className="grid grid-cols-2 gap-2">
          {aspectRatios.map((ratio) => (
            <button
              key={ratio.value}
              onClick={() => onAspectRatioChange(ratio.value)}
              className={cn(
                "py-2.5 rounded-lg text-sm transition-all",
                aspectRatio === ratio.value
                  ? "bg-primary text-primary-foreground glow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="font-medium">{ratio.value}</span>
              <span className="block text-[10px] opacity-70 mt-0.5">{ratio.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Face Preservation Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border/50">
        <div>
          <p className="text-sm font-medium text-foreground">Preserve Facial Features</p>
          <p className="text-xs text-muted-foreground mt-0.5">Strictly maintain reference face</p>
        </div>
        <button
          onClick={() => onPreserveFaceChange(!preserveFace)}
          className={cn(
            "relative w-12 h-6 rounded-full transition-all",
            preserveFace ? "bg-primary" : "bg-muted"
          )}
        >
          <div
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-foreground transition-all",
              preserveFace ? "left-7" : "left-1"
            )}
          />
        </button>
      </div>
    </div>
  );
}
