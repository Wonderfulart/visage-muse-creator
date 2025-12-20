import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SYNC_API_KEY = Deno.env.get('SYNC_API_KEY');
    if (!SYNC_API_KEY) {
      console.error('SYNC_API_KEY not configured');
      throw new Error('SYNC_API_KEY is not configured');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'generate';

    if (action === 'generate') {
      // Generate lip-sync video
      const { characterImageUrl, audioUrl, model = 'lipsync-1.9.0-beta' }: GenerateRequest = await req.json();

      console.log('Starting lip-sync generation:', { characterImageUrl, audioUrl, model });

      if (!characterImageUrl || !audioUrl) {
        throw new Error('characterImageUrl and audioUrl are required');
      }

      // lipsync-1.9.0-beta supports image input for image-to-video
      // lipsync-2 requires video input
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
      console.log('Sync.so generate response:', response.status, responseText);

      if (!response.ok) {
        throw new Error(`Sync.so API error: ${response.status} - ${responseText}`);
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
      console.log('Sync.so status response:', response.status, responseText);

      if (!response.ok) {
        throw new Error(`Sync.so API error: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);

      // Map Sync.so status to our status format
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
        error: data.error || null,
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
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
