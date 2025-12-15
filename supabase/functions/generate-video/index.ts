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

    // Use Fal.ai's Veo 3.1 API which supports simple API key auth
    // Supports image-to-video with reference images
    const modelId = referenceImage ? 'fal-ai/veo3.1' : 'fal-ai/veo3';
    const falEndpoint = `https://queue.fal.run/${modelId}`;
    
    // Build request body according to Fal.ai schema
    const requestBody: Record<string, unknown> = {
      prompt: prompt,
      aspect_ratio: aspectRatio || '16:9',
      duration: `${duration || 8}s`,
      enhance_prompt: true,
      resolution: '720p',
      generate_audio: true,
    };

    // Add reference image if provided
    if (referenceImage) {
      // For Veo 3.1 with image input
      requestBody.image_url = referenceImage; // Fal.ai accepts base64 data URIs
      
      // Add face preservation hint in prompt if enabled
      if (preserveFace) {
        requestBody.prompt = `${prompt}. Maintain exact facial features and identity of the person in the reference image.`;
        requestBody.negative_prompt = 'distorted face, changed facial features, different person, morphed face';
      }
    }

    console.log('Sending request to Fal.ai:', falEndpoint);

    // Submit to Fal.ai queue
    const response = await fetch(falEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${VEO_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Fal.ai response status:', response.status);
    console.log('Fal.ai response:', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('Fal.ai error:', responseText);
      
      let errorMessage = 'Video generation failed';
      let hint = 'Get your FAL API key from https://fal.ai/dashboard/keys';
      
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.detail || errorData.error || errorData.message || errorMessage;
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

    console.log('Video generation queued, request_id:', data.request_id);

    return new Response(
      JSON.stringify({
        success: true,
        requestId: data.request_id,
        statusUrl: data.status_url || `https://queue.fal.run/${modelId}/requests/${data.request_id}/status`,
        data: data
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
