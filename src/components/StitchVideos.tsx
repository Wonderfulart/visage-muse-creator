import { useState } from 'react';
import { Film, Music, Type, Download, Loader2, Crown, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VideoSelector } from './VideoSelector';
import { VideoTimeline } from './VideoTimeline';
import { TransitionSelector } from './TransitionSelector';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export const StitchVideos = () => {
  const navigate = useNavigate();
  const { subscription, tierName } = useSubscription();
  const tier = subscription?.subscription_tier || 'free';
  
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [transition, setTransition] = useState('none');
  const [quality, setQuality] = useState('1080p');
  const [backgroundMusic, setBackgroundMusic] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // Tier limits
  const limits = {
    free: { maxClips: 3, maxDuration: 30, quality: ['720p'], music: false, transitions: false },
    creator: { maxClips: 10, maxDuration: 180, quality: ['720p', '1080p'], music: true, transitions: true },
    pro: { maxClips: 50, maxDuration: 600, quality: ['720p', '1080p', '4k'], music: true, transitions: true }
  };
  
  const currentLimits = limits[tier as keyof typeof limits] || limits.free;

  const handleReorder = (newOrder: string[]) => {
    setSelectedVideoIds(newOrder);
  };

  const handleRemove = (id: string) => {
    setSelectedVideoIds(prev => prev.filter(vid => vid !== id));
  };

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!currentLimits.music) {
        toast.error('Upgrade to Creator Pro to add background music');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Music file must be under 50MB');
        return;
      }
      setBackgroundMusic(file);
      toast.success(`Added: ${file.name}`);
    }
  };

  const handleStitch = async () => {
    if (selectedVideoIds.length < 2) {
      toast.error('Select at least 2 videos to stitch');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Upload background music if present
      let musicUrl = null;
      if (backgroundMusic) {
        // Get the authenticated user's ID for RLS-compliant path
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error('You must be logged in to upload music');
          setIsProcessing(false);
          return;
        }
        
        // Upload with user ID as first folder component to match RLS policy
        const musicPath = `${user.id}/${crypto.randomUUID()}_${backgroundMusic.name}`;
        const { error: uploadError } = await supabase.storage
          .from('background-music')
          .upload(musicPath, backgroundMusic);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = await supabase.storage
          .from('background-music')
          .createSignedUrl(musicPath, 3600);
        
        musicUrl = urlData?.signedUrl;
      }

      // Simulate progress for demo (actual implementation would poll edge function)
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 1000);

      // Call stitch edge function
      const { data, error } = await supabase.functions.invoke('stitch-videos', {
        body: {
          videoIds: selectedVideoIds,
          title: title || 'Untitled Project',
          transition: currentLimits.transitions ? transition : 'none',
          quality: currentLimits.quality.includes(quality) ? quality : '720p',
          backgroundMusicUrl: musicUrl
        }
      });

      clearInterval(progressInterval);

      if (error) throw error;

      setProgress(100);
      setOutputUrl(data.outputUrl);
      toast.success('Video stitched successfully!');
    } catch (error) {
      console.error('Stitch error:', error);
      toast.error('Failed to stitch videos');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!outputUrl) return;
    
    try {
      const response = await fetch(outputUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'stitched-video'}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download video');
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left Panel - Selection & Settings */}
      <div className="space-y-6">
        {/* Video Selection */}
        <div className="card-elevated rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Film className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold">Select Videos</h3>
          </div>
          <VideoSelector
            selectedIds={selectedVideoIds}
            onSelectionChange={setSelectedVideoIds}
            maxSelections={currentLimits.maxClips}
          />
          {selectedVideoIds.length >= currentLimits.maxClips && tier === 'free' && (
            <p className="text-xs text-amber-500 mt-2">
              Free tier limited to {currentLimits.maxClips} clips.{' '}
              <button onClick={() => navigate('/pricing')} className="underline">Upgrade</button>
            </p>
          )}
        </div>

        {/* Project Settings */}
        <div className="card-elevated rounded-2xl p-6 space-y-4">
          <h3 className="font-heading font-semibold">Project Settings</h3>
          
          <div className="space-y-2">
            <Label>Project Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Music Video"
            />
          </div>

          <TransitionSelector
            value={transition}
            onChange={setTransition}
            disabled={!currentLimits.transitions}
          />

          <div className="space-y-2">
            <Label>Output Quality</Label>
            <Select value={quality} onValueChange={setQuality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['720p', '1080p', '4k'].map((q) => (
                  <SelectItem
                    key={q}
                    value={q}
                    disabled={!currentLimits.quality.includes(q)}
                  >
                    {q} {!currentLimits.quality.includes(q) && '(Pro)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Background Music */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Music className="w-4 h-4" />
              Background Music
              {!currentLimits.music && (
                <Crown className="w-3 h-3 text-amber-500" />
              )}
            </Label>
            <Input
              type="file"
              accept="audio/*"
              onChange={handleMusicUpload}
              disabled={!currentLimits.music}
              className="cursor-pointer"
            />
            {backgroundMusic && (
              <p className="text-xs text-muted-foreground">
                Selected: {backgroundMusic.name}
              </p>
            )}
            {!currentLimits.music && (
              <p className="text-xs text-muted-foreground">
                Upgrade to Creator Pro to add background music
              </p>
            )}
          </div>
        </div>

        {/* Stitch Button */}
        <Button
          onClick={handleStitch}
          disabled={selectedVideoIds.length < 2 || isProcessing}
          variant="hero"
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Stitching... {progress}%
            </>
          ) : (
            <>
              <Scissors className="w-5 h-5" />
              Stitch {selectedVideoIds.length} Videos
            </>
          )}
        </Button>
      </div>

      {/* Right Panel - Timeline & Preview */}
      <div className="space-y-6">
        {/* Timeline */}
        <div className="card-elevated rounded-2xl p-6">
          <VideoTimeline
            videoIds={selectedVideoIds}
            onReorder={handleReorder}
            onRemove={handleRemove}
          />
        </div>

        {/* Output Preview */}
        {outputUrl && (
          <div className="card-elevated rounded-2xl p-6">
            <h3 className="font-heading font-semibold mb-4">Stitched Video</h3>
            <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-4">
              <video
                src={outputUrl}
                controls
                className="w-full h-full"
              />
            </div>
            <Button onClick={handleDownload} className="w-full" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download Video
            </Button>
          </div>
        )}

        {/* Progress */}
        {isProcessing && (
          <div className="card-elevated rounded-2xl p-6">
            <h3 className="font-heading font-semibold mb-4">Processing</h3>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Combining your videos... This may take a few minutes.
            </p>
          </div>
        )}

        {/* Tips */}
        {!outputUrl && !isProcessing && (
          <div className="card-elevated rounded-2xl p-6 bg-primary/5 border-primary/20">
            <h4 className="font-medium mb-2">💡 Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Drag videos in the timeline to reorder</li>
              <li>• Use consistent aspect ratios for best results</li>
              <li>• Add transitions for smoother flow</li>
              <li>• Background music syncs to total duration</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
