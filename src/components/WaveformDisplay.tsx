import { useEffect, useRef, useState } from 'react';

interface WaveformDisplayProps {
  audioUrl: string;
  currentTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  onSeek: (time: number) => void;
  onTrimChange: (start: number, end: number) => void;
}

export const WaveformDisplay = ({
  audioUrl,
  currentTime,
  duration,
  trimStart,
  trimEnd,
  onSeek,
  onTrimChange
}: WaveformDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | null>(null);

  // Generate waveform data from audio
  useEffect(() => {
    const generateWaveform = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        const samples = 200;
        const blockSize = Math.floor(channelData.length / samples);
        const filteredData: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          const blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[blockStart + j]);
          }
          filteredData.push(sum / blockSize);
        }
        
        // Normalize
        const maxVal = Math.max(...filteredData);
        setWaveformData(filteredData.map(v => v / maxVal));
        
        audioContext.close();
      } catch (error) {
        console.error('Error generating waveform:', error);
        // Fallback: generate random waveform for demo
        setWaveformData(Array(200).fill(0).map(() => Math.random() * 0.8 + 0.2));
      }
    };

    if (audioUrl) {
      generateWaveform();
    }
  }, [audioUrl]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const barWidth = width / waveformData.length;
    const centerY = height / 2;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw trim region background
    const trimStartX = (trimStart / duration) * width;
    const trimEndX = (trimEnd / duration) * width;
    
    // Non-selected regions
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, trimStartX, height);
    ctx.fillRect(trimEndX, 0, width - trimEndX, height);

    // Selected region
    ctx.fillStyle = 'rgba(var(--primary), 0.1)';
    ctx.fillRect(trimStartX, 0, trimEndX - trimStartX, height);

    // Draw waveform bars
    waveformData.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = value * (height * 0.8);
      
      const isInTrimRegion = x >= trimStartX && x <= trimEndX;
      ctx.fillStyle = isInTrimRegion 
        ? 'hsl(var(--primary))' 
        : 'hsl(var(--muted-foreground) / 0.3)';
      
      ctx.fillRect(
        x,
        centerY - barHeight / 2,
        barWidth - 1,
        barHeight
      );
    });

    // Draw playhead
    const playheadX = (currentTime / duration) * width;
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.fillRect(playheadX - 1, 0, 2, height);

    // Draw trim handles
    ctx.fillStyle = 'hsl(var(--primary))';
    ctx.fillRect(trimStartX - 4, 0, 8, height);
    ctx.fillRect(trimEndX - 4, 0, 8, height);

  }, [waveformData, currentTime, duration, trimStart, trimEnd]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    
    const trimStartX = (trimStart / duration) * rect.width;
    const trimEndX = (trimEnd / duration) * rect.width;
    
    if (Math.abs(x - trimStartX) < 10) {
      setIsDragging('start');
    } else if (Math.abs(x - trimEndX) < 10) {
      setIsDragging('end');
    } else {
      setIsDragging('playhead');
      onSeek(time);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const time = (x / rect.width) * duration;
    
    if (isDragging === 'start') {
      onTrimChange(Math.min(time, trimEnd - 0.5), trimEnd);
    } else if (isDragging === 'end') {
      onTrimChange(trimStart, Math.max(time, trimStart + 0.5));
    } else if (isDragging === 'playhead') {
      onSeek(time);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-24 rounded-lg overflow-hidden bg-muted cursor-crosshair select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      
      {/* Time markers */}
      <div className="absolute bottom-1 left-2 text-xs text-muted-foreground">
        {formatTime(trimStart)}
      </div>
      <div className="absolute bottom-1 right-2 text-xs text-muted-foreground">
        {formatTime(trimEnd)}
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
