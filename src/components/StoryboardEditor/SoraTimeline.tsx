import { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Scene } from "./types";
import { formatTime } from "@/utils/audioSplitter";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);

  // Draw waveform
  useEffect(() => {
    if (!canvasRef.current || fullWaveform.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const barWidth = Math.max(width / fullWaveform.length, 2);
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    fullWaveform.forEach((value, i) => {
      const barHeight = value * height * 0.75;
      const x = i * barWidth;
      const time = (i / fullWaveform.length) * audioDuration;
      const scene = scenes.find((s) => time >= s.startTime && time < s.endTime);
      const isSelected = scene?.selected;
      const isPast = time < currentTime;

      // Gradient based on state
      if (isPast) {
        ctx.fillStyle = isSelected
          ? "hsl(270 65% 70% / 0.9)"
          : "hsl(0 0% 50% / 0.5)";
      } else {
        ctx.fillStyle = isSelected
          ? "hsl(270 65% 80% / 0.5)"
          : "hsl(0 0% 30% / 0.3)";
      }

      ctx.fillRect(x, centerY - barHeight / 2, Math.max(barWidth - 1, 1), barHeight);
    });

    // Draw scene markers
    ctx.strokeStyle = "hsl(0 0% 40% / 0.6)";
    ctx.lineWidth = 1;
    scenes.forEach((scene) => {
      const x = (scene.startTime / audioDuration) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    // Draw playhead
    if (audioDuration > 0) {
      const playheadX = (currentTime / audioDuration) * width;
      
      // Glow effect
      ctx.shadowColor = "hsl(0 72% 60%)";
      ctx.shadowBlur = 8;
      
      ctx.strokeStyle = "hsl(0 72% 55%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      
      // Playhead circle
      ctx.fillStyle = "hsl(0 72% 55%)";
      ctx.beginPath();
      ctx.arc(playheadX, 4, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
    }
  }, [fullWaveform, scenes, currentTime, audioDuration]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * audioDuration;
    onSeek(Math.max(0, Math.min(time, audioDuration)));
  }, [audioDuration, onSeek]);

  const skipBackward = () => {
    onSeek(Math.max(0, currentTime - 5));
  };

  const skipForward = () => {
    onSeek(Math.min(audioDuration, currentTime + 5));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50">
      {/* Scene Markers Row */}
      <div className="h-8 px-4 flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-border/30">
        {scenes.map((scene) => {
          const left = (scene.startTime / audioDuration) * 100;
          const width = ((scene.endTime - scene.startTime) / audioDuration) * 100;
          
          return (
            <button
              key={scene.id}
              onClick={() => onSceneClick?.(scene)}
              className={`absolute h-6 rounded-sm text-[10px] font-medium flex items-center justify-center transition-all hover:opacity-100 ${
                scene.selected
                  ? "bg-primary/30 text-primary-foreground border border-primary/50"
                  : "bg-secondary/50 text-muted-foreground border border-transparent hover:border-border"
              }`}
              style={{ left: `${left}%`, width: `${width}%`, minWidth: '24px' }}
            >
              {scene.index + 1}
            </button>
          );
        })}
      </div>

      {/* Waveform */}
      <div ref={containerRef} className="h-16 px-4 py-2">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer rounded"
          onClick={handleTimelineClick}
        />
      </div>

      {/* Controls */}
      <div className="h-12 px-4 flex items-center gap-4">
        {/* Playback Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={skipBackward}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-foreground hover:text-primary"
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
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={skipForward}
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Time Display */}
        <div className="font-mono text-sm text-muted-foreground tabular-nums">
          <span className="text-foreground">{formatTime(currentTime)}</span>
          <span className="mx-1">/</span>
          <span>{formatTime(audioDuration)}</span>
        </div>

        <div className="flex-1" />

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={([v]) => {
              setVolume(v);
              setIsMuted(v === 0);
            }}
            max={100}
            step={1}
            className="w-20"
          />
        </div>

        {/* Selected Count */}
        <div className="text-sm">
          <span className="text-primary font-medium">
            {scenes.filter(s => s.selected).length}
          </span>
          <span className="text-muted-foreground"> / {scenes.length} scenes</span>
        </div>
      </div>
    </div>
  );
}
