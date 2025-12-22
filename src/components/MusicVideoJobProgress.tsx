import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  X, 
  Download,
  Play,
  AlertCircle
} from 'lucide-react';

interface Segment {
  id: string;
  segment_index: number;
  start_ms: number;
  end_ms: number;
  prompt: string | null;
  veo_status: string;
  veo_video_url: string | null;
  sync_status: string;
  synced_video_url: string | null;
  final_video_url: string | null;
  error: string | null;
}

interface Job {
  id: string;
  status: string;
  total_segments: number;
  completed_segments: number;
  audio_url: string;
  character_image_url: string | null;
  use_lipsync: boolean;
  final_video_url: string | null;
  error: string | null;
}

interface MusicVideoJobProgressProps {
  jobId: string;
  onComplete: (videoUrls: Array<{ index: number; url: string }>, audioUrl: string) => void;
  onCancel: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  'uploaded': 'Uploaded',
  'analyzed': 'Analyzing',
  'audio_split': 'Audio Split',
  'prompts_generated': 'Prompts Ready',
  'generating_videos': 'Generating Videos',
  'lip_syncing': 'Syncing Lips',
  'stitching': 'Stitching',
  'completed': 'Completed',
  'failed': 'Failed',
  'cancelled': 'Cancelled'
};

const SEGMENT_STATUS_ICONS: Record<string, React.ReactNode> = {
  'queued': <div className="w-3 h-3 rounded-full bg-muted animate-pulse" />,
  'processing': <Loader2 className="w-4 h-4 animate-spin text-primary" />,
  'completed': <CheckCircle className="w-4 h-4 text-green-500" />,
  'failed': <XCircle className="w-4 h-4 text-destructive" />,
  'not_started': <div className="w-3 h-3 rounded-full bg-muted" />,
  'skipped': <div className="w-3 h-3 rounded-full bg-muted-foreground" />
};

export function MusicVideoJobProgress({ jobId, onComplete, onCancel }: MusicVideoJobProgressProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!isPolling) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        'music-video-orchestrator',
        {
          body: { jobId },
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      // Workaround: pass action via URL
      const { data: statusData, error: statusError } = await supabase.functions.invoke(
        `music-video-orchestrator?action=status`,
        {
          body: { jobId },
          method: 'POST'
        }
      );

      if (statusError) {
        console.error('Failed to fetch job status:', statusError);
        return;
      }

      setJob(statusData.job);
      setSegments(statusData.segments || []);

      // Poll each segment that's in a processing state
      for (const seg of statusData.segments || []) {
        if (seg.veo_status === 'processing' || seg.sync_status === 'processing') {
          await supabase.functions.invoke(
            `music-video-orchestrator?action=poll-segment`,
            {
              body: { segmentId: seg.id },
              method: 'POST'
            }
          );
        }
      }

      // Check if job is complete
      if (statusData.job.status === 'completed') {
        setIsPolling(false);
        
        // Get final video URLs
        const { data: stitchData } = await supabase.functions.invoke(
          `music-video-orchestrator?action=stitch`,
          {
            body: { jobId },
            method: 'POST'
          }
        );

        if (stitchData?.videoUrls) {
          onComplete(stitchData.videoUrls, stitchData.audioUrl);
        }
      } else if (statusData.job.status === 'failed' || statusData.job.status === 'cancelled') {
        setIsPolling(false);
      }

    } catch (err) {
      console.error('Polling error:', err);
    }
  }, [jobId, isPolling, onComplete]);

  useEffect(() => {
    if (!isPolling) return;

    // Initial fetch
    fetchStatus();

    // Poll every 3 seconds
    const interval = setInterval(fetchStatus, 3000);
    
    return () => clearInterval(interval);
  }, [fetchStatus, isPolling]);

  const handleRetrySegment = async (segmentId: string) => {
    setIsRetrying(segmentId);
    
    try {
      const { error } = await supabase.functions.invoke(
        `music-video-orchestrator?action=retry-segment`,
        {
          body: { segmentId },
          method: 'POST'
        }
      );

      if (error) {
        toast.error('Failed to retry segment');
        return;
      }

      toast.success('Segment queued for retry');
      setIsPolling(true);
      
    } catch (err) {
      toast.error('Failed to retry segment');
    } finally {
      setIsRetrying(null);
    }
  };

  const handleCancelJob = async () => {
    setIsCancelling(true);
    
    try {
      const { error } = await supabase.functions.invoke(
        `music-video-orchestrator?action=cancel`,
        {
          body: { jobId },
          method: 'POST'
        }
      );

      if (error) {
        toast.error('Failed to cancel job');
        return;
      }

      toast.success('Job cancelled');
      setIsPolling(false);
      onCancel();
      
    } catch (err) {
      toast.error('Failed to cancel job');
    } finally {
      setIsCancelling(false);
    }
  };

  const progress = job ? (job.completed_segments / job.total_segments) * 100 : 0;
  const isActive = job && !['completed', 'failed', 'cancelled'].includes(job.status);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Video Generation Progress</CardTitle>
          {job && (
            <Badge variant={
              job.status === 'completed' ? 'default' :
              job.status === 'failed' ? 'destructive' :
              job.status === 'cancelled' ? 'secondary' :
              'outline'
            }>
              {STATUS_LABELS[job.status] || job.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {job?.completed_segments || 0} of {job?.total_segments || 0} segments
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Segments Grid */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Segments</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {segments.map((seg) => (
              <div
                key={seg.id}
                className={`
                  p-2 rounded-lg border text-sm
                  ${seg.error ? 'border-destructive/50 bg-destructive/5' : 'border-border'}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">#{seg.segment_index + 1}</span>
                  <div className="flex items-center gap-1">
                    {/* Veo status */}
                    {SEGMENT_STATUS_ICONS[seg.veo_status]}
                    {/* Sync status (if applicable) */}
                    {seg.veo_status === 'completed' && seg.sync_status !== 'not_started' && (
                      <>
                        <span className="text-muted-foreground">→</span>
                        {SEGMENT_STATUS_ICONS[seg.sync_status]}
                      </>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  {(seg.start_ms / 1000).toFixed(1)}s - {(seg.end_ms / 1000).toFixed(1)}s
                </div>
                
                {seg.error && (
                  <div className="mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-destructive" />
                    <span className="text-xs text-destructive truncate">{seg.error}</span>
                  </div>
                )}
                
                {/* Retry button for failed segments */}
                {(seg.veo_status === 'failed' || seg.sync_status === 'failed') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full mt-1 h-6 text-xs"
                    onClick={() => handleRetrySegment(seg.id)}
                    disabled={isRetrying === seg.id}
                  >
                    {isRetrying === seg.id ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    Retry
                  </Button>
                )}
                
                {/* Preview button for completed segments */}
                {seg.final_video_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full mt-1 h-6 text-xs"
                    onClick={() => window.open(seg.final_video_url!, '_blank')}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Preview
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {isActive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelJob}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <X className="w-4 h-4 mr-1" />
              )}
              Cancel Job
            </Button>
          )}
          
          {job?.status === 'completed' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (job.final_video_url) {
                  window.open(job.final_video_url, '_blank');
                }
              }}
            >
              <Download className="w-4 h-4 mr-1" />
              Download Final Video
            </Button>
          )}
        </div>

        {/* Error Message */}
        {job?.error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-sm text-destructive">{job.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MusicVideoJobProgress;
