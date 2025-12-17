import { useState, useEffect, useCallback } from 'react';
import { GripVertical, X, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface VideoItem {
  id: string;
  prompt: string;
  video_url: string;
  duration: number;
  signedUrl?: string;
}

interface VideoTimelineProps {
  videoIds: string[];
  onReorder: (newOrder: string[]) => void;
  onRemove: (id: string) => void;
}

export const VideoTimeline = ({ videoIds, onReorder, onRemove }: VideoTimelineProps) => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const getSignedUrl = useCallback(async (videoUrl: string): Promise<string> => {
    try {
      let path = videoUrl;
      if (videoUrl.includes('/storage/v1/object/')) {
        const match = videoUrl.match(/\/videos\/(.+)$/);
        if (match) path = match[1];
      }
      
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(path, 3600);
      
      if (error) throw error;
      return data.signedUrl;
    } catch {
      return videoUrl;
    }
  }, []);

  useEffect(() => {
    const fetchVideos = async () => {
      if (videoIds.length === 0) {
        setVideos([]);
        return;
      }

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .in('id', videoIds);

      if (error) {
        console.error('Error fetching videos:', error);
        return;
      }

      // Maintain order based on videoIds
      const orderedVideos = await Promise.all(
        videoIds.map(async (id) => {
          const video = data?.find(v => v.id === id);
          if (video) {
            return {
              ...video,
              signedUrl: await getSignedUrl(video.video_url)
            };
          }
          return null;
        })
      );

      setVideos(orderedVideos.filter(Boolean) as VideoItem[]);
    };

    fetchVideos();
  }, [videoIds, getSignedUrl]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...videoIds];
    const [dragged] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, dragged);
    onReorder(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const totalDuration = videos.reduce((sum, v) => sum + (v.duration || 0), 0);

  if (videos.length === 0) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
        <p className="text-sm">Select videos above to add them to your timeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Timeline</h4>
        <span className="text-xs text-muted-foreground">
          Total: {totalDuration}s
        </span>
      </div>

      <div className="space-y-2">
        {videos.map((video, index) => (
          <div
            key={video.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg border border-border bg-card transition-all",
              draggedIndex === index && "opacity-50 border-primary"
            )}
          >
            <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
              <GripVertical className="w-4 h-4" />
            </div>

            <div className="relative w-20 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
              <video
                src={video.signedUrl}
                className="w-full h-full object-cover"
                muted={playingId !== video.id}
              />
              <button
                onClick={() => setPlayingId(playingId === video.id ? null : video.id)}
                className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 hover:opacity-100 transition-opacity"
              >
                {playingId === video.id ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{video.prompt}</p>
              <p className="text-xs text-muted-foreground">{video.duration}s</p>
            </div>

            <span className="text-xs text-muted-foreground px-2">
              #{index + 1}
            </span>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(video.id)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
