/**
 * Audio Splitter Utility
 * Splits audio files into segments of specified duration using Web Audio API
 */

export interface AudioSegment {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  audioBlob: Blob;
  waveformData: number[];
}

export interface SplitAudioResult {
  segments: AudioSegment[];
  totalDuration: number;
  originalFile: File;
}

/**
 * Extract waveform data from audio buffer for visualization
 */
export function extractWaveformData(
  audioBuffer: AudioBuffer,
  startTime: number,
  endTime: number,
  samples: number = 100
): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const segmentLength = endSample - startSample;
  const blockSize = Math.floor(segmentLength / samples);
  
  const waveform: number[] = [];
  
  for (let i = 0; i < samples; i++) {
    const blockStart = startSample + i * blockSize;
    let sum = 0;
    
    for (let j = 0; j < blockSize; j++) {
      const index = blockStart + j;
      if (index < channelData.length) {
        sum += Math.abs(channelData[index]);
      }
    }
    
    waveform.push(sum / blockSize);
  }
  
  // Normalize to 0-1 range
  const max = Math.max(...waveform, 0.01);
  return waveform.map(v => v / max);
}

/**
 * Extract audio segment as Blob
 */
async function extractAudioSegment(
  audioBuffer: AudioBuffer,
  startTime: number,
  endTime: number
): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const segmentLength = endSample - startSample;
  
  // Create a new buffer for the segment
  const segmentBuffer = audioContext.createBuffer(
    numberOfChannels,
    segmentLength,
    sampleRate
  );
  
  // Copy the segment data
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const segmentData = segmentBuffer.getChannelData(channel);
    
    for (let i = 0; i < segmentLength; i++) {
      const sourceIndex = startSample + i;
      if (sourceIndex < originalData.length) {
        segmentData[i] = originalData[sourceIndex];
      }
    }
  }
  
  // Convert to WAV blob
  const wavBlob = audioBufferToWav(segmentBuffer);
  audioContext.close();
  
  return wavBlob;
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Interleave audio data
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Split audio file into segments of specified duration
 */
export async function splitAudio(
  file: File,
  segmentDuration: number = 8,
  onProgress?: (progress: number) => void
): Promise<SplitAudioResult> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  
  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const totalDuration = audioBuffer.duration;
  
  // Calculate number of segments
  const numSegments = Math.ceil(totalDuration / segmentDuration);
  const segments: AudioSegment[] = [];
  
  for (let i = 0; i < numSegments; i++) {
    const startTime = i * segmentDuration;
    const endTime = Math.min((i + 1) * segmentDuration, totalDuration);
    const duration = endTime - startTime;
    
    // Extract waveform data
    const waveformData = extractWaveformData(audioBuffer, startTime, endTime);
    
    // Extract audio blob
    const audioBlob = await extractAudioSegment(audioBuffer, startTime, endTime);
    
    segments.push({
      id: `segment-${i + 1}`,
      index: i,
      startTime,
      endTime,
      duration,
      audioBlob,
      waveformData,
    });
    
    // Report progress
    if (onProgress) {
      onProgress(((i + 1) / numSegments) * 100);
    }
  }
  
  audioContext.close();
  
  return {
    segments,
    totalDuration,
    originalFile: file,
  };
}

/**
 * Get full waveform data for the entire audio file
 */
export async function getFullWaveform(
  file: File,
  samples: number = 500
): Promise<{ waveformData: number[]; duration: number }> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const waveformData = extractWaveformData(audioBuffer, 0, audioBuffer.duration, samples);
  
  audioContext.close();
  
  return {
    waveformData,
    duration: audioBuffer.duration,
  };
}

/**
 * Format time in seconds to MM:SS string
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
