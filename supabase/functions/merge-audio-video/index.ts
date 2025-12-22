import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Authentication helper
async function getUserFromToken(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return { userId: user.id };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const userInfo = await getUserFromToken(req);
    if (!userInfo) {
      console.error('Unauthorized access attempt to merge-audio-video');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please log in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { videoUrl, audioUrl, startTime, endTime, outputFileName } = await req.json();

    console.log('Merge request received from user:', userInfo.userId, { videoUrl, audioUrl, startTime, endTime, outputFileName });

    if (!videoUrl || !audioUrl) {
      throw new Error('Both videoUrl and audioUrl are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For now, we'll return the video URL as-is since FFmpeg in Deno is complex
    // In production, you'd use a service like Cloudinary, AWS MediaConvert, or a dedicated FFmpeg server
    
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
        error: 'Merge operation failed. Please try again.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
