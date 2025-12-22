import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Authentication helper
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

// Get admin supabase client
function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Generate JWT for Vertex AI authentication
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

// Calculate segments from audio duration
function calculateSegments(durationMs: number, segmentLengthMs: number = 8000): Array<{ start: number; end: number }> {
  const segments: Array<{ start: number; end: number }> = [];
  let current = 0;
  
  while (current < durationMs) {
    const end = Math.min(current + segmentLengthMs, durationMs);
    segments.push({ start: current, end });
    current = end;
  }
  
  return segments;
}

// Update job status with logging
async function updateJobStatus(adminClient: any, jobId: string, status: string, extraFields: Record<string, any> = {}) {
  console.log(`[Job ${jobId}] Status transition -> ${status}`, extraFields);
  
  const { error } = await adminClient
    .from('music_video_jobs')
    .update({ status, ...extraFields, updated_at: new Date().toISOString() })
    .eq('id', jobId);
    
  if (error) {
    console.error(`[Job ${jobId}] Failed to update status:`, error);
    throw error;
  }
}

// Update segment with logging
async function updateSegment(adminClient: any, segmentId: string, fields: Record<string, any>) {
  console.log(`[Segment ${segmentId}] Updating:`, Object.keys(fields));
  
  const { error } = await adminClient
    .from('video_segments')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', segmentId);
    
  if (error) {
    console.error(`[Segment ${segmentId}] Failed to update:`, error);
    throw error;
  }
}

