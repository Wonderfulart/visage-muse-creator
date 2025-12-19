// Enhancement 4: Audio Waveform Timeline Synchronization
// Visual timeline showing which scene plays at which time
// Interactive waveform with scene markers and playback

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

interface Scene {
  id: string;
  order: number;
  prompt?: string;
  sceneDescription?: string;
  line?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

interface AudioWaveformTimelineProps {
  audioUrl: string;
  scenes: Scene[];
  audioDuration: number;
  onSceneClick?: (scene: Scene) => void;
  currentlyPlaying?: string | null;
}

export const AudioWaveformTimeline = ({
  audioUrl,
  scenes,
  audioDuration,
  onSceneClick,
  currentlyPlaying
}: AudioWaveformTimelineProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState([0.7]);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Generate waveform visualization
  const generateWaveform = useCallback(async () => {
    try {
      const audioContext = new AudioContext();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const rawData = audioBuffer.getChannelData(0);
      const samples = 200; // Number of bars in waveform
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData: number[] = [];

      for (let i = 0; i < samples; i++) {
        let blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        filteredData.push(sum / blockSize);
      }

      // Normalize
      const maxValue = Math.max(...filteredData);
      const normalized = filteredData.map(v => v / maxValue);
      
      setWaveformData(normalized);
      await audioContext.close();
    } catch (error) {
      console.error('Error generating waveform:', error);
    }
  }, [audioUrl]);

  useEffect(() => {
    if (audioUrl) {
      generateWaveform();
    }
  }, [audioUrl, generateWaveform]);

  // Draw waveform with scene markers
  useEffect(() => {
    if (!canvasRef.current || waveformData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / waveformData.length;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform bars
    waveformData.forEach((value, index) => {
      const barHeight = value * (height * 0.8);
      const x = index * barWidth;
      const y = (height - barHeight) / 2;

      // Determine color based on whether this segment is in active scene
      const segmentTime = (index / waveformData.length) * audioDuration;
      const inActiveScene = scenes.some(scene => 
        scene.startTime !== undefined && 
        scene.endTime !== undefined &&
        segmentTime >= scene.startTime && 
        segmentTime <= scene.endTime &&
        (activeSceneId === null || scene.id === activeSceneId)
      );

      // Color based on playback position
      const isPast = segmentTime < currentTime;
      
      if (isPast) {
        ctx.fillStyle = 'hsl(var(--primary))';
      } else if (inActiveScene) {
        ctx.fillStyle = 'hsl(var(--primary) / 0.4)';
      } else {
        ctx.fillStyle = 'hsl(var(--muted-foreground) / 0.3)';
      }

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // Draw playback position line
    const playbackX = (currentTime / audioDuration) * width;
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playbackX, 0);
    ctx.lineTo(playbackX, height);
    ctx.stroke();

    // Draw scene markers
    scenes.forEach(scene => {
      if (scene.startTime === undefined) return;
      
      const startX = (scene.startTime / audioDuration) * width;
      const endX = scene.endTime ? (scene.endTime / audioDuration) * width : startX;
      
      // Scene region background
      ctx.fillStyle = scene.id === activeSceneId 
        ? 'hsl(var(--primary) / 0.15)' 
        : 'hsl(var(--accent) / 0.1)';
      ctx.fillRect(startX, 0, endX - startX, height);
      
      // Scene start marker
      ctx.strokeStyle = scene.id === activeSceneId 
        ? 'hsl(var(--primary))' 
        : 'hsl(var(--border))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.stroke();

      // Scene number
      ctx.fillStyle = 'hsl(var(--foreground))';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${scene.order}`, startX + 4, 16);
    });
  }, [waveformData, currentTime, audioDuration, scenes, activeSceneId]);

  // Audio time update
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      // Update active scene based on current time
      const currentScene = scenes.find(scene => 
        scene.startTime !== undefined &&
        scene.endTime !== undefined &&
        audio.currentTime >= scene.startTime &&
        audio.currentTime < scene.endTime
      );
      
      if (currentScene) {
        setActiveSceneId(currentScene.id);
      }
    };

    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [scenes]);

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume[0];
    }
  }, [volume, isMuted]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !audioRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * audioDuration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipToScene = (sceneIndex: number) => {
    const scene = scenes[sceneIndex];
    if (!scene || scene.startTime === undefined || !audioRef.current) return;
    
    audioRef.current.currentTime = scene.startTime;
    setCurrentTime(scene.startTime);
    setActiveSceneId(scene.id);
    
    if (!isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card-elevated rounded-2xl p-6 space-y-6">
      <audio ref={audioRef} src={audioUrl} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-primary" />
          Audio Timeline
        </h3>
        <Badge variant="secondary">{scenes.length} scenes</Badge>
      </div>

      {/* Waveform Canvas */}
      <div 
        ref={timelineRef}
        onClick={handleSeek}
        className="relative cursor-pointer rounded-xl overflow-hidden bg-secondary/30 border border-border"
        style={{ height: '120px' }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={120}
          className="w-full h-full"
        />
      </div>

      {/* Playback Controls */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              const currentSceneIndex = scenes.findIndex(s => s.id === activeSceneId);
              if (currentSceneIndex > 0) {
                skipToScene(currentSceneIndex - 1);
              }
            }}
            disabled={!activeSceneId || scenes.findIndex(s => s.id === activeSceneId) === 0}
          >
            <SkipBack className="w-4 h-4" />
          </Button>

          <Button
            onClick={togglePlayPause}
            size="icon"
            variant="default"
            className="h-12 w-12 rounded-full"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              const currentSceneIndex = scenes.findIndex(s => s.id === activeSceneId);
              if (currentSceneIndex < scenes.length - 1) {
                skipToScene(currentSceneIndex + 1);
              }
            }}
            disabled={!activeSceneId || scenes.findIndex(s => s.id === activeSceneId) === scenes.length - 1}
          >
            <SkipForward className="w-4 h-4" />
          </Button>

          {/* Time Display */}
          <div className="font-mono text-sm flex-1 text-center">
            <span className="text-foreground">{formatTime(currentTime)}</span>
            <span className="text-muted-foreground"> / {formatTime(audioDuration)}</span>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              className="h-8 w-8"
            >
              {isMuted || volume[0] === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
            <Slider
              value={isMuted ? [0] : volume}
              onValueChange={setVolume}
              min={0}
              max={1}
              step={0.1}
              className="w-24"
            />
          </div>
        </div>
      </div>

      {/* Scene List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        <p className="text-sm font-medium text-muted-foreground mb-2">Scenes Timeline:</p>
        {scenes.map((scene, index) => (
          <button
            key={scene.id}
            onClick={() => {
              skipToScene(index);
              onSceneClick?.(scene);
            }}
            className={`w-full p-3 rounded-lg text-left transition-colors ${
              scene.id === activeSceneId
                ? 'bg-primary/20 border-2 border-primary'
                : 'bg-secondary/30 border-2 border-transparent hover:border-border'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">
                Scene {scene.order}: {scene.line || scene.prompt?.slice(0, 40) || 'Untitled'}
              </span>
              {scene.startTime !== undefined && scene.endTime !== undefined && (
                <Badge variant={scene.id === activeSceneId ? 'default' : 'outline'} className="text-xs">
                  {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
                </Badge>
              )}
            </div>
            {scene.sceneDescription && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {scene.sceneDescription}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
