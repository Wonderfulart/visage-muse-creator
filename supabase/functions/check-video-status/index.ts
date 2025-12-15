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
    const VEO_API_KEY = Deno.env.get('Vertex_api');
    
    if (!VEO_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'VEO API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestId } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: 'Request ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking status for operation:', requestId);

    // Use Gemini API operation status endpoint
    const statusUrl = `https://generativelanguage.googleapis.com/v1beta/${requestId}?key=${VEO_API_KEY}`;
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('Status response:', response.status);
    console.log('Response body preview:', responseText.substring(0, 300));

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

    console.log('Operation done:', data.done, 'Has error:', !!data.error);

    // Check if operation is complete
    if (data.done === true) {
      if (data.error) {
        return new Response(
          JSON.stringify({ 
            status: 'failed',
            error: data.error.message || 'Video generation failed'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract video URL from response - handle different response structures
      const result = data.response || data.result;
      let videoUrl = null;

      // Try different paths for video URL
      if (result?.generatedVideos && result.generatedVideos.length > 0) {
        const video = result.generatedVideos[0];
        videoUrl = video.video?.uri || video.uri || video.videoUri;
      } else if (result?.videos && result.videos.length > 0) {
        videoUrl = result.videos[0].uri || result.videos[0].url;
      }

      console.log('Extracted video URL:', videoUrl);

      return new Response(
        JSON.stringify({
          status: 'completed',
          videos: videoUrl ? [{ uri: videoUrl }] : [],
          videoUrl: videoUrl
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Still processing
    return new Response(
      JSON.stringify({
        status: 'processing',
        progress: data.metadata?.progress || null
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
