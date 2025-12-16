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
      return new Response(
        JSON.stringify({ error: 'Vertex AI service account not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid service account JSON format' }),
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

    // Parse operation name to extract components
    // Format: projects/{project}/locations/{location}/publishers/google/models/{model}/operations/{opId}
    const operationParts = requestId.match(
      /projects\/([^\/]+)\/locations\/([^\/]+)\/publishers\/google\/models\/([^\/]+)\/operations\/([^\/]+)/
    );

    if (!operationParts) {
      console.error('Invalid operation name format:', requestId);
      return new Response(
        JSON.stringify({ status: 'failed', error: 'Invalid operation name format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [, projectId, location, modelId] = operationParts;
    console.log('Parsed operation:', { projectId, location, modelId });

    // Get OAuth2 access token
    const accessToken = await getAccessToken(serviceAccount);

    // Build the correct fetchPredictOperation endpoint
    const statusUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;
    
    console.log('Fetching status from:', statusUrl);

    const response = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operationName: requestId
      })
    });

    const responseText = await response.text();
    console.log('Status response:', response.status);
    console.log('Response body preview:', responseText.substring(0, 500));

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

      // Extract video URL from Vertex AI response
      const result = data.response;
      let videoUrl = null;

      console.log('Response result:', JSON.stringify(result).substring(0, 500));

      // Vertex AI Veo returns videos in result.videos array with gcsUri
      if (result?.videos && result.videos.length > 0) {
        const video = result.videos[0];
        videoUrl = video.gcsUri || video.uri;
      } else if (result?.predictions && result.predictions.length > 0) {
        const prediction = result.predictions[0];
        videoUrl = prediction.videoUri || prediction.video?.uri || prediction.gcsUri;
      } else if (result?.generatedVideos && result.generatedVideos.length > 0) {
        videoUrl = result.generatedVideos[0].video?.uri;
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

    // Still processing - check for progress metadata
    const progress = data.metadata?.progressPercent || data.metadata?.progress || null;

    return new Response(
      JSON.stringify({
        status: 'processing',
        progress: progress
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
