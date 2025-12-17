// Veo 3.1 video generation edge function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Face preservation prompts by consistency level
const FACE_PROMPTS = {
  strict: `CRITICAL: Maintain exact facial features from reference image throughout entire video. Preserve: bone structure, eye color and shape, nose shape, jawline, skin tone, facial proportions, eyebrow shape, lip shape. Face identity must remain 100% consistent in every frame. The person must be clearly recognizable as the same individual from start to finish.`,
  moderate: `Maintain consistent facial features from reference image. Preserve key identifying characteristics: bone structure, eye shape, and overall facial proportions. Allow minor variations in lighting and angle while keeping the person recognizable.`,
  loose: `Use reference image as inspiration for facial features. Maintain general resemblance while allowing creative interpretation and artistic flexibility.`
};

type FaceConsistencyLevel = 'strict' | 'moderate' | 'loose';

// Input validation schemas
function validateInput(data: unknown): { valid: true; data: { prompt: string; referenceImage?: string; preserveFace?: boolean; faceConsistencyLevel: FaceConsistencyLevel; duration: number; aspectRatio: string; lyrics?: string } } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const body = data as Record<string, unknown>;

  // Validate prompt
  if (!body.prompt || typeof body.prompt !== 'string') {
    return { valid: false, error: 'Prompt is required and must be a string' };
  }
  if (body.prompt.length > 2000) {
    return { valid: false, error: 'Prompt must be less than 2000 characters' };
  }
  if (body.prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt cannot be empty' };
  }

  // Validate duration
  const duration = typeof body.duration === 'number' ? body.duration : 8;
  if (duration < 5 || duration > 8) {
    return { valid: false, error: 'Duration must be between 5 and 8 seconds' };
  }

  // Validate aspect ratio
  const validAspectRatios = ['16:9', '9:16'];
  const aspectRatio = typeof body.aspectRatio === 'string' && validAspectRatios.includes(body.aspectRatio) 
    ? body.aspectRatio 
    : '16:9';

  // Validate face consistency level
  const validLevels: FaceConsistencyLevel[] = ['strict', 'moderate', 'loose'];
  const faceConsistencyLevel = typeof body.faceConsistencyLevel === 'string' && validLevels.includes(body.faceConsistencyLevel as FaceConsistencyLevel)
    ? body.faceConsistencyLevel as FaceConsistencyLevel
    : 'strict';

  // Validate lyrics if provided
  if (body.lyrics !== undefined && body.lyrics !== null) {
    if (typeof body.lyrics !== 'string') {
      return { valid: false, error: 'Lyrics must be a string' };
    }
    if (body.lyrics.length > 5000) {
      return { valid: false, error: 'Lyrics must be less than 5000 characters' };
    }
  }

  return {
    valid: true,
    data: {
      prompt: body.prompt.trim(),
      referenceImage: typeof body.referenceImage === 'string' ? body.referenceImage : undefined,
      preserveFace: typeof body.preserveFace === 'boolean' ? body.preserveFace : true,
      faceConsistencyLevel,
      duration,
      aspectRatio,
      lyrics: typeof body.lyrics === 'string' ? body.lyrics : undefined
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

const TIER_LIMITS: Record<string, number> = {
  free: 3,
  creator_pro: 50,
  music_video_pro: 150,
};

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

    // Check subscription limits
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('subscription_tier, videos_generated_this_month, usage_reset_date')
      .eq('id', userInfo.userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tier = profile?.subscription_tier || 'free';
    let videosThisMonth = profile?.videos_generated_this_month || 0;
    const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // Check if we need to reset the monthly counter
    const usageResetDate = profile?.usage_reset_date ? new Date(profile.usage_reset_date) : new Date();
    const now = new Date();
    
    if (usageResetDate.getMonth() !== now.getMonth() || usageResetDate.getFullYear() !== now.getFullYear()) {
      videosThisMonth = 0;
      await adminClient
        .from('profiles')
        .update({ videos_generated_this_month: 0, usage_reset_date: now.toISOString() })
        .eq('id', userInfo.userId);
      console.log('Reset monthly counter for new month');
    }

    // Check if user has reached their limit
    if (videosThisMonth >= limit) {
      return new Response(
        JSON.stringify({ 
          error: `You've reached your monthly limit of ${limit} videos. Upgrade your plan for more!`,
          limitReached: true,
          tier,
          videosGenerated: videosThisMonth,
          limit
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${userInfo.userId} has generated ${videosThisMonth}/${limit} videos this month (tier: ${tier})`);

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

    // Validate input
    const rawBody = await req.json();
    const validation = validateInput(rawBody);
    
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, referenceImage, preserveFace, faceConsistencyLevel, duration, aspectRatio } = validation.data;

    console.log('Generating video with Vertex AI:', { 
      promptLength: prompt.length, 
      hasReferenceImage: !!referenceImage,
      preserveFace,
      faceConsistencyLevel,
      duration,
      aspectRatio,
      userId: userInfo.userId,
      projectId: serviceAccount.project_id
    });

    // Get OAuth2 access token
    console.log('Getting OAuth2 access token...');
    const accessToken = await getAccessToken(serviceAccount);
    console.log('Access token obtained successfully');

    // Build enhanced prompt with face preservation based on consistency level
    let enhancedPrompt = prompt;
    if (preserveFace && referenceImage) {
      const facePrompt = FACE_PROMPTS[faceConsistencyLevel];
      enhancedPrompt = `${prompt}. ${facePrompt}`;
      console.log(`Applied ${faceConsistencyLevel} face preservation to prompt`);
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
        aspectRatio: aspectRatio,
        durationSeconds: duration,
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
        const mimeType = `image/${base64Match[1]}`;
        console.log('Adding reference image with mime type:', mimeType);
        (requestBody.instances as Record<string, unknown>[])[0].image = {
          bytesBase64Encoded: base64Match[2],
          mimeType: mimeType
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

    // Increment video count for the user
    await adminClient
      .from('profiles')
      .update({ videos_generated_this_month: videosThisMonth + 1 })
      .eq('id', userInfo.userId);
    console.log(`Incremented video count for user ${userInfo.userId} to ${videosThisMonth + 1}`);

    return new Response(
      JSON.stringify({
        success: true,
        requestId: operationName,
        modelId: modelId,
        userId: userInfo.userId,
        videosRemaining: limit - (videosThisMonth + 1)
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
