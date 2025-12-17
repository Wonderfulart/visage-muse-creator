import { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Download, Volume2, VolumeX, Scissors, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { WaveformDisplay } from './WaveformDisplay';
import { AudioTrimmer } from './AudioTrimmer';
import { toast } from 'sonner';

export const AudioEditor = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setTrimEnd(audio.duration);
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Please upload an audio file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('File size must be under 100MB');
      return;
    }

    // Revoke previous URL
    if (audioUrl) URL.revokeObjectURL(audioUrl);

    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setTrimStart(0);
    setCurrentTime(0);
    setIsPlaying(false);
    toast.success(`Loaded: ${file.name}`);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Start from trim start if at beginning or outside trim region
      if (currentTime < trimStart || currentTime >= trimEnd) {
        audio.currentTime = trimStart;
      }
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(trimStart, Math.min(time, trimEnd));
  };

  const handleVolumeChange = (value: number[]) => {
    const vol = value[0];
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    if (vol > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  // Stop at trim end
  useEffect(() => {
    if (currentTime >= trimEnd && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [currentTime, trimEnd, isPlaying]);

  const handleExport = async () => {
    if (!audioFile || !audioUrl) return;

    setIsExporting(true);
    
    try {
      // For a full implementation, you'd use Web Audio API to slice the audio
      // Here's a simplified version that exports the trim metadata
      
      const trimmedDuration = trimEnd - trimStart;
      
      // Create a new AudioContext to process the audio
      const audioContext = new AudioContext();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Calculate sample positions
      const startSample = Math.floor(trimStart * audioBuffer.sampleRate);
      const endSample = Math.floor(trimEnd * audioBuffer.sampleRate);
      const trimmedLength = endSample - startSample;
      
      // Create new buffer with trimmed audio
      const trimmedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        trimmedLength,
        audioBuffer.sampleRate
      );
      
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const trimmedData = trimmedBuffer.getChannelData(channel);
        for (let i = 0; i < trimmedLength; i++) {
          trimmedData[i] = originalData[startSample + i];
        }
      }
      
      // Convert to WAV and download
      const wavBlob = audioBufferToWav(trimmedBuffer);
      const url = URL.createObjectURL(wavBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `trimmed_${audioFile.name.replace(/\.[^/.]+$/, '')}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      await audioContext.close();
      toast.success(`Exported ${trimmedDuration.toFixed(1)}s clip!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export audio');
    } finally {
      setIsExporting(false);
    }
  };

  const resetTrim = () => {
    setTrimStart(0);
    setTrimEnd(duration);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
  };

  return (
    <div className="space-y-6">
      <audio ref={audioRef} src={audioUrl} />

      {/* Upload Area */}
      {!audioFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Upload Audio File</p>
          <p className="text-sm text-muted-foreground">
            Supports MP3, WAV, M4A, OGG (max 100MB)
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File Info */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div>
              <p className="font-medium">{audioFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • {formatTime(duration)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (audioUrl) URL.revokeObjectURL(audioUrl);
                setAudioFile(null);
                setAudioUrl('');
                setDuration(0);
                setTrimStart(0);
                setTrimEnd(0);
              }}
            >
              Change File
            </Button>
          </div>

          {/* Waveform */}
          <div className="card-elevated rounded-2xl p-6">
            <Label className="text-sm mb-3 block">Waveform</Label>
            <WaveformDisplay
              audioUrl={audioUrl}
              currentTime={currentTime}
              duration={duration}
              trimStart={trimStart}
              trimEnd={trimEnd}
              onSeek={handleSeek}
              onTrimChange={(start, end) => {
                setTrimStart(start);
                setTrimEnd(end);
              }}
            />
          </div>

          {/* Playback Controls */}
          <div className="card-elevated rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <Button
                onClick={togglePlay}
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

              {/* Time Display */}
              <div className="font-mono text-sm">
                <span className="text-foreground">{formatTime(currentTime)}</span>
                <span className="text-muted-foreground"> / {formatTime(duration)}</span>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="h-8 w-8"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-24"
                />
              </div>
            </div>
          </div>

          {/* Trim Controls */}
          <div className="card-elevated rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Label className="flex items-center gap-2">
                <Scissors className="w-4 h-4" />
                Trim Audio
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetTrim}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>
            <AudioTrimmer
              duration={duration}
              trimStart={trimStart}
              trimEnd={trimEnd}
              onTrimStartChange={setTrimStart}
              onTrimEndChange={setTrimEnd}
            />
          </div>

          {/* Export */}
          <Button
            onClick={handleExport}
            disabled={isExporting}
            variant="hero"
            size="lg"
            className="w-full"
          >
            {isExporting ? (
              <>Processing...</>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Export Trimmed Audio ({formatTime(trimEnd - trimStart)})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Convert AudioBuffer to WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Write audio data
  const offset = 44;
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  let pos = offset;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, intSample, true);
      pos += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
