import { Video, Download, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GenerationStatusProps {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  aspectRatio?: string;
  className?: string;
  progress?: number;
  elapsedTime?: number;
}

const getAspectRatioClass = (ratio?: string) => {
  switch (ratio) {
    case '16:9': return 'aspect-video';
    case '9:16': return 'aspect-[9/16]';
    default: return 'aspect-video';
  }
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function GenerationStatus({ status, videoUrl, error, aspectRatio, className, progress = 0, elapsedTime = 0 }: GenerationStatusProps) {
  if (status === 'idle') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center p-8 bg-secondary/30 rounded-xl",
        getAspectRatioClass(aspectRatio),
        className
      )}>
        <div className="p-6 rounded-full bg-secondary/50 mb-4">
          <Video className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
          Ready to Create
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Upload a reference image and describe your music video to get started
        </p>
      </div>
    );
  }

  if (status === 'processing') {
    const estimatedTotal = 75; // Estimated 75 seconds for generation
    const remainingTime = Math.max(0, estimatedTotal - elapsedTime);
    
    return (
      <div className={cn(
        "flex flex-col items-center justify-center p-8 bg-secondary/30 rounded-xl",
        getAspectRatioClass(aspectRatio),
        className
      )}>
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/20 animate-pulse-glow flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/30 animate-pulse flex items-center justify-center">
              <Video className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-primary/50 animate-pulse-ring" />
        </div>
        
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
          Generating Your Video
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">
          Veo 3.1 is creating your music video with preserved facial features
        </p>

        {/* Progress Bar */}
        <div className="w-full max-w-xs space-y-2 mb-4">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-glow-secondary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress}%</span>
            <span>~{formatTime(remainingTime)} remaining</span>
          </div>
        </div>

        {/* Elapsed time */}
        <div className="text-xs text-muted-foreground">
          Elapsed: {formatTime(elapsedTime)}
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center p-8 bg-secondary/30 rounded-xl",
        getAspectRatioClass(aspectRatio),
        className
      )}>
        <div className="p-6 rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
          Generation Failed
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          {error || 'Something went wrong. Please try again.'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className={cn(
        "relative rounded-xl overflow-hidden border border-border/50 glow-primary",
        getAspectRatioClass(aspectRatio)
      )}>
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            className="w-full h-full object-contain bg-black"
            autoPlay
            loop
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <Video className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
      </div>
      
      {videoUrl && (
        <div className="flex gap-3 mt-4">
          <Button variant="glow" className="flex-1" asChild>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              Open Full Screen
            </a>
          </Button>
          <Button variant="hero" className="flex-1" asChild>
            <a href={videoUrl} download="music-video.mp4">
              <Download className="w-4 h-4" />
              Download
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
