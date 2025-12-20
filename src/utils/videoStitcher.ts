/**
 * Video Stitcher Utility
 * Combines multiple video blobs into a single video using MediaRecorder + Canvas
 */

export interface StitchProgress {
  stage: 'loading' | 'stitching' | 'encoding' | 'complete';
  progress: number;
  currentClip?: number;
  totalClips?: number;
}

export interface StitchResult {
  blob: Blob;
  url: string;
  duration: number;
}

/**
 * Load a video from URL and return its metadata
 */
async function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error(`Failed to load video: ${url}`));
    
    video.src = url;
    video.load();
  });
}

/**
 * Draw video frames to canvas for a specific duration
 */
async function drawVideoToCanvas(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  duration: number,
  onFrame?: () => void
): Promise<void> {
  return new Promise((resolve) => {
    video.currentTime = 0;
    video.play();
    
    const startTime = performance.now();
    const targetDuration = duration * 1000; // Convert to ms
    
    const drawFrame = () => {
      const elapsed = performance.now() - startTime;
      
      if (elapsed < targetDuration && !video.paused && !video.ended) {
        // Scale video to fill canvas while maintaining aspect ratio
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (videoAspect > canvasAspect) {
          drawHeight = canvas.height;
          drawWidth = drawHeight * videoAspect;
          drawX = (canvas.width - drawWidth) / 2;
          drawY = 0;
        } else {
          drawWidth = canvas.width;
          drawHeight = drawWidth / videoAspect;
          drawX = 0;
          drawY = (canvas.height - drawHeight) / 2;
        }
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
        
        onFrame?.();
        requestAnimationFrame(drawFrame);
      } else {
        video.pause();
        resolve();
      }
    };
    
    requestAnimationFrame(drawFrame);
  });
}

/**
 * Stitch multiple video URLs into a single video blob
 */
export async function stitchVideos(
  videoUrls: string[],
  onProgress?: (progress: StitchProgress) => void
): Promise<StitchResult> {
  if (videoUrls.length === 0) {
    throw new Error('No videos to stitch');
  }

  onProgress?.({ stage: 'loading', progress: 0, currentClip: 0, totalClips: videoUrls.length });

  // Load all videos to get metadata
  const videos: HTMLVideoElement[] = [];
  let totalDuration = 0;
  
  for (let i = 0; i < videoUrls.length; i++) {
    onProgress?.({ 
      stage: 'loading', 
      progress: (i / videoUrls.length) * 30, 
      currentClip: i + 1, 
      totalClips: videoUrls.length 
    });
    
    const video = await loadVideo(videoUrls[i]);
    videos.push(video);
    totalDuration += video.duration;
  }

  // Use dimensions from first video
  const firstVideo = videos[0];
  const width = firstVideo.videoWidth || 1280;
  const height = firstVideo.videoHeight || 720;

  // Create canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Create media stream from canvas
  const stream = canvas.captureStream(30); // 30 FPS
  
  // Set up MediaRecorder
  const chunks: Blob[] = [];
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 5000000 // 5 Mbps
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };
    mediaRecorder.onerror = (e) => reject(e);
  });

  // Start recording
  mediaRecorder.start(100); // Capture every 100ms

  onProgress?.({ stage: 'stitching', progress: 30, currentClip: 1, totalClips: videoUrls.length });

  // Draw each video sequentially
  let elapsedDuration = 0;
  
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const clipDuration = video.duration;
    
    onProgress?.({ 
      stage: 'stitching', 
      progress: 30 + ((i / videos.length) * 60), 
      currentClip: i + 1, 
      totalClips: videos.length 
    });

    await drawVideoToCanvas(video, ctx, canvas, clipDuration);
    elapsedDuration += clipDuration;
    
    // Clean up video element
    video.src = '';
    video.load();
  }

  // Stop recording
  onProgress?.({ stage: 'encoding', progress: 90 });
  mediaRecorder.stop();
  
  // Wait for final blob
  const finalBlob = await recordingPromise;
  const url = URL.createObjectURL(finalBlob);

  onProgress?.({ stage: 'complete', progress: 100 });

  return {
    blob: finalBlob,
    url,
    duration: totalDuration
  };
}

/**
 * Clean up stitched video URL to free memory
 */
export function revokeStitchedVideo(url: string): void {
  URL.revokeObjectURL(url);
}
