import { useState } from 'react';
import { Music, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LyricsInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function LyricsInput({ value, onChange, className }: LyricsInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={cn("space-y-3", className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" />
          Lyrics (Optional)
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className={cn(
          "relative rounded-xl transition-all duration-300 animate-fade-in",
          isFocused && "glow-sm"
        )}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Paste song lyrics to sync visuals with your music..."
            rows={4}
            className={cn(
              "w-full px-4 py-3 rounded-xl bg-card border resize-none transition-all",
              "placeholder:text-muted-foreground text-foreground text-sm",
              "focus:outline-none focus:ring-0",
              isFocused ? "border-primary/50" : "border-border"
            )}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Adding lyrics helps the AI match visual transitions to your song's rhythm and mood.
          </p>
        </div>
      )}
    </div>
  );
}
