import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Palette, Download, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CoverArtGeneratorProps {
  videoPrompt: string;
  lyrics: string;
  artistName: string;
  trackTitle: string;
}

export const CoverArtGenerator = ({ videoPrompt, lyrics, artistName, trackTitle }: CoverArtGeneratorProps) => {
  const [artist, setArtist] = useState(artistName);
  const [title, setTitle] = useState(trackTitle);
  const [isGenerating, setIsGenerating] = useState(false);
  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!artist.trim() || !title.trim()) {
      toast.error('Please enter artist name and track title');
      return;
    }

    setIsGenerating(true);
    
    // Simulate generation - in production this would call an AI image generation API
    setTimeout(() => {
      setIsGenerating(false);
      toast.success('Cover art generated! (Demo)');
      // In production: setCoverArtUrl(response.url);
    }, 2000);
  };

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-semibold text-foreground">Cover Art Generator</h3>
        </div>
        <Badge variant="secondary">AI Powered</Badge>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Artist Name</label>
          <Input
            placeholder="Your artist name"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1.5 block">Track Title</label>
          <Input
            placeholder="Song title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {coverArtUrl && (
          <div className="aspect-square rounded-xl overflow-hidden bg-secondary">
            <img src={coverArtUrl} alt="Generated cover art" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !artist.trim() || !title.trim()}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Cover Art
              </>
            )}
          </Button>
          
          {coverArtUrl && (
            <Button variant="outline" size="icon">
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
