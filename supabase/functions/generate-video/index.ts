import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate JWT for service account authentication
async function generateJWT(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform'
  };

  const encodedHeader = base64Encode(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = base64Encode(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signInput = `${encodedHeader}.${encodedPayload}`;

  // Import private key and sign
  const pemContent = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signInput)
  );

  const encodedSignature = base64Encode(signature).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${signInput}.${encodedSignature}`;
}

// Exchange JWT for access token
async function getAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const jwt = await generateJWT(serviceAccount);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get('VERTEX_SERVICE_ACCOUNT');
    
    if (!serviceAccountJson) {
      console.error('VERTEX_SERVICE_ACCOUNT is not configured');
      return new Response(
        JSON.stringify({ error: 'Vertex AI service account not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      console.error('Failed to parse service account JSON');
      return new Response(
        JSON.stringify({ error: 'Invalid service account JSON format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, referenceImage, preserveFace, duration, aspectRatio } = await req.json();

    console.log('Generating video with Vertex AI:', { 
      promptLength: prompt?.length, 
      hasReferenceImage: !!referenceImage,
      preserveFace,
      duration,
      aspectRatio,
      projectId: serviceAccount.project_id
    });

    // Get OAuth2 access token
    console.log('Getting OAuth2 access token...');
    const accessToken = await getAccessToken(serviceAccount);
    console.log('Access token obtained successfully');

    // Build enhanced prompt
    let enhancedPrompt = prompt;
    if (preserveFace && referenceImage) {
      enhancedPrompt = `${prompt}. Maintain exact facial features and identity of the person in the reference image.`;
    }

    // Vertex AI endpoint for Veo 3.1
    const projectId = serviceAccount.project_id;
    const location = 'us-central1';
    const modelId = 'veo-3.1-generate-001';
    const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

    // Build request body for Vertex AI Veo 3.1
    const requestBody: Record<string, unknown> = {
      instances: [{
        prompt: enhancedPrompt
      }],
      parameters: {
        aspectRatio: aspectRatio || '16:9',
        sampleCount: 1,
        personGeneration: 'allow_all',
        addWatermark: true,
        generateAudio: true
      }
    };

    // Add reference image if provided
    if (referenceImage) {
      const base64Match = referenceImage.match(/^data:image\/(\w+);base64,(.+)$/);
      if (base64Match) {
        (requestBody.instances as Record<string, unknown>[])[0].image = {
          bytesBase64Encoded: base64Match[2]
        };
      }
    }

    console.log('Sending request to Vertex AI:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Vertex AI response status:', response.status);
    console.log('Response body:', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('Vertex AI error:', responseText);
      
      let errorMessage = 'Video generation failed';
      let hint = 'Check that your service account has access to Vertex AI and Veo is enabled in your project';
      
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorMessage;
        
        if (response.status === 403) {
          hint = 'Permission denied. Ensure your service account has the Vertex AI User role and Veo is enabled.';
        } else if (response.status === 404) {
          hint = 'Model or endpoint not found. Veo may not be available in your project or region.';
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
    const operationName = data.name;
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
