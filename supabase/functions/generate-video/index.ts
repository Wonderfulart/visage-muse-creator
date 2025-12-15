import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Build the request for Veo 3.1 API
    // Veo 3.1 API endpoint for video generation
    const veoEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/veo-3.1:generateVideos';
    
    const requestBody: Record<string, unknown> = {
      prompt: prompt,
      config: {
        duration: duration || 8,
        aspectRatio: aspectRatio || '16:9',
      }
    };

    // Add reference image with face preservation if provided
    if (referenceImage) {
      // Extract base64 data from data URL if present
      const base64Data = referenceImage.includes('base64,') 
        ? referenceImage.split('base64,')[1] 
        : referenceImage;
      
      requestBody.referenceImages = [{
        image: {
          bytesBase64Encoded: base64Data
        },
        config: {
          referenceType: preserveFace ? 'REFERENCE_TYPE_SUBJECT' : 'REFERENCE_TYPE_STYLE',
          // For face preservation, we use strict adherence
          subjectConfig: preserveFace ? {
            subjectType: 'SUBJECT_TYPE_PERSON',
            adherenceLevel: 'ADHERENCE_LEVEL_STRICT'
          } : undefined
        }
      }];
    }

    console.log('Sending request to Veo API...');

    const response = await fetch(`${veoEndpoint}?key=${VEO_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Veo API response status:', response.status);

    if (!response.ok) {
      console.error('Veo API error:', responseText);
      return new Response(
        JSON.stringify({ 
          error: 'Video generation failed', 
          details: responseText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse Veo response:', responseText);
      return new Response(
        JSON.stringify({ error: 'Invalid response from Veo API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Video generation initiated successfully');

    // Return the operation name for polling or the video URL if immediately available
    return new Response(
      JSON.stringify({
        success: true,
        operationName: data.name,
        data: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-video function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
