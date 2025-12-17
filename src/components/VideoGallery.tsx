import { useState, useEffect, useCallback } from 'react';
import { Film, Trash2, Download, Play, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Video {
  id: string;
  prompt: string;
  lyrics: string | null;
  video_url: string;
  duration: number;
  aspect_ratio: string;
  created_at: string;
  signedUrl?: string;
}

interface VideoGalleryProps {
  refreshTrigger?: number;
}

export const VideoGallery = ({ refreshTrigger }: VideoGalleryProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const getSignedUrl = useCallback(async (videoPath: string): Promise<string | null> => {
    try {
      // If it's already a full URL (legacy data), return it
      if (videoPath.startsWith('http')) {
        return videoPath;
      }
      
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(videoPath, 3600); // 1 hour expiry
      
      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }
      
      return data.signedUrl;
    } catch (err) {
      console.error('Error getting signed URL:', err);
      return null;
    }
  }, []);

  const fetchVideos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get signed URLs for all videos
      const videosWithUrls = await Promise.all(
        (data || []).map(async (video) => {
          const signedUrl = await getSignedUrl(video.video_url);
          return { ...video, signedUrl: signedUrl || video.video_url };
        })
      );
      
      setVideos(videosWithUrls);
    } catch (err) {
      console.error('Error fetching videos:', err);
    } finally {
      setLoading(false);
    }
  }, [getSignedUrl]);

  useEffect(() => {
    fetchVideos();
  }, [refreshTrigger, fetchVideos]);

  const handleDelete = async (id: string, videoUrl: string) => {
    try {
      // Determine the storage path (video_url now stores the path)
      let storagePath = videoUrl;
      
      // If it's a full URL (legacy), extract the filename
      if (videoUrl.startsWith('http')) {
        const urlParts = videoUrl.split('/');
        storagePath = urlParts[urlParts.length - 1];
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('videos')
        .remove([storagePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('videos')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      setVideos(prev => prev.filter(v => v.id !== id));
      toast.success('Video deleted');
    } catch (err) {
      console.error('Error deleting video:', err);
      toast.error('Failed to delete video');
    }
  };

  const handleDownload = async (signedUrl: string, prompt: string) => {
    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prompt.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Download started');
    } catch (err) {
      console.error('Error downloading:', err);
      toast.error('Failed to download video');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="aspect-video bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 card-elevated rounded-2xl">
        <div className="p-4 rounded-full bg-muted w-fit mx-auto mb-4">
          <Film className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-heading font-semibold text-foreground mb-2">No videos yet</h3>
        <p className="text-sm text-muted-foreground">
          Generated videos will appear here automatically
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <Film className="w-6 h-6 text-primary" />
          Your Videos
        </h3>
        <span className="text-sm text-muted-foreground">{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <div 
            key={video.id} 
            className="card-elevated rounded-xl overflow-hidden group"
          >
            {/* Video Preview */}
            <div className="relative aspect-video bg-muted">
              <video
                src={video.signedUrl}
                className="w-full h-full object-cover"
                controls={playingId === video.id}
                onPlay={() => setPlayingId(video.id)}
                onPause={() => setPlayingId(null)}
                onEnded={() => setPlayingId(null)}
              />
              {playingId !== video.id && (
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer transition-opacity group-hover:bg-black/40"
                  onClick={() => {
                    const videoEl = document.querySelector(`video[src="${video.signedUrl}"]`) as HTMLVideoElement;
                    if (videoEl) {
                      videoEl.play();
                    }
                  }}
                >
                  <div className="p-3 rounded-full bg-primary/90 text-primary-foreground">
                    <Play className="w-6 h-6" />
                  </div>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="p-4 space-y-3">
              <p className="text-sm text-foreground line-clamp-2 font-medium">
                {video.prompt}
              </p>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {video.duration}s
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(video.created_at)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDownload(video.signedUrl || video.video_url, video.prompt)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(video.id, video.video_url)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
