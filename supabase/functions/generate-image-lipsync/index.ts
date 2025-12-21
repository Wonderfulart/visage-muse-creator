import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate JWT for service account authentication (for Veo 3.1)
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

// Fetch image and convert to base64
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  console.log('Fetching image from URL:', imageUrl.substring(0, 100));
  
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const base64 = base64Encode(arrayBuffer);
  
  // Determine mime type from content-type header or URL
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const mimeType = contentType.split(';')[0].trim();
  
  console.log('Image converted to base64, mime type:', mimeType);
  return `data:${mimeType};base64,${base64}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || 'generate';
    
    console.log('generate-image-lipsync called with action:', action);

    // ===== ACTION: GENERATE =====
    // Stage 1: Start Veo 3.1 video generation from image
    if (action === 'generate') {
      const { imageUrl, audioUrl } = body;
      
      if (!imageUrl || !audioUrl) {
        throw new Error('imageUrl and audioUrl are required');
      }
      
      console.log('Starting Veo 3.1 generation from image');
      
      // Get Vertex AI credentials
      const serviceAccountJson = Deno.env.get('VERTEX_SERVICE_ACCOUNT');
      if (!serviceAccountJson) {
        throw new Error('VERTEX_SERVICE_ACCOUNT not configured');
      }
      
      const serviceAccount = JSON.parse(serviceAccountJson);
      const accessToken = await getAccessToken(serviceAccount);
      
      // Convert image URL to base64
      const imageBase64 = await imageUrlToBase64(imageUrl);
      const base64Match = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Failed to convert image to base64');
      }
      
      // Call Veo 3.1 to generate video from image
      const projectId = serviceAccount.project_id;
      const location = 'us-central1';
      const modelId = 'veo-3.1-generate-001';
      const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;
      
      const requestBody = {
        instances: [{
          prompt: 'Person speaking naturally, subtle mouth movements synced to audio. Direct eye contact with camera. Minimal head movement. Professional lighting. High quality video.',
          image: {
            bytesBase64Encoded: base64Match[2],
            mimeType: `image/${base64Match[1]}`
          }
        }],
        parameters: {
          aspectRatio: '9:16',
          durationSeconds: 8,
          sampleCount: 1,
          personGeneration: 'allow_all',
          addWatermark: false,
          generateAudio: false
        }
      };
      
      console.log('Calling Veo 3.1 API...');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const responseText = await response.text();
      console.log('Veo 3.1 response status:', response.status);
      
      if (!response.ok) {
        console.error('Veo 3.1 error:', responseText);
        throw new Error(`Veo 3.1 API error: ${response.status} - ${responseText}`);
      }
      
      const data = JSON.parse(responseText);
      const operationName = data.name;
      console.log('Veo 3.1 operation started:', operationName);
      
      return new Response(JSON.stringify({
        success: true,
        stage: 'veo',
        veoOperationId: operationName,
        audioUrl: audioUrl // Pass through for later use
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // ===== ACTION: STATUS =====
    // Check status of either Veo or Sync.so job
    if (action === 'status') {
      const { stage, veoOperationId, syncsoJobId, audioUrl } = body;
      
      console.log('Checking status for stage:', stage);
      
      // STAGE 1: Check Veo completion
      if (stage === 'veo') {
        if (!veoOperationId) {
          throw new Error('veoOperationId is required for veo stage');
        }
        
        const serviceAccountJson = Deno.env.get('VERTEX_SERVICE_ACCOUNT');
        if (!serviceAccountJson) {
          throw new Error('VERTEX_SERVICE_ACCOUNT not configured');
        }
        
        const serviceAccount = JSON.parse(serviceAccountJson);
        const accessToken = await getAccessToken(serviceAccount);
        
        // Parse operation name
        const operationParts = veoOperationId.match(
          /projects\/([^\/]+)\/locations\/([^\/]+)\/publishers\/google\/models\/([^\/]+)\/operations\/([^\/]+)/
        );
        
        if (!operationParts) {
          throw new Error('Invalid veoOperationId format');
        }
        
        const [, projectId, location, modelId] = operationParts;
        const statusUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;
        
        const response = await fetch(statusUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ operationName: veoOperationId })
        });
        
        const responseText = await response.text();
        console.log('Veo status response:', response.status);
        
        if (!response.ok) {
          throw new Error(`Veo status check failed: ${response.status}`);
        }
        
        const data = JSON.parse(responseText);
        
        if (data.done === true) {
          if (data.error) {
            console.error('Veo generation failed:', data.error);
            return new Response(JSON.stringify({
              success: false,
              status: 'failed',
              stage: 'veo',
              error: data.error.message || 'Veo generation failed'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Extract video URL from Veo response
          let videoUrl = null;
          const result = data.response;
          
          if (result?.videos && result.videos.length > 0) {
            const video = result.videos[0];
            if (video.bytesBase64Encoded) {
              // Upload base64 video to storage and get URL
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
              const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              const supabase = createClient(supabaseUrl, supabaseKey);
              
              const base64Data = video.bytesBase64Encoded;
              const binaryStr = atob(base64Data);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              
              const fileName = `temp/veo-output-${Date.now()}-${crypto.randomUUID()}.mp4`;
              
              const { error: uploadError } = await supabase.storage
                .from('videos')
                .upload(fileName, bytes, {
                  contentType: 'video/mp4',
                  cacheControl: '3600'
                });
              
              if (uploadError) {
                throw new Error(`Failed to upload Veo video: ${uploadError.message}`);
              }
              
              // Get signed URL
              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from('videos')
                .createSignedUrl(fileName, 3600);
              
              if (signedUrlError || !signedUrlData) {
                throw new Error('Failed to create signed URL for Veo video');
              }
              
              videoUrl = signedUrlData.signedUrl;
            } else {
              videoUrl = video.gcsUri || video.uri;
            }
          }
          
          if (!videoUrl) {
            throw new Error('No video URL in Veo response');
          }
          
          console.log('Veo completed, video URL:', videoUrl.substring(0, 100));
          
          // Now start Sync.so lipsync job
          const SYNC_API_KEY = Deno.env.get('SYNC_API_KEY');
          if (!SYNC_API_KEY) {
            throw new Error('SYNC_API_KEY not configured');
          }
          
          console.log('Starting Sync.so lipsync with video URL');
          
          const syncResponse = await fetch('https://api.sync.so/v2/generate', {
            method: 'POST',
            headers: {
              'x-api-key': SYNC_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'lipsync-2',
              input: [
                { type: 'video', url: videoUrl },
                { type: 'audio', url: audioUrl }
              ]
            }),
          });
          
          const syncText = await syncResponse.text();
          console.log('Sync.so response:', syncResponse.status, syncText);
          
          if (!syncResponse.ok) {
            throw new Error(`Sync.so API error: ${syncResponse.status} - ${syncText}`);
          }
          
          const syncData = JSON.parse(syncText);
          console.log('Sync.so job started:', syncData.id);
          
          return new Response(JSON.stringify({
            success: true,
            status: 'processing',
            stage: 'syncso',
            syncsoJobId: syncData.id,
            veoVideoUrl: videoUrl
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Still processing
        return new Response(JSON.stringify({
          success: true,
          status: 'processing',
          stage: 'veo',
          veoOperationId,
          audioUrl
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // STAGE 2: Check Sync.so completion
      if (stage === 'syncso') {
        if (!syncsoJobId) {
          throw new Error('syncsoJobId is required for syncso stage');
        }
        
        const SYNC_API_KEY = Deno.env.get('SYNC_API_KEY');
        if (!SYNC_API_KEY) {
          throw new Error('SYNC_API_KEY not configured');
        }
        
        console.log('Checking Sync.so job status:', syncsoJobId);
        
        const response = await fetch(`https://api.sync.so/v2/generate/${syncsoJobId}`, {
          method: 'GET',
          headers: {
            'x-api-key': SYNC_API_KEY,
          },
        });
        
        const responseText = await response.text();
        console.log('Sync.so status response:', response.status);
        
        if (!response.ok) {
          throw new Error(`Sync.so status check failed: ${response.status}`);
        }
        
        const data = JSON.parse(responseText);
        
        if (data.status === 'COMPLETED') {
          console.log('Sync.so completed, output URL:', data.outputUrl);
          return new Response(JSON.stringify({
            success: true,
            status: 'completed',
            stage: 'syncso',
            outputUrl: data.outputUrl
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else if (data.status === 'FAILED' || data.status === 'REJECTED') {
          console.error('Sync.so failed:', data.error);
          return new Response(JSON.stringify({
            success: false,
            status: 'failed',
            stage: 'syncso',
            error: data.error || 'Sync.so generation failed'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Still processing
        return new Response(JSON.stringify({
          success: true,
          status: 'processing',
          stage: 'syncso',
          syncsoJobId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`Unknown stage: ${stage}`);
    }
    
    throw new Error(`Unknown action: ${action}`);
    
  } catch (error) {
    console.error('Error in generate-image-lipsync:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
