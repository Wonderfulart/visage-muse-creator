/**
 * Lyrics Parser Utility
 * Splits lyrics into sections based on scene count with narrative analysis
 */

export interface LyricSection {
  index: number;
  text: string;
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'section';
  storyElements: string[];
  emotionalArc: string;
}

export interface SongNarrativeAnalysis {
  overallTheme: string;
  narrativeType: 'love_story' | 'journey' | 'celebration' | 'introspection' | 'empowerment' | 'abstract';
  keyImagery: string[];
  emotionalJourney: string;
  hasProgression: boolean;
}

// Common section markers in lyrics
const SECTION_MARKERS = /\[(verse|chorus|bridge|intro|outro|hook|pre-chorus|interlude)\s*\d*\]/gi;

// Story element detection patterns
const STORY_PATTERNS = {
  nature: /\b(sun|moon|stars?|sky|ocean|sea|waves?|rain|storm|fire|wind|mountain|river|forest|flower|tree)\b/gi,
  motion: /\b(run|fly|fall|rise|dance|move|float|soar|walk|drive|chase|escape|travel|journey)\b/gi,
  light: /\b(light|bright|glow|shine|dark|shadow|color|gold|silver|neon|flash|spark)\b/gi,
  emotion: /\b(free|strong|power|energy|wild|alive|dream|hope|fear|brave|lost|found)\b/gi,
  time: /\b(night|day|morning|evening|forever|moment|now|always|never|yesterday|tomorrow)\b/gi,
  place: /\b(city|street|road|home|world|place|space|heaven|earth|room|door|window)\b/gi,
};

// Narrative type keywords
const NARRATIVE_KEYWORDS = {
  love_story: /\b(love|heart|together|you|us|we|miss|want|need)\b/gi,
  journey: /\b(go|find|search|way|path|road|looking|seeking|destination)\b/gi,
  celebration: /\b(party|dance|fun|tonight|celebrate|live|yeah|hey)\b/gi,
  introspection: /\b(i|me|my|myself|inside|soul|mind|think|feel|wonder)\b/gi,
  empowerment: /\b(strong|rise|power|stand|fight|win|overcome|can|will)\b/gi,
};

/**
 * Parse lyrics into sections matching the target scene count
 */
export function parseLyrics(lyrics: string, sceneCount: number): LyricSection[] {
  if (!lyrics.trim() || sceneCount <= 0) {
    return [];
  }

  const cleanedLyrics = lyrics.trim();
  
  // Try to split by section markers first
  const markerSplit = cleanedLyrics.split(SECTION_MARKERS).filter(s => s.trim());
  
  let sections: string[];
  
  if (markerSplit.length >= sceneCount) {
    sections = markerSplit;
  } else {
    // Fall back to splitting by double newlines
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

  // Distribute sections to match scene count
  const result: LyricSection[] = [];
  
  if (sections.length === sceneCount) {
    sections.forEach((text, index) => {
      result.push(createLyricSection(text, index, sceneCount));
    });
  } else if (sections.length > sceneCount) {
    const sectionsPerScene = Math.ceil(sections.length / sceneCount);
    for (let i = 0; i < sceneCount; i++) {
      const start = i * sectionsPerScene;
      const end = Math.min(start + sectionsPerScene, sections.length);
      const combined = sections.slice(start, end).join('\n\n').trim();
      if (combined) {
        result.push(createLyricSection(combined, i, sceneCount));
      }
    }
  } else {
    for (let i = 0; i < sceneCount; i++) {
      const sectionIndex = Math.floor((i / sceneCount) * sections.length);
      const text = sections[sectionIndex] || sections[sections.length - 1] || '';
      result.push(createLyricSection(text, i, sceneCount));
    }
  }

  // Ensure we have exactly sceneCount sections
  while (result.length < sceneCount) {
    result.push({
      index: result.length,
      text: result[result.length - 1]?.text || 'Instrumental break',
      type: 'section',
      storyElements: ['visual atmosphere'],
      emotionalArc: 'continuing'
    });
  }

  return result.slice(0, sceneCount);
}

/**
 * Create a lyric section with full analysis
 */
function createLyricSection(text: string, index: number, totalScenes: number): LyricSection {
  const type = detectSectionType(text);
  const storyElements = extractStoryElements(text);
  const emotionalArc = determineEmotionalArc(index, totalScenes, type);
  
  return {
    index,
    text: text.trim(),
    type,
    storyElements,
    emotionalArc
  };
}

/**
 * Detect the type of a lyric section
 */
function detectSectionType(text: string): LyricSection['type'] {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('[chorus]') || lowerText.includes('chorus')) return 'chorus';
  if (lowerText.includes('[verse]') || lowerText.includes('verse')) return 'verse';
  if (lowerText.includes('[bridge]') || lowerText.includes('bridge')) return 'bridge';
  if (lowerText.includes('[intro]') || lowerText.includes('intro')) return 'intro';
  if (lowerText.includes('[outro]') || lowerText.includes('outro')) return 'outro';
  
  // Detect by content patterns
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length <= 2) return 'bridge'; // Short sections are often bridges
  
  // Check for repetitive patterns (chorus indicator)
  const uniqueLines = new Set(lines.map(l => l.toLowerCase().trim()));
  if (uniqueLines.size < lines.length * 0.7) return 'chorus';
  
  return 'verse';
}

