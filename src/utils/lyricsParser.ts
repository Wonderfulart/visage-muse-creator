/**
 * Lyrics Parser Utility
 * Splits lyrics into sections based on scene count
 */

export interface LyricSection {
  index: number;
  text: string;
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'section';
}

// Common section markers in lyrics
const SECTION_MARKERS = /\[(verse|chorus|bridge|intro|outro|hook|pre-chorus|interlude)\s*\d*\]/gi;

/**
 * Parse lyrics into sections matching the target scene count
 */
export function parseLyrics(lyrics: string, sceneCount: number): LyricSection[] {
  if (!lyrics.trim() || sceneCount <= 0) {
    return [];
  }

  // Clean up the lyrics
  const cleanedLyrics = lyrics.trim();
  
  // Try to split by section markers first (e.g., [Verse 1], [Chorus])
  const markerSplit = cleanedLyrics.split(SECTION_MARKERS).filter(s => s.trim());
  
  let sections: string[];
  
  if (markerSplit.length >= sceneCount) {
    // Use section markers if we have enough
    sections = markerSplit;
  } else {
    // Fall back to splitting by double newlines (paragraphs/stanzas)
    const paragraphSplit = cleanedLyrics.split(/\n\s*\n/).filter(s => s.trim());
    
    if (paragraphSplit.length >= sceneCount) {
      sections = paragraphSplit;
    } else {
      // Last resort: split by lines and group evenly
      const lines = cleanedLyrics.split('\n').filter(l => l.trim());
      const linesPerSection = Math.ceil(lines.length / sceneCount);
      sections = [];
      
      for (let i = 0; i < sceneCount; i++) {
        const start = i * linesPerSection;
        const end = Math.min(start + linesPerSection, lines.length);
        const sectionLines = lines.slice(start, end);
        if (sectionLines.length > 0) {
          sections.push(sectionLines.join('\n'));
        }
      }
    }
  }

  // Distribute sections evenly to match scene count
  const result: LyricSection[] = [];
  
  if (sections.length === sceneCount) {
    // Perfect match
    sections.forEach((text, index) => {
      result.push({
        index,
        text: text.trim(),
        type: detectSectionType(text)
      });
    });
  } else if (sections.length > sceneCount) {
    // Too many sections - combine some
    const sectionsPerScene = Math.ceil(sections.length / sceneCount);
    for (let i = 0; i < sceneCount; i++) {
      const start = i * sectionsPerScene;
      const end = Math.min(start + sectionsPerScene, sections.length);
      const combined = sections.slice(start, end).join('\n\n').trim();
      if (combined) {
        result.push({
          index: i,
          text: combined,
          type: detectSectionType(combined)
        });
      }
    }
  } else {
    // Too few sections - some scenes share lyrics
    for (let i = 0; i < sceneCount; i++) {
      const sectionIndex = Math.floor((i / sceneCount) * sections.length);
      const text = sections[sectionIndex] || sections[sections.length - 1] || '';
      result.push({
        index: i,
        text: text.trim(),
        type: detectSectionType(text)
      });
    }
  }

  // Ensure we have exactly sceneCount sections
  while (result.length < sceneCount) {
    result.push({
      index: result.length,
      text: result[result.length - 1]?.text || 'Instrumental break',
      type: 'section'
    });
  }

  return result.slice(0, sceneCount);
}

/**
 * Detect the type of a lyric section
 */
function detectSectionType(text: string): LyricSection['type'] {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('[chorus]') || lowerText.includes('chorus')) {
    return 'chorus';
  }
  if (lowerText.includes('[verse]') || lowerText.includes('verse')) {
    return 'verse';
  }
  if (lowerText.includes('[bridge]') || lowerText.includes('bridge')) {
    return 'bridge';
  }
  if (lowerText.includes('[intro]') || lowerText.includes('intro')) {
    return 'intro';
  }
  if (lowerText.includes('[outro]') || lowerText.includes('outro')) {
    return 'outro';
  }
  
  return 'section';
}

/**
 * Extract key themes/imagery from lyrics for visual prompts
 */
export function extractLyricThemes(lyricText: string): string[] {
  // Remove common filler words and focus on imagery
  const themes: string[] = [];
  const lowerText = lyricText.toLowerCase();
  
  // Nature imagery
  if (/\b(sun|moon|stars?|sky|ocean|sea|waves?|rain|storm|fire|wind)\b/.test(lowerText)) {
    themes.push('nature elements');
  }
  
  // Motion words
  if (/\b(run|fly|fall|rise|dance|move|float|soar)\b/.test(lowerText)) {
    themes.push('dynamic movement');
  }
  
  // Light/color words
  if (/\b(light|bright|glow|shine|dark|color|gold|silver|blue|red)\b/.test(lowerText)) {
    themes.push('lighting contrast');
  }
  
  // Emotional energy
  if (/\b(fast|quick|wild|free|strong|power|energy)\b/.test(lowerText)) {
    themes.push('high energy');
  } else if (/\b(slow|gentle|soft|calm|quiet|peace)\b/.test(lowerText)) {
    themes.push('calm atmosphere');
  }
  
  return themes;
}
