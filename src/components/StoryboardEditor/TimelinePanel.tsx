import { useState, useRef, useEffect } from "react";
import { Clock, Play, Pause, CheckSquare, Square, Wand2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Scene } from "./types";
import { SceneCard } from "./SceneCard";
import { formatTime } from "@/utils/audioSplitter";

interface TimelinePanelProps {
  scenes: Scene[];
  fullWaveform: number[];
  audioDuration: number;
  audioUrl: string;
  onScenesChange: (scenes: Scene[]) => void;
  onNext: () => void;
  onBack: () => void;
  onRegeneratePrompts?: () => void;
  isGeneratingPrompts?: boolean;
}

export function TimelinePanel({
  scenes,
  fullWaveform,
  audioDuration,
  audioUrl,
  onScenesChange,
  onNext,
  onBack,
  onRegeneratePrompts,
  isGeneratingPrompts,
}: TimelinePanelProps) {
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedCount = scenes.filter((s) => s.selected).length;
  const maxScenes = 10;

  // Draw timeline waveform
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
    const barWidth = width / fullWaveform.length;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    fullWaveform.forEach((value, i) => {
      const barHeight = value * height * 0.7;
      const x = i * barWidth;

      // Color based on selected scenes
      const time = (i / fullWaveform.length) * audioDuration;
      const scene = scenes.find((s) => time >= s.startTime && time < s.endTime);
      const isSelected = scene?.selected;

      ctx.fillStyle = isSelected
        ? "hsl(270 65% 80% / 0.6)"
        : "hsl(0 0% 40% / 0.3)";

      ctx.fillRect(x, centerY - barHeight / 2, Math.max(barWidth - 0.5, 1), barHeight);
    });

    // Draw playhead
    if (audioDuration > 0) {
      const playheadX = (currentTime / audioDuration) * width;
      ctx.strokeStyle = "hsl(0 72% 51%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

    // Draw scene dividers
    ctx.strokeStyle = "hsl(0 0% 30%)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    scenes.forEach((scene) => {
      const x = (scene.startTime / audioDuration) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });
  }, [fullWaveform, scenes, currentTime, audioDuration]);

  // Update current time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPlayingSceneId(null);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const toggleSelect = (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene) return;

    // Don't allow selecting more than max
    if (!scene.selected && selectedCount >= maxScenes) {
      return;
    }

    onScenesChange(
      scenes.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const updatePrompt = (id: string, prompt: string) => {
    onScenesChange(
      scenes.map((s) => (s.id === id ? { ...s, prompt } : s))
    );
  };

  const playSceneAudio = (scene: Scene) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playingSceneId === scene.id) {
      audio.pause();
      setPlayingSceneId(null);
      setIsPlaying(false);
    } else {
      audio.currentTime = scene.startTime;
      audio.play();
      setPlayingSceneId(scene.id);
      setIsPlaying(true);

      // Stop at scene end
      const checkEnd = setInterval(() => {
        if (audio.currentTime >= scene.endTime) {
          audio.pause();
          clearInterval(checkEnd);
          setPlayingSceneId(null);
          setIsPlaying(false);
        }
      }, 100);
    }
  };

  const selectAll = () => {
    onScenesChange(
      scenes.map((s, i) => ({ ...s, selected: i < maxScenes }))
    );
  };

  const deselectAll = () => {
    onScenesChange(scenes.map((s) => ({ ...s, selected: false })));
  };

  const togglePlayAll = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-primary">
            <Clock className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Timeline</h2>
            <p className="text-sm text-muted-foreground">
              Select up to {maxScenes} scenes to generate
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRegeneratePrompts}
            disabled={isGeneratingPrompts}
          >
            {isGeneratingPrompts ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-1" />
            )}
            AI Prompts
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            <Square className="w-4 h-4 mr-1" />
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={selectAll}>
            <CheckSquare className="w-4 h-4 mr-1" />
            Select First 10
          </Button>
        </div>
      </div>

      {/* Waveform Timeline */}
      <div className="card-elevated rounded-xl p-4">
        <div className="flex items-center gap-4 mb-3">
          <Button variant="ghost" size="icon" onClick={togglePlayAll}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <span className="text-sm font-mono text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(audioDuration)}
          </span>
          <div className="flex-1" />
          <span className="text-sm text-primary font-medium">
            {selectedCount}/{maxScenes} selected
          </span>
        </div>

        <div
          ref={timelineRef}
          className="h-16 bg-background/50 rounded-lg overflow-hidden cursor-pointer relative"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = (x / rect.width) * audioDuration;
            if (audioRef.current) {
              audioRef.current.currentTime = time;
              setCurrentTime(time);
            }
          }}
        >
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* Time markers */}
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i}>{formatTime((audioDuration / 6) * i)}</span>
          ))}
        </div>
      </div>

      {/* Scene Cards Grid */}
      <ScrollArea className="w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-4">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              onToggleSelect={toggleSelect}
              onUpdatePrompt={updatePrompt}
              onPlayAudio={playSceneAudio}
              isPlaying={playingSceneId === scene.id}
              disabled={!scene.selected && selectedCount >= maxScenes}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Hidden audio */}
      <audio ref={audioRef} src={audioUrl} />

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={selectedCount === 0}
          variant="hero"
          size="lg"
          className="min-w-[200px]"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          Generate {selectedCount} Scene{selectedCount !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
