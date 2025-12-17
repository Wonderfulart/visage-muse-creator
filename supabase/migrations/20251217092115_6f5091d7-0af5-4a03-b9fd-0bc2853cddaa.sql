-- Create stitched_videos table for video stitching projects
CREATE TABLE public.stitched_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  source_video_ids UUID[] NOT NULL DEFAULT '{}',
  transition_type TEXT NOT NULL DEFAULT 'none',
  output_quality TEXT NOT NULL DEFAULT '1080p',
  background_music_url TEXT,
  text_overlays JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  output_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.stitched_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own stitched videos" ON public.stitched_videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stitched videos" ON public.stitched_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stitched videos" ON public.stitched_videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stitched videos" ON public.stitched_videos
  FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket for stitched videos
INSERT INTO storage.buckets (id, name, public) VALUES ('stitched-videos', 'stitched-videos', false);

-- Create storage bucket for background music
INSERT INTO storage.buckets (id, name, public) VALUES ('background-music', 'background-music', false);

-- Create storage bucket for demo videos (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('demo-videos', 'demo-videos', true);

-- Storage policies for stitched-videos bucket
CREATE POLICY "Users can view own stitched videos files" ON storage.objects
  FOR SELECT USING (bucket_id = 'stitched-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own stitched videos files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'stitched-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own stitched videos files" ON storage.objects
  FOR DELETE USING (bucket_id = 'stitched-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for background-music bucket
CREATE POLICY "Users can view own background music" ON storage.objects
  FOR SELECT USING (bucket_id = 'background-music' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own background music" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'background-music' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own background music" ON storage.objects
  FOR DELETE USING (bucket_id = 'background-music' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Demo videos are public (read-only for everyone)
CREATE POLICY "Anyone can view demo videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'demo-videos');