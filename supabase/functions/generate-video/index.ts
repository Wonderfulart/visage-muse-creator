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

    const { prompt, referenceImage, preserveFace, duration, aspectRatio } = await req.json();

    console.log('Generating video with params:', { 
      promptLength: prompt?.length, 
      hasReferenceImage: !!referenceImage,
      preserveFace,
      duration,
      aspectRatio
    });

    // Use Google's Generative Language API for Veo
    const modelId = 'veo-3.0-generate-001';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predictLongRunning?key=${VEO_API_KEY}`;
    
    // Build enhanced prompt
    let enhancedPrompt = prompt;
    if (preserveFace && referenceImage) {
      enhancedPrompt = `${prompt}. Maintain exact facial features and identity of the person in the reference image.`;
    }

    // Build request body for Google's Veo API
    const requestBody: Record<string, unknown> = {
      instances: [
        {
          prompt: enhancedPrompt
        }
      ],
      parameters: {
        aspectRatio: aspectRatio || '16:9',
        durationSeconds: duration || 5,
        numberOfVideos: 1
      }
    };

    // Add reference image if provided
    if (referenceImage) {
      const base64Match = referenceImage.match(/^data:image\/\w+;base64,(.+)$/);
      if (base64Match) {
        (requestBody.instances as any[])[0].image = {
          bytesBase64Encoded: base64Match[1]
        };
      }
    }

    console.log('Sending request to Google Veo API');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Google Veo response status:', response.status);

    if (!response.ok) {
      console.error('Google Veo error:', responseText);
      
      let errorMessage = 'Video generation failed';
      let hint = 'Ensure your Google API key has access to the Generative Language API and Veo models';
      
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorMessage;
        
        if (response.status === 403) {
          hint = 'API access denied. Enable the Generative Language API in your Google Cloud Console and ensure Veo access.';
        } else if (response.status === 400) {
          hint = 'Invalid request. Try adjusting your prompt or settings.';
        }
      } catch {
        errorMessage = responseText || errorMessage;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: responseText, hint }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse response');
      return new Response(
        JSON.stringify({ error: 'Invalid response from API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Video generation started, operation:', data.name);

    return new Response(
      JSON.stringify({
        success: true,
        requestId: data.name, // Operation name for status checking
        modelId: modelId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-video function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