// Increment completed segments count
async function incrementCompletedSegments(adminClient: any, jobId: string) {
  const { data: job } = await adminClient
    .from('music_video_jobs')
    .select('completed_segments, total_segments, status')
    .eq('id', jobId)
    .single();
    
  if (job) {
    const newCount = (job.completed_segments || 0) + 1;
    console.log(`[Job ${jobId}] Completed segments: ${newCount}/${job.total_segments}`);
    
    await adminClient
      .from('music_video_jobs')
      .update({ 
        completed_segments: newCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
      
    // Check if all segments are done
    if (newCount >= job.total_segments && job.status === 'generating_videos') {
      await updateJobStatus(adminClient, jobId, 'lip_syncing');
    }
  }
}

// ACTION: Create job
async function handleCreate(adminClient: any, userId: string, body: any) {
  const { audioUrl, characterImageUrl, useLipsync = true, durationMs } = body;
  
  if (!audioUrl) {
    throw new Error('audioUrl is required');
  }
  
  console.log(`[Create] Starting job for user ${userId}`);
  
  // Create job record
  const { data: job, error: jobError } = await adminClient
    .from('music_video_jobs')
    .insert({
      user_id: userId,
      audio_url: audioUrl,
      character_image_url: characterImageUrl || null,
      use_lipsync: useLipsync && !!characterImageUrl,
      status: 'uploaded'
    })
    .select()
    .single();
    
  if (jobError) {
    console.error('[Create] Failed to create job:', jobError);
    throw jobError;
  }
  
  console.log(`[Job ${job.id}] Created`);
  
  // Calculate segments (8 second chunks)
  const audioDuration = durationMs || 60000; // Default 60s if not provided
  const segments = calculateSegments(audioDuration, 8000);
  
  console.log(`[Job ${job.id}] Calculated ${segments.length} segments from ${audioDuration}ms audio`);
  
  // Create segment records
  const segmentRecords = segments.map((seg, i) => ({
    job_id: job.id,
    segment_index: i,
    start_ms: seg.start,
    end_ms: seg.end,
    veo_status: 'queued',
    sync_status: 'not_started'
  }));
  
  const { error: segError } = await adminClient
    .from('video_segments')
    .insert(segmentRecords);
    
  if (segError) {
    console.error(`[Job ${job.id}] Failed to create segments:`, segError);
    throw segError;
  }
  
  // Update job status
  await updateJobStatus(adminClient, job.id, 'audio_split', { total_segments: segments.length });
  
  return { jobId: job.id, totalSegments: segments.length };
}

// ACTION: Generate prompts for each segment
async function handleGeneratePrompts(adminClient: any, userId: string, body: any) {
  const { jobId, lyrics, characterAnalysis } = body;
  
  if (!jobId) throw new Error('jobId is required');
  
  // Verify job ownership
  const { data: job, error: jobError } = await adminClient
    .from('music_video_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();
    
  if (jobError || !job) {
    throw new Error('Job not found or access denied');
  }
  
  console.log(`[Job ${jobId}] Generating prompts`);
  
  // Get all segments
  const { data: segments } = await adminClient
    .from('video_segments')
    .select('*')
    .eq('job_id', jobId)
    .order('segment_index');
    
  if (!segments?.length) {
    throw new Error('No segments found for job');
  }
  
  // Generate a prompt for each segment
  const totalSegments = segments.length;
  
  for (const segment of segments) {
    const timeLabel = `${(segment.start_ms / 1000).toFixed(1)}s - ${(segment.end_ms / 1000).toFixed(1)}s`;
    const position = segment.segment_index / (totalSegments - 1 || 1); // 0 to 1
    
    // Build dynamic prompt based on segment position and character analysis
    let promptParts: string[] = [];
    
    // Add character context if available
    if (characterAnalysis && typeof characterAnalysis === 'object') {
      const ca = characterAnalysis as Record<string, unknown>;
      if (ca.characterDescription) {
        promptParts.push(`Character: ${ca.characterDescription}`);
      }
      if (ca.visualStyle) {
        promptParts.push(`Visual style: ${ca.visualStyle}`);
      }
      if (ca.mood && Array.isArray(ca.mood)) {
        promptParts.push(`Mood: ${ca.mood.join(', ')}`);
      }
      if (ca.colorPalette && Array.isArray(ca.colorPalette)) {
        promptParts.push(`Color palette: ${ca.colorPalette.slice(0, 3).join(', ')}`);
      }
      if (ca.suggestedCameraWork) {
        promptParts.push(`Camera: ${ca.suggestedCameraWork}`);
      }
      if (ca.settingSuggestions && Array.isArray(ca.settingSuggestions)) {
        // Pick setting based on segment position
        const settingIdx = Math.floor(position * ca.settingSuggestions.length);
        promptParts.push(`Setting: ${ca.settingSuggestions[settingIdx]}`);
      }
    } else if (characterAnalysis && typeof characterAnalysis === 'string') {
      promptParts.push(characterAnalysis);
    }
    
    // Add narrative position
    let narrativeDescription = '';
    if (position < 0.2) {
      narrativeDescription = 'Opening scene, establishing the mood, calm beginning';
    } else if (position < 0.4) {
      narrativeDescription = 'Building intensity, rising action, energy increasing';
    } else if (position < 0.6) {
      narrativeDescription = 'Peak energy, climactic moment, powerful performance';
    } else if (position < 0.8) {
      narrativeDescription = 'Sustained intensity, emotional peak, dramatic visuals';
    } else {
      narrativeDescription = 'Resolution, cooling down, reflective ending';
    }
    promptParts.push(`Narrative: ${narrativeDescription}`);
    
    // Add lyrics context if available
    if (lyrics) {
      promptParts.push('Emotional performance matching the music');
    }
    
    // Add quality directives
    promptParts.push('Cinematic music video scene, professional lighting, 4K quality, smooth motion');
    
    const prompt = promptParts.join('. ') + '.';
    
    await updateSegment(adminClient, segment.id, { prompt, prompt_version: 'v1' });
    console.log(`[Segment ${segment.id}] Prompt generated for ${timeLabel}`);
  }
  
  await updateJobStatus(adminClient, jobId, 'prompts_generated');
  
  return { ok: true, segmentsUpdated: segments.length };
}

// ACTION: Start video generation for all segments
async function handleStartGeneration(adminClient: any, userId: string, body: any) {
  const { jobId, referenceImage, referenceImageBase64, aspectRatio = '9:16' } = body;
  const imageToUse = referenceImageBase64 || referenceImage;
  
  if (!jobId) throw new Error('jobId is required');
  
  // Verify job ownership
  const { data: job, error: jobError } = await adminClient
    .from('music_video_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();
    
  if (jobError || !job) {
    throw new Error('Job not found or access denied');
  }
  
  console.log(`[Job ${jobId}] Starting video generation`);
  
  // Get service account for Veo
  const serviceAccountJson = Deno.env.get('VERTEX_SERVICE_ACCOUNT');
  if (!serviceAccountJson) {
    throw new Error('Video generation service unavailable');
  }
  
  const serviceAccount = JSON.parse(serviceAccountJson);
  const accessToken = await getAccessToken(serviceAccount);
  
  // Get all queued segments
  const { data: segments } = await adminClient
    .from('video_segments')
    .select('*')
    .eq('job_id', jobId)
    .eq('veo_status', 'queued')
    .order('segment_index');
    
  if (!segments?.length) {
    console.log(`[Job ${jobId}] No queued segments to process`);
    return { ok: true, segmentsStarted: 0 };
  }
  
  const projectId = serviceAccount.project_id;
  const location = 'us-central1';
  const modelId = 'veo-3.1-generate-001';
  const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;
  
  let segmentsStarted = 0;
  
  for (const segment of segments) {
    // Skip if already has a veo_job_id (prevent duplicates)
    if (segment.veo_job_id) {
      console.log(`[Segment ${segment.id}] Already has veo_job_id, skipping`);
      continue;
    }
    
    try {
      const requestBody: Record<string, unknown> = {
        instances: [{
          prompt: segment.prompt || 'Cinematic music video scene'
        }],
        parameters: {
          aspectRatio: aspectRatio,
          durationSeconds: Math.min(8, (segment.end_ms - segment.start_ms) / 1000),
          sampleCount: 1,
          personGeneration: 'allow_all',
          addWatermark: false,
          generateAudio: false
        }
      };
      
      // Add reference image if provided
      if (imageToUse) {
        const base64Match = imageToUse.match(/^data:image\/(\w+);base64,(.+)$/);
        if (base64Match) {
          (requestBody.instances as Record<string, unknown>[])[0].image = {
            bytesBase64Encoded: base64Match[2],
            mimeType: `image/${base64Match[1]}`
          };
        }
      }
      
      console.log(`[Segment ${segment.id}] Submitting to Veo`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Segment ${segment.id}] Veo submission failed:`, errorText);
        await updateSegment(adminClient, segment.id, { veo_status: 'failed', error: 'Submission failed' });
        continue;
      }
      
      const data = await response.json();
      const operationName = data.name;
      
      console.log(`[Segment ${segment.id}] Veo job started: ${operationName}`);
      
      await updateSegment(adminClient, segment.id, {
        veo_job_id: operationName,
        veo_status: 'processing'
      });
      
      segmentsStarted++;
      
    } catch (err) {
      console.error(`[Segment ${segment.id}] Error starting generation:`, err);
      await updateSegment(adminClient, segment.id, { 
        veo_status: 'failed', 
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }
  
  await updateJobStatus(adminClient, jobId, 'generating_videos');
  
  return { ok: true, segmentsStarted };
}

// ACTION: Get job status with all segments
async function handleStatus(adminClient: any, userId: string, body: any) {
  const { jobId } = body;
  
  if (!jobId) throw new Error('jobId is required');
  
  const { data: job, error: jobError } = await adminClient
    .from('music_video_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();
    
  if (jobError || !job) {
    throw new Error('Job not found or access denied');
  }
  
  const { data: segments } = await adminClient
    .from('video_segments')
    .select('*')
    .eq('job_id', jobId)
    .order('segment_index');
    
  return { job, segments: segments || [] };
}

// ACTION: Poll a specific segment for status updates
async function handlePollSegment(adminClient: any, userId: string, body: any) {
  const { segmentId } = body;
  
  if (!segmentId) throw new Error('segmentId is required');
  
  // Get segment with job info
  const { data: segment, error: segError } = await adminClient
    .from('video_segments')
    .select('*, music_video_jobs!inner(*)')
    .eq('id', segmentId)
    .single();
    
  if (segError || !segment) {
    throw new Error('Segment not found');
  }
  
  const job = segment.music_video_jobs;
  
  // Verify ownership
  if (job.user_id !== userId) {
    throw new Error('Access denied');
  }
  
  // Poll Veo status if processing
  if (segment.veo_status === 'processing' && segment.veo_job_id) {
    const serviceAccountJson = Deno.env.get('VERTEX_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      throw new Error('Service unavailable');
    }
    
    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);
    
    // Parse operation name
    const operationParts = segment.veo_job_id.match(
      /projects\/([^\/]+)\/locations\/([^\/]+)\/publishers\/google\/models\/([^\/]+)\/operations\/([^\/]+)/
    );
    
    if (!operationParts) {
      console.error(`[Segment ${segmentId}] Invalid operation name format`);
      await updateSegment(adminClient, segmentId, { veo_status: 'failed', error: 'Invalid operation' });
      return { segment, updated: true };
    }
    
    const [, projectId, location, modelId] = operationParts;
    const statusUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;
    
    console.log(`[Segment ${segmentId}] Polling Veo status`);
    
    const response = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operationName: segment.veo_job_id })
    });
    
    if (!response.ok) {
      console.error(`[Segment ${segmentId}] Veo status check failed`);
      return { segment, updated: false };
    }
    
    const data = await response.json();
    
    if (data.done === true) {
      if (data.error) {
        console.log(`[Segment ${segmentId}] Veo generation failed`);
        await updateSegment(adminClient, segmentId, { 
          veo_status: 'failed', 
          error: data.error.message || 'Generation failed'
        });
      } else {
        // Extract video URL
        let videoUrl = null;
        const result = data.response;
        
        if (result?.videos?.[0]?.bytesBase64Encoded) {
          videoUrl = `data:video/mp4;base64,${result.videos[0].bytesBase64Encoded}`;
        } else if (result?.generatedVideos?.[0]?.video?.uri) {
          videoUrl = result.generatedVideos[0].video.uri;
        }
        
        if (videoUrl) {
          console.log(`[Segment ${segmentId}] Veo generation completed`);
          await updateSegment(adminClient, segmentId, {
            veo_status: 'completed',
            veo_video_url: videoUrl
          });
          
          // Start lipsync if enabled and character image provided
          if (job.use_lipsync && job.character_image_url && !segment.sync_job_id) {
            await startLipsyncForSegment(adminClient, segment, job);
          } else {
            // No lipsync - veo video is final
            await updateSegment(adminClient, segmentId, {
              sync_status: 'skipped',
              final_video_url: videoUrl
            });
            await incrementCompletedSegments(adminClient, job.id);
          }
        } else {
          await updateSegment(adminClient, segmentId, { 
            veo_status: 'failed', 
            error: 'No video in response'
          });
        }
      }
      return { segment: { ...segment, veo_status: 'completed' }, updated: true };
    }
    
    return { segment, updated: false };
  }
  
  // Poll Sync.so status if processing
  if (segment.sync_status === 'processing' && segment.sync_job_id) {
    const SYNC_API_KEY = Deno.env.get('SYNC_API_KEY');
    if (!SYNC_API_KEY) {
      throw new Error('Sync service unavailable');
    }
    
    console.log(`[Segment ${segmentId}] Polling Sync.so status`);
    
    const response = await fetch(`https://api.sync.so/v2/generate/${segment.sync_job_id}`, {
      method: 'GET',
      headers: { 'x-api-key': SYNC_API_KEY }
    });
    
    if (!response.ok) {
      console.error(`[Segment ${segmentId}] Sync.so status check failed`);
      return { segment, updated: false };
    }
    
    const data = await response.json();
    
    if (data.status === 'COMPLETED' && data.outputUrl) {
      console.log(`[Segment ${segmentId}] Lipsync completed`);
      await updateSegment(adminClient, segmentId, {
        sync_status: 'completed',
        synced_video_url: data.outputUrl,
        final_video_url: data.outputUrl
      });
      await incrementCompletedSegments(adminClient, job.id);
      return { segment: { ...segment, sync_status: 'completed' }, updated: true };
    } else if (data.status === 'FAILED' || data.status === 'REJECTED') {
      console.log(`[Segment ${segmentId}] Lipsync failed, falling back to Veo video`);
      await updateSegment(adminClient, segmentId, {
        sync_status: 'failed',
        final_video_url: segment.veo_video_url,
        error: 'Lipsync failed, using original video'
      });
      await incrementCompletedSegments(adminClient, job.id);
      return { segment: { ...segment, sync_status: 'failed' }, updated: true };
    }
    
    return { segment, updated: false };
  }
  
  return { segment, updated: false };
}

// Start lipsync for a segment
async function startLipsyncForSegment(adminClient: any, segment: any, job: any) {
  const SYNC_API_KEY = Deno.env.get('SYNC_API_KEY');
  if (!SYNC_API_KEY) {
    console.error(`[Segment ${segment.id}] SYNC_API_KEY not configured`);
    await updateSegment(adminClient, segment.id, {
      sync_status: 'skipped',
      final_video_url: segment.veo_video_url
    });
    await incrementCompletedSegments(adminClient, job.id);
    return;
  }
  
  // Need audio segment URL - for now use the segment's audio_segment_url or the job's audio_url
  const audioUrl = segment.audio_segment_url || job.audio_url;
  
  console.log(`[Segment ${segment.id}] Starting lipsync`);
  
  try {
    const response = await fetch('https://api.sync.so/v2/generate', {
      method: 'POST',
      headers: {
        'x-api-key': SYNC_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'lipsync-1.9.0-beta',
        input: [
          { type: 'video', url: segment.veo_video_url },
          { type: 'audio', url: audioUrl }
        ]
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Segment ${segment.id}] Sync.so submission failed:`, errorText);
      await updateSegment(adminClient, segment.id, {
        sync_status: 'failed',
        final_video_url: segment.veo_video_url,
        error: 'Lipsync submission failed'
      });
      await incrementCompletedSegments(adminClient, job.id);
      return;
    }
    
    const data = await response.json();
    console.log(`[Segment ${segment.id}] Lipsync job started: ${data.id}`);
    
    await updateSegment(adminClient, segment.id, {
      sync_job_id: data.id,
      sync_status: 'processing'
    });
    
  } catch (err) {
    console.error(`[Segment ${segment.id}] Error starting lipsync:`, err);
    await updateSegment(adminClient, segment.id, {
      sync_status: 'failed',
      final_video_url: segment.veo_video_url,
      error: err instanceof Error ? err.message : 'Unknown error'
    });
    await incrementCompletedSegments(adminClient, job.id);
  }
}

// ACTION: Stitch all segments into final video
async function handleStitch(adminClient: any, userId: string, body: any) {
  const { jobId } = body;
  
  if (!jobId) throw new Error('jobId is required');
  
  const { data: job, error: jobError } = await adminClient
    .from('music_video_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();
    
  if (jobError || !job) {
    throw new Error('Job not found or access denied');
  }
  
  const { data: segments } = await adminClient
    .from('video_segments')
    .select('*')
    .eq('job_id', jobId)
    .order('segment_index');
    
  // Verify all segments have final videos
  const incompleteSegments = segments?.filter((s: any) => !s.final_video_url) || [];
  if (incompleteSegments.length > 0) {
    throw new Error(`${incompleteSegments.length} segments not ready for stitching`);
  }
  
  console.log(`[Job ${jobId}] Starting stitch of ${segments?.length} segments`);
  await updateJobStatus(adminClient, jobId, 'stitching');
  
  // For now, return the final video URLs for client-side stitching
  // A future enhancement would be server-side FFmpeg stitching
  const videoUrls = segments?.map((s: any) => ({
    index: s.segment_index,
    url: s.final_video_url,
    startMs: s.start_ms,
    endMs: s.end_ms
  })) || [];
  
  // Mark as completed (client will handle actual stitching)
  await updateJobStatus(adminClient, jobId, 'completed');
  
  return { 
    ok: true, 
    videoUrls,
    audioUrl: job.audio_url
  };
}

// ACTION: Cancel a job
async function handleCancel(adminClient: any, userId: string, body: any) {
  const { jobId } = body;
  
  if (!jobId) throw new Error('jobId is required');
  
  const { data: job, error: jobError } = await adminClient
    .from('music_video_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();
    
  if (jobError || !job) {
    throw new Error('Job not found or access denied');
  }
  
  console.log(`[Job ${jobId}] Cancelling`);
  await updateJobStatus(adminClient, jobId, 'cancelled');
  
  return { ok: true };
}

// ACTION: Retry a failed segment
async function handleRetrySegment(adminClient: any, userId: string, body: any) {
  const { segmentId } = body;
  
  if (!segmentId) throw new Error('segmentId is required');
  
  const { data: segment, error: segError } = await adminClient
    .from('video_segments')
    .select('*, music_video_jobs!inner(*)')
    .eq('id', segmentId)
    .single();
    
  if (segError || !segment) {
    throw new Error('Segment not found');
  }
  
  const job = segment.music_video_jobs;
  
  if (job.user_id !== userId) {
    throw new Error('Access denied');
  }
  
  console.log(`[Segment ${segmentId}] Retrying`);
  
  // Determine what to retry based on current state
  if (segment.veo_status === 'failed') {
    // Reset for Veo retry
    await updateSegment(adminClient, segmentId, {
      veo_job_id: null,
      veo_status: 'queued',
      veo_video_url: null,
      sync_job_id: null,
      sync_status: 'not_started',
      synced_video_url: null,
      final_video_url: null,
      error: null
    });
  } else if (segment.sync_status === 'failed' && segment.veo_video_url) {
    // Reset for lipsync retry only
    await updateSegment(adminClient, segmentId, {
      sync_job_id: null,
      sync_status: 'not_started',
      synced_video_url: null,
      final_video_url: null,
      error: null
    });
    
    // Start lipsync immediately
    if (job.use_lipsync && job.character_image_url) {
      await startLipsyncForSegment(adminClient, { ...segment, sync_job_id: null }, job);
    }
  }
  
  // Ensure job is in generating state
  if (job.status === 'failed' || job.status === 'cancelled') {
    await updateJobStatus(adminClient, job.id, 'generating_videos');
  }
  
  return { ok: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userInfo = await getUserFromToken(req);
    if (!userInfo) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please log in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const body = req.method === 'GET' ? {} : await req.json();
    
    // Support action from query params OR body
    const action = url.searchParams.get('action') || body.action;
    
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = getAdminClient();

    console.log(`[Orchestrator] Action: ${action}, User: ${userInfo.userId}`);

    let result;
    
    switch (action) {
      case 'create':
        result = await handleCreate(adminClient, userInfo.userId, body);
        break;
      case 'generate-prompts':
        result = await handleGeneratePrompts(adminClient, userInfo.userId, body);
        break;
      case 'start-generation':
        result = await handleStartGeneration(adminClient, userInfo.userId, body);
        break;
      case 'status':
        result = await handleStatus(adminClient, userInfo.userId, body);
        break;
      case 'poll-segment':
        result = await handlePollSegment(adminClient, userInfo.userId, body);
        break;
      case 'stitch':
        result = await handleStitch(adminClient, userInfo.userId, body);
        break;
      case 'cancel':
        result = await handleCancel(adminClient, userInfo.userId, body);
        break;
      case 'retry-segment':
        result = await handleRetrySegment(adminClient, userInfo.userId, body);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in music-video-orchestrator:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Operation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
