import { useState } from 'react';
import { X, Play, Volume2, VolumeX, Maximize2, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoVideoModal = ({ isOpen, onClose }: DemoVideoModalProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Demo video URL - replace with actual demo video
  const demoVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

  const handlePlayPause = () => {
    const video = document.getElementById('demo-video') as HTMLVideoElement;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = () => {
    const video = document.getElementById('demo-video') as HTMLVideoElement;
    if (video) {
      video.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    const video = document.getElementById('demo-video') as HTMLVideoElement;
    if (video) {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      }
    }
  };

  const handleClose = () => {
    const video = document.getElementById('demo-video') as HTMLVideoElement;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setIsPlaying(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={handleClose}
    >
      <div 
        className="relative w-full max-w-5xl mx-4 aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {/* Video */}
        <video
          id="demo-video"
          src={demoVideoUrl}
          className="w-full h-full object-contain"
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Play button overlay (when not playing) */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <button
              onClick={handlePlayPause}
              className="w-20 h-20 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center transition-all hover:scale-110"
            >
              <Play className="w-8 h-8 text-primary-foreground ml-1" />
            </button>
          </div>
        )}

        {/* Controls overlay */}
        <div 
          className={cn(
            "absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePlayPause}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMuteToggle}
                className="text-white hover:bg-white/20"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
            </div>

            <div className="text-white text-sm font-medium">
              VeoStudio Pro Demo
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleFullscreen}
              className="text-white hover:bg-white/20"
            >
              <Maximize2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full"
        >
          <X className="w-6 h-6" />
        </Button>

        {/* Feature highlights (shown before playing) */}
        {!isPlaying && (
          <div className="absolute bottom-20 left-0 right-0 px-8">
            <div className="flex justify-center gap-4 flex-wrap">
              {['Lyrics Sync', 'Batch Generation', 'Video Stitching', 'AI Templates'].map((feature) => (
                <span
                  key={feature}
                  className="px-3 py-1 rounded-full bg-white/10 text-white text-sm backdrop-blur-sm"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-8 text-center text-muted-foreground text-sm">
        Press <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground">ESC</kbd> or click outside to close
      </div>
    </div>
  );
};
