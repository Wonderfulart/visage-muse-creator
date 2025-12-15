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
      console.error('VEO_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'VEO API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { operationName } = await req.json();

    if (!operationName) {
      return new Response(
        JSON.stringify({ error: 'Operation name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking status for operation:', operationName);

    // Poll the operation status
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${VEO_API_KEY}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    console.log('Operation status:', data.done ? 'completed' : 'in progress');

    if (data.done) {
      if (data.error) {
        console.error('Operation failed:', data.error);
        return new Response(
          JSON.stringify({ 
            status: 'failed',
            error: data.error.message 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract video URLs from the response
      const videos = data.response?.generatedVideos || [];
      console.log('Generated videos count:', videos.length);

      return new Response(
        JSON.stringify({
          status: 'completed',
          videos: videos.map((v: { video?: { uri?: string } }) => ({
            uri: v.video?.uri
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'processing',
        metadata: data.metadata
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking video status:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
