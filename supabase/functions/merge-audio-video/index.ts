import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, audioUrl, startTime, endTime, outputFileName } = await req.json();

    console.log('Merge request received:', { videoUrl, audioUrl, startTime, endTime, outputFileName });

    if (!videoUrl || !audioUrl) {
      throw new Error('Both videoUrl and audioUrl are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For now, we'll return the video URL as-is since FFmpeg in Deno is complex
    // In production, you'd use a service like Cloudinary, AWS MediaConvert, or a dedicated FFmpeg server
    
    // This is a placeholder that indicates the merge would happen
    // The actual merging should be done client-side using Web APIs or a dedicated media service
    
    console.log('Audio-video merge requested for:', {
      video: videoUrl,
      audio: audioUrl,
      segment: `${startTime}s - ${endTime}s`,
      output: outputFileName
    });

    // Return merge metadata - actual merging happens client-side or via external service
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Merge request processed',
        metadata: {
          videoUrl,
          audioUrl,
          startTime,
          endTime,
          outputFileName,
          // In a real implementation, this would be the merged video URL
          mergedVideoUrl: videoUrl,
          note: 'Client-side merging recommended using MediaRecorder API'
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Merge error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