/**
 * Extract story elements from lyrics for visual prompts
 */
function extractStoryElements(text: string): string[] {
  const elements: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Check each pattern category
  for (const [category, pattern] of Object.entries(STORY_PATTERNS)) {
    const matches = lowerText.match(pattern);
    if (matches && matches.length > 0) {
      switch (category) {
        case 'nature':
          elements.push('natural elements');
          break;
        case 'motion':
          elements.push('dynamic movement');
          break;
        case 'light':
          elements.push('lighting effects');
          break;
        case 'emotion':
          elements.push('emotional intensity');
          break;
        case 'time':
          elements.push('temporal atmosphere');
          break;
        case 'place':
          elements.push('environmental setting');
          break;
      }
    }
  }
  
  // Add default if nothing detected
  if (elements.length === 0) {
    elements.push('visual atmosphere');
  }
  
  return elements;
}

/**
 * Determine the emotional arc position for this section
 */
function determineEmotionalArc(
  index: number, 
  total: number, 
  sectionType: LyricSection['type']
): string {
  const position = total === 1 ? 0.5 : index / (total - 1);
  
  // Section type affects emotional arc
  if (sectionType === 'intro') return 'establishing';
  if (sectionType === 'outro') return 'resolving';
  if (sectionType === 'chorus') return 'climactic';
  if (sectionType === 'bridge') return 'transitional';
  
  // Position-based arc
  if (position <= 0.2) return 'opening';
  if (position <= 0.4) return 'building';
  if (position <= 0.6) return 'intensifying';
  if (position <= 0.8) return 'peaking';
  return 'concluding';
}

/**
 * Analyze the full song for narrative themes
 */
export function analyzeSongNarrative(lyrics: string): SongNarrativeAnalysis {
  const lowerLyrics = lyrics.toLowerCase();
  
  // Detect narrative type
  const typeCounts: Record<string, number> = {};
  for (const [type, pattern] of Object.entries(NARRATIVE_KEYWORDS)) {
    const matches = lowerLyrics.match(pattern);
    typeCounts[type] = matches?.length || 0;
  }
  
  const narrativeType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] as SongNarrativeAnalysis['narrativeType'] || 'abstract';
  
  // Extract key imagery
  const keyImagery: string[] = [];
  for (const [category, pattern] of Object.entries(STORY_PATTERNS)) {
    const matches = lowerLyrics.match(pattern);
    if (matches && matches.length >= 2) {
      // Get unique matches
      const unique = [...new Set(matches.map(m => m.toLowerCase()))];
      keyImagery.push(...unique.slice(0, 2));
    }
  }
  
  // Determine overall theme
  const themeDescriptions: Record<string, string> = {
    love_story: 'romantic emotional journey',
    journey: 'personal transformation and discovery',
    celebration: 'joyful energy and freedom',
    introspection: 'inner reflection and self-discovery',
    empowerment: 'strength and overcoming challenges',
    abstract: 'artistic visual expression'
  };
  
  const overallTheme = themeDescriptions[narrativeType] || 'artistic expression';
  
  // Determine emotional journey
  const hasProgression = detectProgression(lyrics);
  const emotionalJourney = hasProgression 
    ? 'evolving from quiet opening through building intensity to climactic peak and resolution'
    : 'sustained emotional atmosphere throughout';
  
  return {
    overallTheme,
    narrativeType,
    keyImagery: keyImagery.slice(0, 6),
    emotionalJourney,
    hasProgression
  };
}

/**
 * Detect if lyrics have clear progression
 */
function detectProgression(lyrics: string): boolean {
  const sections = lyrics.split(/\n\s*\n/).filter(s => s.trim());
  if (sections.length < 3) return false;
  
  // Check if sections are meaningfully different
  const uniqueContent = new Set(sections.map(s => s.toLowerCase().trim()));
  return uniqueContent.size >= sections.length * 0.6;
}

/**
 * Extract key themes/imagery from lyrics (legacy export)
 */
export function extractLyricThemes(lyricText: string): string[] {
  return extractStoryElements(lyricText);
}
