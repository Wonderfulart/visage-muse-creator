import JSZip from 'jszip';

export interface ClipForZip {
  url: string;
  filename: string;
}

/**
 * Downloads multiple video clips as a ZIP file
 */
export async function downloadClipsAsZip(
  clips: ClipForZip[],
  zipFilename: string = 'music-video-clips.zip',
  onProgress?: (progress: number) => void
): Promise<void> {
  const zip = new JSZip();
  
  // Fetch each clip and add to ZIP
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    
    try {
      const response = await fetch(clip.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${clip.filename}`);
      }
      
      const blob = await response.blob();
      zip.file(clip.filename, blob);
      
      if (onProgress) {
        onProgress(((i + 1) / clips.length) * 100);
      }
    } catch (error) {
      console.error(`Error fetching clip ${clip.filename}:`, error);
      // Continue with other clips even if one fails
    }
  }
  
  // Generate and download the ZIP
  const zipBlob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  }, (metadata) => {
    if (onProgress) {
      onProgress(metadata.percent);
    }
  });
  
  // Trigger download
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
