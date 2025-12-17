import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface AudioTrimmerProps {
  duration: number;
  trimStart: number;
  trimEnd: number;
  onTrimStartChange: (value: number) => void;
  onTrimEndChange: (value: number) => void;
}

export const AudioTrimmer = ({
  duration,
  trimStart,
  trimEnd,
  onTrimStartChange,
  onTrimEndChange
}: AudioTrimmerProps) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const [mins, secsPart] = parts;
      const [secs, ms] = secsPart.split('.');
      return parseInt(mins) * 60 + parseInt(secs) + (parseInt(ms || '0') / 100);
    }
    return 0;
  };

  const trimDuration = trimEnd - trimStart;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Start Time */}
        <div className="space-y-2">
          <Label className="text-xs">Start Time</Label>
          <Input
            value={formatTime(trimStart)}
            onChange={(e) => {
              const time = parseTime(e.target.value);
              if (!isNaN(time) && time >= 0 && time < trimEnd) {
                onTrimStartChange(time);
              }
            }}
            className="font-mono text-sm"
          />
          <Slider
            value={[trimStart]}
            min={0}
            max={trimEnd - 0.5}
            step={0.1}
            onValueChange={([val]) => onTrimStartChange(val)}
          />
        </div>

        {/* End Time */}
        <div className="space-y-2">
          <Label className="text-xs">End Time</Label>
          <Input
            value={formatTime(trimEnd)}
            onChange={(e) => {
              const time = parseTime(e.target.value);
              if (!isNaN(time) && time > trimStart && time <= duration) {
                onTrimEndChange(time);
              }
            }}
            className="font-mono text-sm"
          />
          <Slider
            value={[trimEnd]}
            min={trimStart + 0.5}
            max={duration}
            step={0.1}
            onValueChange={([val]) => onTrimEndChange(val)}
          />
        </div>
      </div>

      {/* Duration Info */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div className="text-sm">
          <span className="text-muted-foreground">Selection: </span>
          <span className="font-mono font-medium">{formatTime(trimDuration)}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Original: </span>
          <span className="font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            onTrimStartChange(0);
            onTrimEndChange(duration);
          }}
          className="text-xs text-primary hover:underline"
        >
          Reset to full
        </button>
        <span className="text-muted-foreground">•</span>
        <button
          onClick={() => {
            onTrimStartChange(0);
            onTrimEndChange(Math.min(30, duration));
          }}
          className="text-xs text-primary hover:underline"
        >
          First 30s
        </button>
        <span className="text-muted-foreground">•</span>
        <button
          onClick={() => {
            onTrimStartChange(Math.max(0, duration - 30));
            onTrimEndChange(duration);
          }}
          className="text-xs text-primary hover:underline"
        >
          Last 30s
        </button>
      </div>
    </div>
  );
};
