import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PromptInput({ value, onChange, className }: PromptInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const suggestions = [
    "Cinematic slow-mo walking through neon-lit streets",
    "Dancing in the rain with dramatic lighting",
    "Performing on stage with crowd energy",
    "Driving through a desert at golden hour",
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <label className="text-sm font-medium text-foreground flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-primary" />
        Video Prompt
      </label>
      
      <div className={cn(
        "relative rounded-xl transition-all duration-300",
        isFocused && "glow-sm"
      )}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Describe your music video scene in detail..."
          rows={4}
          className={cn(
            "w-full px-4 py-3 rounded-xl bg-card border resize-none transition-all",
            "placeholder:text-muted-foreground text-foreground",
            "focus:outline-none focus:ring-0",
            isFocused ? "border-primary/50" : "border-border"
          )}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onChange(suggestion)}
            className="px-3 py-1.5 text-xs rounded-full bg-secondary/50 border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-secondary transition-all"
          >
            {suggestion.slice(0, 30)}...
          </button>
        ))}
      </div>
    </div>
  );
}
