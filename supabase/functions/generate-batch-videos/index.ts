// Batch video generation edge function for multiple scenes
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Scene {
  id: string;
  order: number;
  prompt: string;
  duration: number;
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

// Generate a single video
async function generateSingleVideo(
  scene: Scene,
  accessToken: string,
  projectId: string,
  aspectRatio: string,
  referenceImage?: string,
  preserveFace?: boolean,
  addWatermark: boolean = true
): Promise<{ success: boolean; requestId?: string; error?: string; order: number }> {
  try {
    const location = 'us-central1';
    const modelId = 'veo-3.1-generate-001';
    const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

    let enhancedPrompt = scene.prompt;
    if (preserveFace && referenceImage) {
      enhancedPrompt = `${scene.prompt}. Maintain exact facial features and identity of the person in the reference image.`;
    }

    const requestBody: Record<string, unknown> = {
      instances: [{
        prompt: enhancedPrompt
      }],
      parameters: {
        aspectRatio: aspectRatio,
        durationSeconds: Math.min(Math.max(scene.duration, 5), 8),
        sampleCount: 1,
        personGeneration: 'allow_all',
        addWatermark: addWatermark,
        generateAudio: true
      }
    };

    // Add reference image if provided
    if (referenceImage) {
      const base64Match = referenceImage.match(/^data:image\/(\w+);base64,(.+)$/);
      if (base64Match) {
        const mimeType = `image/${base64Match[1]}`;
        (requestBody.instances as Record<string, unknown>[])[0].image = {
          bytesBase64Encoded: base64Match[2],
          mimeType: mimeType
        };
      }
    }

    console.log(`Generating scene ${scene.order}: ${scene.prompt.substring(0, 50)}...`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`Scene ${scene.order} failed:`, responseText);
      return { success: false, error: responseText, order: scene.order };
    }

    const data = JSON.parse(responseText);
    console.log(`Scene ${scene.order} started, operation:`, data.name);

    return { success: true, requestId: data.name, order: scene.order };
  } catch (error) {
    console.error(`Scene ${scene.order} error:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', order: scene.order };
  }
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

    console.log('Batch generation for user:', userInfo.userId);

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

    const body = await req.json();
    const { scenes, referenceImage, preserveFace, aspectRatio } = body as {
      scenes: Scene[];
      referenceImage?: string;
      preserveFace?: boolean;
      aspectRatio?: string;
    };

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one scene is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (scenes.length > 10) {
      return new Response(
        JSON.stringify({ error: 'Maximum 10 scenes allowed per batch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate scenes
    for (const scene of scenes) {
      if (!scene.prompt || scene.prompt.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: `Scene ${scene.order} has no prompt` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check subscription tier for watermark
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: profile } = await adminClient
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userInfo.userId)
      .single();

    const tier = profile?.subscription_tier || 'free';
    const shouldAddWatermark = tier === 'free';
    console.log(`Batch generation for tier ${tier}, watermark: ${shouldAddWatermark}`);

    console.log(`Starting batch generation of ${scenes.length} scenes`);

    // Get OAuth2 access token
    const accessToken = await getAccessToken(serviceAccount);
    console.log('Access token obtained');

    // Generate all scenes
    const results = await Promise.all(
      scenes.map(scene => 
        generateSingleVideo(
          scene,
          accessToken,
          serviceAccount.project_id,
          aspectRatio || '16:9',
          referenceImage,
          preserveFace,
          shouldAddWatermark
        )
      )
    );

    const successCount = results.filter(r => r.success).length;
    console.log(`Batch generation complete: ${successCount}/${scenes.length} scenes started`);

    return new Response(
      JSON.stringify({
        success: true,
        operations: results,
        totalScenes: scenes.length,
        successCount,
        userId: userInfo.userId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-batch-videos function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
