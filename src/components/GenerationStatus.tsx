import { Video, Download, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GenerationStatusProps {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  className?: string;
}

export function GenerationStatus({ status, videoUrl, error, className }: GenerationStatusProps) {
  if (status === 'idle') {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full min-h-[300px] p-8", className)}>
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
    return (
      <div className={cn("flex flex-col items-center justify-center h-full min-h-[300px] p-8", className)}>
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
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full min-h-[300px] p-8", className)}>
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
    <div className={cn("flex flex-col h-full min-h-[300px]", className)}>
      <div className="flex-1 relative rounded-xl overflow-hidden border border-border/50 glow-primary">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            className="w-full h-full object-cover"
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
