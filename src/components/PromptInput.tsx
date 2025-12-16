import { useState } from 'react';
import { Wand2, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PromptInput({ value, onChange, className }: PromptInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const { toast } = useToast();

  const suggestions = [
    "Cinematic slow-mo walking through neon-lit streets",
    "Dancing in the rain with dramatic lighting",
    "Performing on stage with crowd energy",
    "Driving through a desert at golden hour",
  ];

  const handleEnhancePrompt = async () => {
    if (!value.trim()) {
      toast({
        title: "No prompt to enhance",
        description: "Please enter a prompt first",
        variant: "destructive",
      });
      return;
    }

    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enhance-prompt', {
        body: { prompt: value },
      });

      if (error) throw error;

      if (data?.enhancedPrompt) {
        onChange(data.enhancedPrompt);
        toast({
          title: "Prompt enhanced",
          description: "Your prompt has been improved with cinematic details",
        });
      }
    } catch (error: any) {
      console.error('Error enhancing prompt:', error);
      toast({
        title: "Enhancement failed",
        description: error.message || "Failed to enhance prompt",
        variant: "destructive",
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          Video Prompt
        </label>
        <button
          onClick={handleEnhancePrompt}
          disabled={isEnhancing || !value.trim()}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all",
            "bg-primary/10 text-primary border border-primary/20",
            "hover:bg-primary/20 hover:border-primary/40",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isEnhancing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {isEnhancing ? "Enhancing..." : "Enhance with AI"}
        </button>
      </div>
      
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
