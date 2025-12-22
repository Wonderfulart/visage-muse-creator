-- Create music_video_jobs table
CREATE TABLE public.music_video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  character_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' 
    CHECK (status IN ('uploaded', 'analyzed', 'audio_split', 'prompts_generated', 
                      'generating_videos', 'lip_syncing', 'stitching', 'completed', 'failed', 'cancelled')),
  total_segments INT NOT NULL DEFAULT 0,
  completed_segments INT NOT NULL DEFAULT 0,
  use_lipsync BOOLEAN NOT NULL DEFAULT true,
  final_video_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create video_segments table
CREATE TABLE public.video_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.music_video_jobs(id) ON DELETE CASCADE,
  segment_index INT NOT NULL,
  start_ms INT NOT NULL,
  end_ms INT NOT NULL,
  audio_segment_url TEXT,
  prompt TEXT,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  
  -- Veo video generation
  veo_job_id TEXT,
  veo_status TEXT NOT NULL DEFAULT 'queued' 
    CHECK (veo_status IN ('queued', 'processing', 'completed', 'failed')),
  veo_video_url TEXT,
  
  -- Sync.so lip-sync
  sync_job_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'not_started' 
    CHECK (sync_status IN ('not_started', 'processing', 'completed', 'failed', 'skipped')),
  synced_video_url TEXT,
  
  -- Final output for this segment
  final_video_url TEXT,
  
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(job_id, segment_index)
);

-- Enable RLS on music_video_jobs
ALTER TABLE public.music_video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON public.music_video_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs" ON public.music_video_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON public.music_video_jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs" ON public.music_video_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS on video_segments (via job ownership)
ALTER TABLE public.video_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view segments of own jobs" ON public.video_segments
  FOR SELECT USING (
    job_id IN (SELECT id FROM public.music_video_jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert segments for own jobs" ON public.video_segments
  FOR INSERT WITH CHECK (
    job_id IN (SELECT id FROM public.music_video_jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update segments of own jobs" ON public.video_segments
  FOR UPDATE USING (
    job_id IN (SELECT id FROM public.music_video_jobs WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete segments of own jobs" ON public.video_segments
  FOR DELETE USING (
    job_id IN (SELECT id FROM public.music_video_jobs WHERE user_id = auth.uid())
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_music_video_jobs_updated_at
  BEFORE UPDATE ON public.music_video_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_segments_updated_at
  BEFORE UPDATE ON public.video_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster queries
CREATE INDEX idx_video_segments_job_id ON public.video_segments(job_id);
CREATE INDEX idx_music_video_jobs_user_id ON public.music_video_jobs(user_id);
CREATE INDEX idx_music_video_jobs_status ON public.music_video_jobs(status);