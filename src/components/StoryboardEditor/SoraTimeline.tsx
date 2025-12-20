import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Scene } from "./types";
import { formatTime } from "@/utils/audioSplitter";
import { cn } from "@/lib/utils";

interface SoraTimelineProps {
  scenes: Scene[];
  fullWaveform: number[];
  audioDuration: number;
  audioUrl: string;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onPlayPause: () => void;
  onSceneClick?: (scene: Scene) => void;
}

export function SoraTimeline({
  scenes,
  fullWaveform,
  audioDuration,
  audioUrl,
  currentTime,
  isPlaying,
  onSeek,
  onPlayPause,
  onSceneClick,
}: SoraTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);

  const selectedScenes = useMemo(() => scenes.filter(s => s.selected), [scenes]);
  const totalDuration = useMemo(() => {
    return selectedScenes.reduce((acc, s) => acc + s.duration, 0);
  }, [selectedScenes]);
  
  const estimatedMinutes = useMemo(() => {
    return Math.ceil(selectedScenes.length * 2);
  }, [selectedScenes.length]);

  // Sample waveform to 80 bars for div-based rendering
  const waveformBars = useMemo(() => {
    const barCount = 80;
    if (fullWaveform.length === 0) return Array(barCount).fill(0.3);
    
    const step = fullWaveform.length / barCount;
    return Array.from({ length: barCount }, (_, i) => {
      const start = Math.floor(i * step);
      const end = Math.floor((i + 1) * step);
      const segment = fullWaveform.slice(start, end);
      return segment.length > 0 
        ? segment.reduce((a, b) => a + b, 0) / segment.length 
        : 0.3;
    });
  }, [fullWaveform]);

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const markers: string[] = [];
    const interval = 8; // 8 second intervals
    for (let t = 0; t <= audioDuration; t += interval) {
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      markers.push(`${mins}:${secs.toString().padStart(2, '0')}`);
    }
    return markers;
  }, [audioDuration]);

  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * audioDuration;
    onSeek(Math.max(0, Math.min(time, audioDuration)));
  }, [audioDuration, onSeek]);

  const playheadPosition = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  const skipBackward = () => onSeek(Math.max(0, currentTime - 5));
  const skipForward = () => onSeek(Math.min(audioDuration, currentTime + 5));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-sora-elevated border-t border-border">
      {/* Waveform Container */}
      <div className="px-6 pt-6">
        <div 
          ref={containerRef}
          className="relative h-20 timeline-track cursor-pointer overflow-hidden"
          onClick={handleWaveformClick}
        >
          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 playhead-glow"
            style={{ left: `${playheadPosition}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow-lg" />
          </div>

          {/* Waveform Bars */}
          <div className="flex items-center h-full gap-[2px] px-3">
            {waveformBars.map((value, i) => {
              const barTime = (i / waveformBars.length) * audioDuration;
              const isPast = barTime < currentTime;
              const scene = scenes.find(s => barTime >= s.startTime && barTime < s.endTime);
              const isSelected = scene?.selected;
              
              // Vary heights for visual interest
              const baseHeight = value * 0.7;
              const heightMultiplier = 
                i % 7 === 0 ? 0.8 :
                i % 5 === 0 ? 0.6 :
                i % 3 === 0 ? 0.7 :
                i % 2 === 0 ? 0.5 : 0.3;
              const height = Math.max(baseHeight + heightMultiplier * 0.3, 0.15) * 100;

              return (
                <div
                  key={i}
                  className={cn(
                    "wave-bar rounded-sm transition-all duration-150",
                    isPast && (isSelected ? "active" : "bg-muted-foreground/50")
                  )}
                  style={{ 
                    height: `${height}%`,
                    opacity: isPast ? 1 : isSelected ? 0.5 : 0.3
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Time Ruler */}
        <div className="flex justify-between px-3 py-2">
          {timeMarkers.map((marker, i) => (
            <span key={i} className="text-[11px] text-muted-foreground font-mono">
              {marker}
            </span>
          ))}
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-3 py-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg bg-secondary/50 border border-border hover:bg-secondary hover:border-primary"
          onClick={skipBackward}
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        
        <Button
          size="icon"
          className="h-12 w-12 rounded-lg btn-gradient-primary"
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg bg-secondary/50 border border-border hover:bg-secondary hover:border-primary"
          onClick={skipForward}
        >
          <SkipForward className="w-4 h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg bg-secondary/50 border border-border hover:bg-secondary"
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="mx-6 mb-6 summary-bar p-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          📋 Summary:{" "}
          <span className="text-foreground font-semibold">
            {selectedScenes.length} scenes selected
          </span>
          {" • "}
          <span className="text-foreground font-semibold">
            {Math.round(totalDuration)}s total
          </span>
          {" • "}
          ~{estimatedMinutes} min to generate
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-muted-foreground">
            <span className="text-foreground">{formatTime(currentTime)}</span>
            <span className="mx-1">/</span>
            {formatTime(audioDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}