import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Trash2, Clock, Music, Loader2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LipsyncVideo {
  id: string;
  title: string | null;
  audio_url: string | null;
  character_image_url: string | null;
  status: string;
  created_at: string;
  total_segments: number;
  completed_segments: number;
  total_cost: number;
  final_video_url: string | null;
}

interface LipsyncSegment {
  id: string;
  video_id: string;
  segment_index: number;
  output_url: string | null;
  status: string;
  start_time: number;
  end_time: number;
}

const SimpleMusicVideoHistory = () => {
  const [videos, setVideos] = useState<LipsyncVideo[]>([]);
  const [segments, setSegments] = useState<Record<string, LipsyncSegment[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('lipsync_videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load video history');
    } finally {
      setLoading(false);
    }
  };

  const fetchSegments = async (videoId: string) => {
    if (segments[videoId]) {
      setExpandedVideo(expandedVideo === videoId ? null : videoId);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('lipsync_segments')
        .select('*')
        .eq('video_id', videoId)
        .order('segment_index', { ascending: true });

      if (error) throw error;
      setSegments(prev => ({ ...prev, [videoId]: data || [] }));
      setExpandedVideo(videoId);
    } catch (error) {
      console.error('Error fetching segments:', error);
      toast.error('Failed to load video segments');
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video and all its clips?')) return;

    try {
      const { error } = await supabase
        .from('lipsync_videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Video deleted');
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Completed</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Processing</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Failed</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/simple" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Creator</span>
          </Link>
          <h1 className="font-heading font-bold text-xl text-gray-900">My Videos</h1>
          <div className="w-32" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-6">
                <Film className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No videos yet</h2>
              <p className="text-gray-600 mb-6">Create your first music video to see it here</p>
              <Link to="/simple">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  Create Video
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {videos.map((video) => (
                <div key={video.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Video Card Header */}
                  <div className="p-4 bg-white">
                    <div className="flex items-start gap-4">
                      {/* Thumbnail */}
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {video.character_image_url ? (
                          <img 
                            src={video.character_image_url} 
                            alt="Character" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {video.title || `Music Video`}
                          </h3>
                          {getStatusBadge(video.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(video.created_at)}
                          </span>
                          <span>{video.total_segments} clip{video.total_segments !== 1 ? 's' : ''}</span>
                          {video.total_cost > 0 && (
                            <span>${Number(video.total_cost).toFixed(2)}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {video.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchSegments(video.id)}
                          >
                            {expandedVideo === video.id ? 'Hide Clips' : 'View Clips'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(video.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Segments */}
                  {expandedVideo === video.id && segments[video.id] && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Video Clips</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {segments[video.id].map((segment) => (
                          <div 
                            key={segment.id} 
                            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                          >
                            {segment.output_url ? (
                              <>
                                <video 
                                  src={segment.output_url} 
                                  className="w-full aspect-video bg-black"
                                  controls
                                  muted
                                />
                                <div className="p-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">
                                      Clip {segment.segment_index + 1}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleDownload(
                                        segment.output_url!, 
                                        `clip-${segment.segment_index + 1}.mp4`
                                      )}
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                                <span className="text-xs text-gray-400">
                                  {segment.status === 'processing' ? 'Processing...' : 'No video'}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Download All Button */}
                      {segments[video.id].every(s => s.output_url) && (
                        <div className="mt-4 flex justify-center">
                          <Button
                            variant="outline"
                            onClick={() => {
                              segments[video.id].forEach((segment, i) => {
                                if (segment.output_url) {
                                  setTimeout(() => {
                                    handleDownload(segment.output_url!, `clip-${i + 1}.mp4`);
                                  }, i * 500);
                                }
                              });
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download All Clips
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SimpleMusicVideoHistory;
