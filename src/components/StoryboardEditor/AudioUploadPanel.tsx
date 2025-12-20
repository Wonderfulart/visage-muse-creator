import { useState, useRef, useEffect } from "react";
import { Music, Upload, Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { splitAudio, getFullWaveform, formatTime, AudioSegment } from "@/utils/audioSplitter";

interface AudioUploadPanelProps {
  clipDuration: number;
  onAudioProcessed: (segments: AudioSegment[], fullWaveform: number[], duration: number, file: File) => void;
  onNext: () => void;
  onBack: () => void;
}

export function AudioUploadPanel({
  clipDuration,
  onAudioProcessed,
  onNext,
  onBack,
}: AudioUploadPanelProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [fullWaveform, setFullWaveform] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const barWidth = width / fullWaveform.length;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Draw waveform bars
    fullWaveform.forEach((value, i) => {
      const barHeight = value * height * 0.8;
      const x = i * barWidth;

      // Create gradient
      const gradient = ctx.createLinearGradient(x, centerY - barHeight / 2, x, centerY + barHeight / 2);
      gradient.addColorStop(0, "hsl(270 65% 80% / 0.8)");
      gradient.addColorStop(0.5, "hsl(180 55% 75% / 0.8)");
      gradient.addColorStop(1, "hsl(270 65% 80% / 0.8)");

      ctx.fillStyle = gradient;
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(barWidth - 1, 1), barHeight);
    });

    // Draw segment dividers
    if (segments.length > 0 && audioDuration > 0) {
      ctx.strokeStyle = "hsl(0 0% 50% / 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      segments.forEach((segment, i) => {
        if (i > 0) {
          const x = (segment.startTime / audioDuration) * width;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      });
    }
  }, [fullWaveform, segments, audioDuration]);

  const handleFileUpload = async (file: File) => {
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    // Get audio duration
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", async () => {
      setAudioDuration(audio.duration);
      toast.success(`Audio loaded: ${file.name}`);

      // Process audio
      setIsProcessing(true);
      setProcessProgress(0);

      try {
        // Get full waveform
        const { waveformData } = await getFullWaveform(file, 300);
        setFullWaveform(waveformData);

        // Split into segments
        const result = await splitAudio(file, clipDuration, (progress) => {
          setProcessProgress(progress);
        });

        setSegments(result.segments);
        onAudioProcessed(result.segments, waveformData, audio.duration, file);
        toast.success(`Split into ${result.segments.length} segments!`);
      } catch (error) {
        console.error("Audio processing error:", error);
        toast.error("Failed to process audio");
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) {
      handleFileUpload(file);
    } else {
      toast.error("Please upload an audio file");
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-gradient-primary">
          <Music className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Upload Audio</h2>
          <p className="text-sm text-muted-foreground">
            Upload your song and it will be automatically split into {clipDuration}s segments
          </p>
        </div>
      </div>

      {/* Upload Area */}
      {!audioFile ? (
        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer border-border hover:border-primary/50 bg-secondary/30 transition-all hover:bg-secondary/50"
        >
          <div className="flex flex-col items-center justify-center py-6">
            <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
            <p className="mb-2 text-lg text-foreground font-medium">
              <span className="text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-muted-foreground">MP3, WAV, M4A (Max 50MB)</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
        </label>
      ) : (
        <div className="space-y-4">
          {/* Audio Info Card */}
          <div className="card-elevated rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Music className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{audioFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Duration: {formatTime(audioDuration)} • {segments.length} segments
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={togglePlayback} disabled={isProcessing}>
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
            </div>

            {/* Waveform */}
            <div className="relative h-24 bg-background/50 rounded-lg overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-full" />
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Processing... {Math.round(processProgress)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar during processing */}
            {isProcessing && (
              <Progress value={processProgress} className="h-1 mt-3" />
            )}
          </div>

          {/* Segment Summary */}
          {segments.length > 0 && (
            <div className="card-elevated rounded-xl p-5">
              <Label className="font-medium mb-3 block">Segment Preview</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[200px] overflow-y-auto">
                {segments.slice(0, 10).map((segment, i) => (
                  <div
                    key={segment.id}
                    className="p-3 rounded-lg bg-secondary/50 border border-border/50 text-center"
                  >
                    <div className="text-sm font-medium text-foreground">Scene {i + 1}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                    </div>
                  </div>
                ))}
                {segments.length > 10 && (
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border/50 text-center flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">
                      +{segments.length - 10} more
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {segments.length > 10
                  ? "Maximum 10 scenes can be generated at once. Select scenes in the timeline."
                  : `All ${segments.length} scenes will be shown in the timeline.`}
              </p>
            </div>
          )}

          {/* Change Audio */}
          <Button
            variant="outline"
            onClick={() => {
              setAudioFile(null);
              setAudioUrl("");
              setSegments([]);
              setFullWaveform([]);
              if (audioUrl) URL.revokeObjectURL(audioUrl);
            }}
          >
            Change Audio
          </Button>
        </div>
      )}

      {/* Hidden audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={segments.length === 0 || isProcessing}
          variant="hero"
          size="lg"
          className="min-w-[200px]"
        >
          Continue to Timeline
        </Button>
      </div>
    </div>
  );
}
