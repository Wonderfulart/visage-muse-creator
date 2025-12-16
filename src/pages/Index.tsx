import { useState, useCallback, useEffect, useRef } from 'react';
import { Clapperboard, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ReferenceImageUpload } from '@/components/ReferenceImageUpload';
import { PromptInput } from '@/components/PromptInput';
import { VideoSettings } from '@/components/VideoSettings';
import { GenerationStatus } from '@/components/GenerationStatus';

type GenerationStatusType = 'idle' | 'processing' | 'completed' | 'failed';

const Index = () => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(8);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [preserveFace, setPreserveFace] = useState(true);
  const [status, setStatus] = useState<GenerationStatusType>('idle');
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const pollStatus = useCallback(async (requestId: string, modelId: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-video-status', {
        body: { requestId, modelId }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.status === 'completed') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        
        const video = data.videos?.[0];
        if (video?.uri) {
          setVideoUrl(video.uri);
          setStatus('completed');
          toast.success('Video generated successfully!');
        } else {
          throw new Error('No video URL in response');
        }
      } else if (data.status === 'failed') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        throw new Error(data.error || 'Video generation failed');
      }
    } catch (err) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setError(err instanceof Error ? err.message : 'Failed to check status');
      setStatus('failed');
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a video prompt');
      return;
    }

    setStatus('processing');
    setError(undefined);
    setVideoUrl(undefined);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt,
          referenceImage,
          preserveFace,
          duration,
          aspectRatio
        }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to start video generation');
      }

      toast.info('Video generation started! This may take a few minutes.');

      // Start polling for status - modelId is extracted from requestId in the edge function
      if (data.requestId) {
        pollingRef.current = setInterval(() => {
          pollStatus(data.requestId, data.modelId || 'veo-3.1-generate-001');
        }, 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('failed');
      toast.error(err instanceof Error ? err.message : 'Failed to generate video');
    }
  }, [prompt, referenceImage, preserveFace, duration, aspectRatio, pollStatus]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-primary glow-sm">
              <Clapperboard className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-foreground text-lg">VeoStudio</h1>
              <p className="text-xs text-muted-foreground">Powered by Veo 3.1</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">API Connected</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="font-heading text-4xl sm:text-5xl font-bold mb-4">
              <span className="text-gradient">Music Video</span>
              <br />
              <span className="text-foreground">Generation Studio</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Create stunning AI-powered music videos with preserved facial features. 
              Upload a reference image and let Veo 3.1 bring your vision to life.
            </p>
          </div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Panel - Controls */}
            <div className="space-y-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="card-elevated rounded-2xl p-6">
                <ReferenceImageUpload 
                  onImageChange={setReferenceImage}
                  aspectRatio={aspectRatio}
                />
              </div>

              <div className="card-elevated rounded-2xl p-6">
                <PromptInput
                  value={prompt}
                  onChange={setPrompt}
                />
              </div>

              <div className="card-elevated rounded-2xl p-6">
                <VideoSettings
                  duration={duration}
                  aspectRatio={aspectRatio}
                  preserveFace={preserveFace}
                  onDurationChange={setDuration}
                  onAspectRatioChange={setAspectRatio}
                  onPreserveFaceChange={setPreserveFace}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || status === 'processing'}
                variant="hero"
                size="lg"
                className="w-full"
              >
                {status === 'processing' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Music Video
                  </>
                )}
              </Button>
            </div>

            {/* Right Panel - Preview */}
            <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="card-elevated rounded-2xl p-6 h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-semibold text-foreground">Preview</h3>
                  {status === 'completed' && (
                    <span className="text-xs text-primary flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Ready
                    </span>
                  )}
                </div>
                <GenerationStatus
                  status={status}
                  videoUrl={videoUrl}
                  error={error}
                  aspectRatio={aspectRatio}
                />
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-glow-secondary/10 border border-primary/20 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="p-3 rounded-xl bg-primary/20">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-heading font-semibold text-foreground mb-1">
                  Strict Facial Preservation
                </h4>
                <p className="text-sm text-muted-foreground">
                  Veo 3.1 uses advanced subject referencing with strict adherence levels to maintain 
                  facial features throughout your generated video.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with Veo 3.1 API • Facial features are preserved using strict adherence mode</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
