import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation
function validateInput(data: unknown): { valid: true; data: { requestId: string; prompt?: string; lyrics?: string; duration: number; aspectRatio: string } } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const body = data as Record<string, unknown>;

  // Validate requestId
  if (!body.requestId || typeof body.requestId !== 'string') {
    return { valid: false, error: 'Request ID is required and must be a string' };
  }
  
  // Validate requestId format
  const operationPattern = /projects\/[^\/]+\/locations\/[^\/]+\/publishers\/google\/models\/[^\/]+\/operations\/[^\/]+/;
  if (!operationPattern.test(body.requestId)) {
    return { valid: false, error: 'Invalid operation name format' };
  }

  // Validate prompt if provided
  if (body.prompt !== undefined && body.prompt !== null && typeof body.prompt !== 'string') {
    return { valid: false, error: 'Prompt must be a string' };
  }

  // Validate lyrics if provided
  if (body.lyrics !== undefined && body.lyrics !== null && typeof body.lyrics !== 'string') {
    return { valid: false, error: 'Lyrics must be a string' };
  }

  const duration = typeof body.duration === 'number' ? body.duration : 8;
  const validAspectRatios = ['16:9', '9:16'];
  const aspectRatio = typeof body.aspectRatio === 'string' && validAspectRatios.includes(body.aspectRatio) 
    ? body.aspectRatio 
    : '16:9';

  return {
    valid: true,
    data: {
      requestId: body.requestId,
      prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
      lyrics: typeof body.lyrics === 'string' ? body.lyrics : undefined,
      duration,
      aspectRatio
    }
  };
}

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

// Get user from JWT token
async function getUserFromToken(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return { userId: user.id };
}

// Save video to storage and database with user_id
async function saveVideoToStorage(
  videoBase64: string,
  prompt: string,
  lyrics: string | undefined,
  duration: number,
  aspectRatio: string,
  userId: string
): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Decode base64 to binary
  const base64Data = videoBase64.replace('data:video/mp4;base64,', '');
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Generate unique filename with user_id prefix for RLS
  const fileName = `${userId}/video_${Date.now()}_${crypto.randomUUID()}.mp4`;
  
  console.log('Uploading video to storage:', fileName);

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('videos')
    .upload(fileName, bytes, {
      contentType: 'video/mp4',
      cacheControl: '3600'
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Failed to upload video: ${uploadError.message}`);
  }

  // Generate signed URL (valid for 1 hour)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('videos')
    .createSignedUrl(fileName, 3600);

  if (signedUrlError || !signedUrlData) {
    console.error('Failed to create signed URL:', signedUrlError);
    throw new Error('Failed to create signed URL');
  }

  const videoUrl = signedUrlData.signedUrl;
  console.log('Video uploaded, signed URL created');

  // Save to database with user_id
  const { error: dbError } = await supabase.from('videos').insert({
    prompt,
    lyrics: lyrics || null,
    video_url: fileName, // Store the path, not the signed URL
    duration,
    aspect_ratio: aspectRatio,
    status: 'completed',
    user_id: userId
  });

  if (dbError) {
    console.error('Database insert error:', dbError);
    // Don't throw, video is still accessible
  }

  return videoUrl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const userInfo = await getUserFromToken(req);
    if (!userInfo) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please log in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', userInfo.userId);

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

    // Validate input
    const rawBody = await req.json();
    const validation = validateInput(rawBody);
    
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestId, prompt, lyrics, duration, aspectRatio } = validation.data;

    console.log('Checking status for operation:', requestId);

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

    const accessToken = await getAccessToken(serviceAccount);

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

    if (data.done === true) {
      if (data.error) {
        const errorMessage = data.error.message || 'Video generation failed';
        const isContentPolicy = errorMessage.toLowerCase().includes('usage guidelines') ||
                               errorMessage.toLowerCase().includes('content policy') ||
                               errorMessage.toLowerCase().includes('violat') ||
                               errorMessage.toLowerCase().includes('could not be submitted');
        
        console.error('Video generation failed:', errorMessage);
        
        return new Response(
          JSON.stringify({ 
            status: 'failed',
            error: errorMessage,
            errorType: isContentPolicy ? 'content_policy' : 'generation_error',
            suggestion: isContentPolicy 
              ? 'Your prompt contains content that violates AI safety guidelines. Try using more abstract, visual descriptions without references to violence, relationships, or sensitive themes.'
              : 'Video generation failed. Try simplifying your prompt or generating again.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = data.response;
      let videoUrl = null;
      let isBase64 = false;

      console.log('Response result keys:', result ? Object.keys(result) : 'null');

      if (result?.videos && result.videos.length > 0) {
        const video = result.videos[0];
        
        if (video.bytesBase64Encoded) {
          console.log('Found base64 encoded video, will save to storage');
          videoUrl = `data:video/mp4;base64,${video.bytesBase64Encoded}`;
          isBase64 = true;
        } else {
          videoUrl = video.gcsUri || video.uri;
        }
      } else if (result?.predictions && result.predictions.length > 0) {
        const prediction = result.predictions[0];
        if (prediction.bytesBase64Encoded) {
          videoUrl = `data:video/mp4;base64,${prediction.bytesBase64Encoded}`;
          isBase64 = true;
        } else {
          videoUrl = prediction.videoUri || prediction.video?.uri || prediction.gcsUri;
        }
      } else if (result?.generatedVideos && result.generatedVideos.length > 0) {
        const genVideo = result.generatedVideos[0];
        if (genVideo.bytesBase64Encoded) {
          videoUrl = `data:video/mp4;base64,${genVideo.bytesBase64Encoded}`;
          isBase64 = true;
        } else {
          videoUrl = genVideo.video?.uri;
        }
      }

      // If we have a base64 video, save it to storage with user_id
      if (videoUrl && isBase64) {
        try {
          console.log('Saving video to storage for user:', userInfo.userId);
          const storedUrl = await saveVideoToStorage(
            videoUrl,
            prompt || 'Untitled video',
            lyrics,
            duration,
            aspectRatio,
            userInfo.userId
          );
          videoUrl = storedUrl;
          console.log('Video saved to storage with signed URL');
        } catch (saveError) {
          console.error('Failed to save video to storage:', saveError);
          // Continue with base64 URL if storage fails
        }
      }

      console.log('Final video URL type:', videoUrl?.startsWith('data:') ? 'base64 data URL' : 'signed URL');

      return new Response(
        JSON.stringify({
          status: 'completed',
          videos: videoUrl ? [{ uri: videoUrl }] : [],
          videoUrl: videoUrl
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        error: 'Failed to check video status. Please try again.' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
