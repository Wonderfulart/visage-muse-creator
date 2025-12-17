import { useState, useEffect, useCallback } from 'react';
import { Check, Video, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Video {
  id: string;
  prompt: string;
  video_url: string;
  duration: number;
  created_at: string;
  signedUrl?: string;
}

interface VideoSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxSelections?: number;
}

export const VideoSelector = ({ 
  selectedIds, 
  onSelectionChange, 
  maxSelections = 10 
}: VideoSelectorProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const getSignedUrl = useCallback(async (videoUrl: string): Promise<string> => {
    try {
      let path = videoUrl;
      if (videoUrl.includes('/storage/v1/object/')) {
        const match = videoUrl.match(/\/videos\/(.+)$/);
        if (match) {
          path = match[1];
        }
      }
      
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(path, 3600);
      
      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return videoUrl;
    }
  }, []);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .eq('status', 'completed')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const videosWithUrls = await Promise.all(
          (data || []).map(async (video) => ({
            ...video,
            signedUrl: await getSignedUrl(video.video_url)
          }))
        );

        setVideos(videosWithUrls);
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [getSignedUrl]);

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(vid => vid !== id));
    } else if (selectedIds.length < maxSelections) {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No videos available</p>
        <p className="text-sm">Generate some videos first!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {selectedIds.length} / {maxSelections} selected
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2">
        {videos.map((video) => {
          const isSelected = selectedIds.includes(video.id);
          const selectionIndex = selectedIds.indexOf(video.id);
          
          return (
            <button
              key={video.id}
              onClick={() => toggleSelection(video.id)}
              className={cn(
                "relative rounded-lg overflow-hidden border-2 transition-all aspect-video group",
                isSelected 
                  ? "border-primary ring-2 ring-primary/20" 
                  : "border-border hover:border-primary/50"
              )}
            >
              <video
                src={video.signedUrl}
                className="w-full h-full object-cover"
                muted
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                }}
              />
              
              {/* Selection indicator */}
              <div className={cn(
                "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all",
                isSelected 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-background/80 border border-border"
              )}>
                {isSelected ? (
                  <span className="text-xs font-bold">{selectionIndex + 1}</span>
                ) : (
                  <Check className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                )}
              </div>
              
              {/* Duration badge */}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-background/80 text-xs">
                {video.duration}s
              </div>
              
              {/* Prompt preview on hover */}
              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs truncate">{video.prompt}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
