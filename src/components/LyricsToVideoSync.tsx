import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Music, Sparkles, Loader2, Play, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LyricLine {
  line: string;
  emotion: string;
  sceneDescription: string;
  order: number;
  startTime?: number;
  endTime?: number;
}

interface LyricsToVideoSyncProps {
  lyrics: string;
  baseVisualStyle: string;
  audioDuration?: number;
  onScenesGenerated: (scenes: LyricLine[]) => void;
  onGenerateBatch?: () => void;
}

export const LyricsToVideoSync = ({ 
  lyrics, 
  baseVisualStyle, 
  audioDuration,
  onScenesGenerated,
  onGenerateBatch
}: LyricsToVideoSyncProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedScenes, setGeneratedScenes] = useState<LyricLine[]>([]);

  const handleAnalyze = async () => {
    if (!lyrics.trim()) {
      toast.error('Please enter your lyrics');
      return;
    }

    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('enhance-prompt', {
        body: {
          prompt: `Analyze these song lyrics and generate visual scene descriptions for each meaningful section. Base visual style: ${baseVisualStyle}. For each section, identify the emotion and create a cinematic scene description that would work for a music video:\n\n${lyrics}`,
        },
      });

      if (error) throw error;

      // Parse the response into scenes
      const lines = lyrics.split('\n').filter(l => l.trim());
      const lineCount = Math.min(lines.length, 8);
      
      // Calculate timing based on audio duration if provided
      const secondsPerLine = audioDuration && audioDuration > 0 
        ? Math.max(5, Math.floor(audioDuration / lineCount))
        : 8;

      const scenes: LyricLine[] = lines.slice(0, 8).map((line, idx) => ({
        line,
        emotion: 'emotional',
        sceneDescription: data.enhancedPrompt || `Cinematic scene for: "${line}"`,
        order: idx + 1,
        startTime: idx * secondsPerLine,
        endTime: (idx + 1) * secondsPerLine
      }));

      setGeneratedScenes(scenes);
      onScenesGenerated(scenes);
      toast.success('Lyrics analyzed! Scenes generated.');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze lyrics');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-elevated rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-foreground">Lyrics to Video Sync</h3>
          </div>
          <Badge variant="secondary">AI Sync</Badge>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {lyrics ? `${lyrics.split('\n').filter(l => l.trim()).length} lines detected` : 'Add lyrics in the Quick Generate tab first'}
        </p>

        {/* Audio Duration Indicator */}
        {audioDuration && audioDuration > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary">
              Auto-timed from audio: {Math.floor(audioDuration / 60)}:{String(Math.floor(audioDuration % 60)).padStart(2, '0')}
            </span>
          </div>
        )}

        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !lyrics.trim()}
          className="w-full"
          variant="hero"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing Lyrics...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Scene Descriptions
            </>
          )}
        </Button>
      </div>

      {generatedScenes.length > 0 && (
        <div className="card-elevated rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-foreground">Generated Scenes</h3>
            <Badge>{generatedScenes.length} scenes</Badge>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {generatedScenes.map((scene) => (
              <div key={scene.order} className="p-4 rounded-xl bg-secondary/30 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                    {scene.order}
                  </span>
                  <p className="text-sm font-medium text-foreground truncate flex-1">
                    "{scene.line}"
                  </p>
                  {scene.startTime !== undefined && scene.endTime !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {scene.startTime}s - {scene.endTime}s
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground pl-8">
                  {scene.sceneDescription}
                </p>
              </div>
            ))}
          </div>

          {/* Generate All Button */}
          {onGenerateBatch && (
            <Button
              onClick={onGenerateBatch}
              variant="hero"
              size="lg"
              className="w-full mt-4"
            >
              <Play className="w-5 h-5 mr-2" />
              Generate All {generatedScenes.length} Scenes
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
