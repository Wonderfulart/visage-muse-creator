import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VEO_API_KEY = Deno.env.get('VEO_API_KEY');
    
    if (!VEO_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'VEO API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestId, modelId } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: 'Request ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const model = modelId || 'fal-ai/veo3';
    console.log('Checking status for request:', requestId, 'model:', model);

    // Check status with Fal.ai
    const statusUrl = `https://queue.fal.run/${model}/requests/${requestId}/status`;
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${VEO_API_KEY}`,
      },
    });

    const responseText = await response.text();
    console.log('Status response:', response.status, responseText.substring(0, 500));

    if (!response.ok) {
      console.error('Status check failed:', responseText);
      return new Response(
        JSON.stringify({ 
          status: 'failed',
          error: `Failed to check status: ${response.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ status: 'failed', error: 'Invalid response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Request status:', data.status);

    // Fal.ai statuses: IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED
    if (data.status === 'COMPLETED') {
      // Fetch the result
      const resultUrl = `https://queue.fal.run/${model}/requests/${requestId}`;
      const resultResponse = await fetch(resultUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Key ${VEO_API_KEY}`,
        },
      });

      const resultText = await resultResponse.text();
      console.log('Result response:', resultText.substring(0, 500));

      let resultData;
      try {
        resultData = JSON.parse(resultText);
      } catch {
        return new Response(
          JSON.stringify({ status: 'failed', error: 'Failed to parse result' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract video URL from Fal.ai response
      const videoUrl = resultData.video?.url || resultData.output?.video?.url;
      
      return new Response(
        JSON.stringify({
          status: 'completed',
          videos: videoUrl ? [{ uri: videoUrl }] : [],
          data: resultData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (data.status === 'FAILED') {
      return new Response(
        JSON.stringify({ 
          status: 'failed',
          error: data.error || 'Video generation failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Still processing (IN_QUEUE or IN_PROGRESS)
    return new Response(
      JSON.stringify({
        status: 'processing',
        queuePosition: data.queue_position,
        logs: data.logs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking video status:', error);
    return new Response(
      JSON.stringify({ 
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
