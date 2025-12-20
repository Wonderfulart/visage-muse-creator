/**
 * Client-side audio-video merger using Canvas API and MediaRecorder
 * Merges video frames with audio segments into a single WebM blob
 */

export interface MergeProgress {
  sceneId: string;
  progress: number;
  status: 'pending' | 'merging' | 'completed' | 'failed';
  error?: string;
}

export interface MergeResult {
  sceneId: string;
  blob: Blob;
  url: string;
}

/**
 * Merge a video with an audio segment
 */
export async function mergeAudioWithVideo(
  videoUrl: string,
  audioFile: File,
  startTime: number,
  endTime: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      // Create video element
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoUrl;
      video.muted = true;
      
      // Wait for video to load
      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res();
        video.onerror = () => rej(new Error('Failed to load video'));
      });

      const videoDuration = video.duration;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      // Create canvas for video frames
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // Create audio context and load audio segment
      const audioContext = new AudioContext();
      const audioArrayBuffer = await audioFile.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);

      // Create offline context for the segment
      const segmentDuration = Math.min(endTime - startTime, videoDuration);
      const sampleRate = audioBuffer.sampleRate;
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        Math.ceil(segmentDuration * sampleRate),
        sampleRate
      );

      // Create buffer source for the segment
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0, startTime, segmentDuration);

      // Render audio segment
      const renderedBuffer = await offlineContext.startRendering();

      // Create audio stream from rendered buffer
      const audioStreamContext = new AudioContext();
      const audioSource = audioStreamContext.createBufferSource();
      audioSource.buffer = renderedBuffer;
      const destination = audioStreamContext.createMediaStreamDestination();
      audioSource.connect(destination);

      // Get video stream from canvas
      const canvasStream = canvas.captureStream(30);
      
      // Combine streams
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      // Setup MediaRecorder
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 5000000
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        audioStreamContext.close();
        resolve(blob);
      };

      mediaRecorder.onerror = (e) => {
        reject(new Error('MediaRecorder error'));
      };

      // Start recording
      mediaRecorder.start();
      audioSource.start();
      video.currentTime = 0;
      await video.play();

      // Draw frames and track progress
      let startTimestamp: number | null = null;
      const drawFrame = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = (timestamp - startTimestamp) / 1000;
        
        ctx.drawImage(video, 0, 0, width, height);
        
        const progress = Math.min((elapsed / segmentDuration) * 100, 100);
        onProgress?.(progress);

        if (elapsed < segmentDuration && !video.ended) {
          requestAnimationFrame(drawFrame);
        } else {
          video.pause();
          audioSource.stop();
          mediaRecorder.stop();
        }
      };

      requestAnimationFrame(drawFrame);

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Batch merge multiple scenes with their audio segments
 */
export async function batchMergeAudioWithVideos(
  scenes: Array<{
    id: string;
    videoUrl: string;
    startTime: number;
    endTime: number;
  }>,
  audioFile: File,
  onSceneProgress?: (sceneId: string, progress: number) => void
): Promise<MergeResult[]> {
  const results: MergeResult[] = [];

  for (const scene of scenes) {
    try {
      const blob = await mergeAudioWithVideo(
        scene.videoUrl,
        audioFile,
        scene.startTime,
        scene.endTime,
        (progress) => onSceneProgress?.(scene.id, progress)
      );

      const url = URL.createObjectURL(blob);
      results.push({ sceneId: scene.id, blob, url });
    } catch (error) {
      console.error(`Failed to merge scene ${scene.id}:`, error);
    }
  }

  return results;
}

/**
 * Download a merged video
 */
export function downloadMergedVideo(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
