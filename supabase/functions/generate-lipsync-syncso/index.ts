import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  characterImageUrl: string;
  audioUrl: string;
  model?: string;
}

interface StatusRequest {
  jobId: string;
}

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const userInfo = await getUserFromToken(req);
    if (!userInfo) {
      console.error('Unauthorized access attempt to generate-lipsync-syncso');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please log in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SYNC_API_KEY = Deno.env.get('SYNC_API_KEY');
    if (!SYNC_API_KEY) {
      console.error('SYNC_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Service temporarily unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'generate';

    console.log('Lipsync request from user:', userInfo.userId, 'action:', action);

    if (action === 'generate') {
      // Generate lip-sync video
      const { characterImageUrl, audioUrl, model = 'lipsync-1.9.0-beta' }: GenerateRequest = await req.json();

      console.log('Starting lip-sync generation:', { characterImageUrl: characterImageUrl?.substring(0, 50), audioUrl: audioUrl?.substring(0, 50), model });

      if (!characterImageUrl || !audioUrl) {
        throw new Error('characterImageUrl and audioUrl are required');
      }

      const inputType = model === 'lipsync-2' ? 'video' : 'image';

      const response = await fetch('https://api.sync.so/v2/generate', {
        method: 'POST',
        headers: {
          'x-api-key': SYNC_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: [
            { type: inputType, url: characterImageUrl },
            { type: 'audio', url: audioUrl }
          ]
        }),
      });

      const responseText = await response.text();
      console.log('Sync.so generate response:', response.status);

      if (!response.ok) {
        console.error('Sync.so API error:', responseText);
        throw new Error('Lip-sync generation failed');
      }

      const data = JSON.parse(responseText);
      console.log('Job started with ID:', data.id);

      return new Response(JSON.stringify({
        success: true,
        jobId: data.id,
        status: data.status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'status') {
      // Check job status
      const { jobId }: StatusRequest = await req.json();

      if (!jobId) {
        throw new Error('jobId is required');
      }

      console.log('Checking status for job:', jobId);

      const response = await fetch(`https://api.sync.so/v2/generate/${jobId}`, {
        method: 'GET',
        headers: {
          'x-api-key': SYNC_API_KEY,
        },
      });

      const responseText = await response.text();
      console.log('Sync.so status response:', response.status);

      if (!response.ok) {
        console.error('Sync.so status check error:', responseText);
        throw new Error('Status check failed');
      }

      const data = JSON.parse(responseText);

      let mappedStatus = 'processing';
      if (data.status === 'COMPLETED') {
        mappedStatus = 'completed';
      } else if (data.status === 'FAILED' || data.status === 'REJECTED') {
        mappedStatus = 'failed';
      } else if (data.status === 'PENDING' || data.status === 'PROCESSING') {
        mappedStatus = 'processing';
      }

      return new Response(JSON.stringify({
        success: true,
        status: mappedStatus,
        originalStatus: data.status,
        outputUrl: data.outputUrl || null,
        error: data.error ? 'Processing failed' : null,
        creditsDeducted: data.creditsDeducted || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in generate-lipsync-syncso:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Lip-sync operation failed. Please try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
