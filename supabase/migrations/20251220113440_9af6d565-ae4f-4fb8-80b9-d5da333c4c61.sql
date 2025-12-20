-- Create lipsync_videos table to track video generations
CREATE TABLE public.lipsync_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  audio_url TEXT,
  character_image_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  total_segments INTEGER DEFAULT 1,
  completed_segments INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  final_video_url TEXT
);

-- Create lipsync_segments table for individual clips
CREATE TABLE public.lipsync_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.lipsync_videos(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  job_id TEXT,
  audio_url TEXT,
  output_url TEXT,
  status TEXT DEFAULT 'pending',
  start_time DECIMAL(10,2),
  end_time DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster segment lookups
CREATE INDEX idx_lipsync_segments_video_id ON public.lipsync_segments(video_id);

-- Enable RLS on both tables
ALTER TABLE public.lipsync_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lipsync_segments ENABLE ROW LEVEL SECURITY;

-- RLS policies for lipsync_videos
CREATE POLICY "Users can view own lipsync videos"
  ON public.lipsync_videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lipsync videos"
  ON public.lipsync_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lipsync videos"
  ON public.lipsync_videos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lipsync videos"
  ON public.lipsync_videos FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for lipsync_segments
CREATE POLICY "Users can view segments of own videos"
  ON public.lipsync_segments FOR SELECT
  USING (video_id IN (SELECT id FROM public.lipsync_videos WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert segments for own videos"
  ON public.lipsync_segments FOR INSERT
  WITH CHECK (video_id IN (SELECT id FROM public.lipsync_videos WHERE user_id = auth.uid()));

CREATE POLICY "Users can update segments of own videos"
  ON public.lipsync_segments FOR UPDATE
  USING (video_id IN (SELECT id FROM public.lipsync_videos WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete segments of own videos"
  ON public.lipsync_segments FOR DELETE
  USING (video_id IN (SELECT id FROM public.lipsync_videos WHERE user_id = auth.uid()));