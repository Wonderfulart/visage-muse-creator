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

    // Use Gemini API generateVideos endpoint (works with API keys)
    const modelId = 'veo-3.0-generate-001';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateVideos?key=${VEO_API_KEY}`;
    
    // Build enhanced prompt
    let enhancedPrompt = prompt;
    if (preserveFace && referenceImage) {
      enhancedPrompt = `${prompt}. Maintain exact facial features and identity of the person in the reference image.`;
    }

    // Build request body for Gemini API generateVideos endpoint
    const requestBody: Record<string, unknown> = {
      prompt: enhancedPrompt,
      config: {
        aspectRatio: aspectRatio || '16:9',
        durationSeconds: duration || 5,
        numberOfVideos: 1
      }
    };

    // Add reference image if provided
    if (referenceImage) {
      const base64Match = referenceImage.match(/^data:image\/(\w+);base64,(.+)$/);
      if (base64Match) {
        requestBody.referenceImages = [{
          image: {
            imageBytes: base64Match[2]
          },
          operation: preserveFace ? 'SUBJECT_REFERENCE' : 'STYLE_REFERENCE'
        }];
      }
    }

    console.log('Sending request to Gemini API generateVideos endpoint');
    console.log('Request URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Gemini API response status:', response.status);
    console.log('Response body:', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('Gemini API error:', responseText);
      
      let errorMessage = 'Video generation failed';
      let hint = 'Ensure your API key is from Google AI Studio (aistudio.google.com) and has Veo access';
      
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorMessage;
        
        if (response.status === 403) {
          hint = 'API access denied. Your API key may not have Veo access. Get a key from aistudio.google.com/apikey';
        } else if (response.status === 400) {
          hint = 'Invalid request. Try adjusting your prompt or settings.';
        } else if (response.status === 404) {
          hint = 'Model not found. Veo may not be available in your region or for your API key.';
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

    // The response contains an operation name for async generation
    const operationName = data.name || data.operationName;
    console.log('Video generation started, operation:', operationName);

    return new Response(
      JSON.stringify({
        success: true,
        requestId: operationName,
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
