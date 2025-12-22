/**
 * Audio Analyzer Utility
 * Analyzes audio for energy, tempo, and beat density per segment
 */

export interface AudioAnalysis {
  segmentIndex: number;
  energy: number; // 0-1 normalized RMS energy
  tempo: number; // Estimated BPM
  beatDensity: number; // Beats per second estimate
  dynamics: 'quiet' | 'building' | 'peak' | 'fading';
}

export interface FullAudioAnalysis {
  segments: AudioAnalysis[];
  averageEnergy: number;
  averageTempo: number;
  energyProgression: 'building' | 'steady' | 'dynamic' | 'fading';
}

/**
 * Get narrative position based on scene index
 */
export function getNarrativePosition(
  index: number, 
  total: number
): 'opening' | 'rising' | 'climax' | 'resolution' {
  const position = total === 1 ? 0.5 : index / (total - 1);
  
  if (position <= 0.15) return 'opening';
  if (position <= 0.5) return 'rising';
  if (position <= 0.8) return 'climax';
  return 'resolution';
}

/**
 * Analyze an audio file and return per-segment analysis
 */
export async function analyzeAudio(
  audioFile: File,
  segmentCount: number,
  onProgress?: (progress: number) => void
): Promise<FullAudioAnalysis> {
  // Create a timeout promise
  const TIMEOUT_MS = 30000; // 30 second timeout
  
  const analysisPromise = new Promise<FullAudioAnalysis>((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        onProgress?.(10);
        console.log('[AudioAnalyzer] Starting audio decode...');
        
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        console.log('[AudioAnalyzer] Audio decoded, analyzing segments...');
        onProgress?.(30);
        
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        const segmentDuration = duration / segmentCount;
        const samplesPerSegment = Math.floor(sampleRate * segmentDuration);
        
        const segments: AudioAnalysis[] = [];
        let totalEnergy = 0;
        let totalTempo = 0;
        
        for (let i = 0; i < segmentCount; i++) {
          const startSample = i * samplesPerSegment;
          const endSample = Math.min(startSample + samplesPerSegment, channelData.length);
          const segmentData = channelData.slice(startSample, endSample);
          
          // Calculate RMS energy
          const energy = calculateRMS(segmentData);
          
          // Estimate tempo using zero crossings and peak detection
          const tempo = estimateTempo(segmentData, sampleRate);
          
          // Calculate beat density
          const beatDensity = tempo / 60; // Beats per second
          
          // Determine dynamics based on energy and position
          const dynamics = determineDynamics(energy, i, segmentCount);
          
          segments.push({
            segmentIndex: i,
            energy: Math.min(1, energy * 3), // Normalize to 0-1 range
            tempo: Math.round(tempo),
            beatDensity: Math.round(beatDensity * 10) / 10,
            dynamics
          });
          
          totalEnergy += energy;
          totalTempo += tempo;
          
          onProgress?.(30 + ((i + 1) / segmentCount) * 60);
        }
        
        // Determine overall energy progression
        const firstHalfEnergy = segments.slice(0, Math.floor(segmentCount / 2))
          .reduce((sum, s) => sum + s.energy, 0) / Math.floor(segmentCount / 2);
        const secondHalfEnergy = segments.slice(Math.floor(segmentCount / 2))
          .reduce((sum, s) => sum + s.energy, 0) / Math.ceil(segmentCount / 2);
        
        let energyProgression: FullAudioAnalysis['energyProgression'];
        const energyDiff = secondHalfEnergy - firstHalfEnergy;
        
        if (energyDiff > 0.15) {
          energyProgression = 'building';
        } else if (energyDiff < -0.15) {
          energyProgression = 'fading';
        } else {
          // Check for variance
          const variance = segments.reduce((sum, s) => 
            sum + Math.pow(s.energy - (totalEnergy / segmentCount), 2), 0) / segmentCount;
          energyProgression = variance > 0.05 ? 'dynamic' : 'steady';
        }
        
        onProgress?.(100);
        console.log('[AudioAnalyzer] Analysis complete');
        
        await audioContext.close();
        
        resolve({
          segments,
          averageEnergy: totalEnergy / segmentCount,
          averageTempo: Math.round(totalTempo / segmentCount),
          energyProgression
        });
        
      } catch (error) {
        console.error('[AudioAnalyzer] Error during analysis:', error);
        audioContext.close();
        reject(error);
      }
    };

    reader.onerror = () => {
      console.error('[AudioAnalyzer] Failed to read audio file');
      reject(new Error('Failed to read audio file'));
    };
    
    reader.readAsArrayBuffer(audioFile);
  });

  // Race against timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Audio analysis timed out after ${TIMEOUT_MS / 1000} seconds`));
    }, TIMEOUT_MS);
  });

  return Promise.race([analysisPromise, timeoutPromise]);
}

