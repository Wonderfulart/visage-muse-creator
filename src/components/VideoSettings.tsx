import { Settings, Clock, Monitor, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';

type FaceConsistencyLevel = 'strict' | 'moderate' | 'loose';

interface VideoSettingsProps {
  duration: number;
  aspectRatio: string;
  preserveFace: boolean;
  sceneExtension: boolean;
  faceConsistencyLevel: FaceConsistencyLevel;
  onDurationChange: (duration: number) => void;
  onAspectRatioChange: (ratio: string) => void;
  onPreserveFaceChange: (preserve: boolean) => void;
  onSceneExtensionChange: (extend: boolean) => void;
  onFaceConsistencyLevelChange: (level: FaceConsistencyLevel) => void;
  className?: string;
}

const faceConsistencyOptions: { value: FaceConsistencyLevel; label: string; description: string }[] = [
  { value: 'strict', label: 'Strict', description: '100% identity lock' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced preservation' },
  { value: 'loose', label: 'Loose', description: 'Creative flexibility' },
];

export function VideoSettings({
  duration,
  aspectRatio,
  preserveFace,
  sceneExtension,
  faceConsistencyLevel,
  onDurationChange,
  onAspectRatioChange,
  onPreserveFaceChange,
  onSceneExtensionChange,
  onFaceConsistencyLevelChange,
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
      <div className="space-y-3">
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

        {/* Face Consistency Level - Only show when preserveFace is enabled */}
        {preserveFace && (
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/30 space-y-3 animate-fade-in">
            <label className="text-xs text-muted-foreground">Face Consistency Level</label>
            <div className="grid grid-cols-3 gap-2">
              {faceConsistencyOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onFaceConsistencyLevelChange(option.value)}
                  className={cn(
                    "py-2.5 px-3 rounded-lg text-sm transition-all",
                    faceConsistencyLevel === option.value
                      ? "bg-primary text-primary-foreground glow-sm"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="block text-[10px] opacity-70 mt-0.5">{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scene Extension Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border/50">
        <div className="flex items-start gap-3">
          <Repeat className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Scene Extension</p>
            <p className="text-xs text-muted-foreground mt-0.5">Extend and loop the generated scene</p>
          </div>
        </div>
        <button
          onClick={() => onSceneExtensionChange(!sceneExtension)}
          className={cn(
            "relative w-12 h-6 rounded-full transition-all",
            sceneExtension ? "bg-primary" : "bg-muted"
          )}
        >
          <div
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-foreground transition-all",
              sceneExtension ? "left-7" : "left-1"
            )}
          />
        </button>
      </div>
    </div>
  );
}