/**
 * Calculate RMS (Root Mean Square) energy of audio samples
 */
function calculateRMS(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Estimate tempo using zero-crossing rate and peak detection
 */
function estimateTempo(samples: Float32Array, sampleRate: number): number {
  // Use autocorrelation for tempo estimation
  const minBPM = 60;
  const maxBPM = 180;
  const minLag = Math.floor(sampleRate * 60 / maxBPM);
  const maxLag = Math.floor(sampleRate * 60 / minBPM);
  
  // Downsample for faster processing
  const downsampleFactor = 4;
  const downsampled = new Float32Array(Math.floor(samples.length / downsampleFactor));
  for (let i = 0; i < downsampled.length; i++) {
    downsampled[i] = samples[i * downsampleFactor];
  }
  
  const adjustedMinLag = Math.floor(minLag / downsampleFactor);
  const adjustedMaxLag = Math.min(Math.floor(maxLag / downsampleFactor), downsampled.length - 1);
  
  let bestCorrelation = -Infinity;
  let bestLag = adjustedMinLag;
  
  // Calculate autocorrelation at different lags
  for (let lag = adjustedMinLag; lag <= adjustedMaxLag; lag += 2) {
    let correlation = 0;
    const length = downsampled.length - lag;
    
    for (let i = 0; i < length; i++) {
      correlation += downsampled[i] * downsampled[i + lag];
    }
    
    correlation /= length;
    
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }
  
  // Convert lag to BPM
  const lagInSeconds = (bestLag * downsampleFactor) / sampleRate;
  const bpm = 60 / lagInSeconds;
  
  // Clamp to reasonable range
  return Math.max(minBPM, Math.min(maxBPM, bpm));
}

/**
 * Determine dynamics category based on energy and position
 */
function determineDynamics(
  energy: number, 
  index: number, 
  total: number
): AudioAnalysis['dynamics'] {
  const position = index / (total - 1);
  const normalizedEnergy = Math.min(1, energy * 3);
  
  if (normalizedEnergy < 0.3) {
    return 'quiet';
  } else if (normalizedEnergy > 0.7) {
    return 'peak';
  } else if (position < 0.5 && normalizedEnergy > 0.4) {
    return 'building';
  } else if (position > 0.7 && normalizedEnergy < 0.5) {
    return 'fading';
  } else if (normalizedEnergy > 0.5) {
    return 'building';
  }
  
  return 'quiet';
}

/**
 * Get tempo description for prompts
 */
export function getTempoDescription(tempo: number): string {
  if (tempo >= 140) return 'very fast, high-energy';
  if (tempo >= 120) return 'upbeat, driving';
  if (tempo >= 100) return 'moderate, steady';
  if (tempo >= 80) return 'relaxed, flowing';
  return 'slow, contemplative';
}

/**
 * Get energy description for prompts
 */
export function getEnergyDescription(energy: number): string {
  if (energy >= 0.8) return 'explosive, maximum intensity';
  if (energy >= 0.6) return 'high energy, dynamic';
  if (energy >= 0.4) return 'moderate energy, balanced';
  if (energy >= 0.2) return 'calm, subdued';
  return 'quiet, minimal';
}
