// Prompt validation utility for detecting content policy violations
// Mirrors patterns from generate-scene-prompts edge function

export interface ValidationIssue {
  word: string;
  position: number;
  replacement: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  sanitizedPrompt: string;
}

// High-risk words that Vertex AI may reject
export const BLOCKED_WORDS: Record<string, string> = {
  // Violence
  'gun': 'geometric metallic shape',
  'guns': 'geometric metallic shapes',
  'weapon': 'abstract object',
  'weapons': 'abstract objects',
  'blood': 'crimson flowing light',
  'bloody': 'deep red atmospheric',
  'kill': 'dramatic transformation',
  'killing': 'dramatic transformation',
  'murder': 'mysterious shadow',
  'dead': 'still silhouette',
  'death': 'ethereal transition',
  'fight': 'dynamic movement',
  'fighting': 'dynamic movements',
  'violence': 'intense motion',
  'violent': 'intense atmospheric',
  'stab': 'swift motion',
  'shoot': 'beam of light',
  'shooting': 'beams of light',
  'knife': 'silver gleaming edge',
  'sword': 'luminous blade shape',
  
  // Substances
  'drug': 'abstract particles',
  'drugs': 'abstract particles',
  'cocaine': 'white crystalline light',
  'heroin': 'dark flowing substance',
  'marijuana': 'green organic smoke',
  'weed': 'natural green haze',
  'smoke': 'atmospheric mist',
  'smoking': 'wisps of vapor',
  'drunk': 'dizzying motion blur',
  'alcohol': 'amber liquid light',
  'beer': 'golden bubbling liquid',
  'wine': 'deep burgundy reflections',
  
  // Suggestive content
  'naked': 'ethereal silhouette',
  'nude': 'artistic silhouette',
  'sexy': 'elegant confident',
  'sexual': 'intimate atmospheric',
  'erotic': 'sensual lighting',
  'kiss': 'intimate connection',
  'kissing': 'close tender moment',
  'seduce': 'magnetic attraction',
  
  // Identity/Relationship
  'girlfriend': 'companion figure',
  'boyfriend': 'companion figure',
  'wife': 'partner silhouette',
  'husband': 'partner silhouette',
  'lover': 'connected figure',
  'baby': 'gentle presence',
  'babe': 'graceful figure',
  
  // Potentially problematic themes
  'hate': 'intense emotion',
  'hatred': 'dark intensity',
  'revenge': 'determined energy',
  'suicide': 'emotional descent',
  'depressed': 'melancholic atmosphere',
  'depression': 'somber mood',
  'anxiety': 'restless energy',
  'fear': 'shadowy anticipation',
  'scared': 'tense atmosphere',
  'terrified': 'dramatic suspense',
  'horror': 'mysterious darkness',
  'demon': 'abstract dark form',
  'devil': 'shadowy figure',
  'hell': 'fiery underworld glow',
  'satan': 'dark atmospheric presence',
};

// Warning words that may trigger issues in context
export const WARNING_WORDS: Record<string, string> = {
  'night': 'twilight ambiance',
  'dark': 'dimly lit',
  'darkness': 'soft shadows',
  'shadow': 'gentle silhouette',
  'shadows': 'gentle silhouettes',
  'black': 'deep tone',
  'cry': 'emotional expression',
  'crying': 'emotional moment',
  'tears': 'glistening droplets',
  'pain': 'emotional intensity',
  'hurt': 'tender emotion',
  'angry': 'passionate expression',
  'anger': 'fiery emotion',
  'rage': 'intense energy',
  'scream': 'vocal expression',
  'screaming': 'expressive moment',
  'alone': 'solitary figure',
  'lonely': 'quiet solitude',
  'sad': 'contemplative mood',
  'heartbreak': 'emotional moment',
  'broken': 'fragmented light',
  'lost': 'wandering figure',
  'miss': 'longing gaze',
  'love': 'warmth and connection',
  'romantic': 'intimate atmosphere',
  'passion': 'intense emotion',
  'desire': 'magnetic pull',
  'want': 'reaching motion',
  'need': 'gravitational pull',
  'touch': 'gentle connection',
  'hold': 'embracing gesture',
  'body': 'graceful form',
  'skin': 'soft texture',
  'lips': 'expressive features',
  'eyes': 'luminous gaze',
  'heart': 'pulsing light',
  'soul': 'ethereal essence',
  'fire': 'warm glow',
  'burn': 'radiant heat',
  'burning': 'glowing embers',
  'hot': 'warm atmosphere',
  'cold': 'cool blue tones',
  'ice': 'crystalline surface',
  'storm': 'dynamic weather',
  'rain': 'falling droplets',
  'thunder': 'rumbling sky',
  'lightning': 'electric flash',
};

/**
 * Validates a prompt and returns issues with replacement suggestions
 */
export function validatePrompt(prompt: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  let sanitizedPrompt = prompt;
  const lowerPrompt = prompt.toLowerCase();

  // Check blocked words (errors)
  for (const [word, replacement] of Object.entries(BLOCKED_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let match;
    while ((match = regex.exec(lowerPrompt)) !== null) {
      issues.push({
        word: match[0],
        position: match.index,
        replacement,
        severity: 'error',
      });
    }
    sanitizedPrompt = sanitizedPrompt.replace(regex, replacement);
  }

  // Check warning words
  for (const [word, replacement] of Object.entries(WARNING_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let match;
    while ((match = regex.exec(lowerPrompt)) !== null) {
      // Only add if not already found as blocked
      if (!issues.some(i => i.position === match!.index)) {
        issues.push({
          word: match[0],
          position: match.index,
          replacement,
          severity: 'warning',
        });
      }
    }
    // Don't auto-replace warnings in sanitized prompt
  }

  // Sort by position
  issues.sort((a, b) => a.position - b.position);

  const hasErrors = issues.some(i => i.severity === 'error');
  
  return {
    isValid: !hasErrors,
    issues,
    sanitizedPrompt,
  };
}

/**
 * Creates highlighted spans for flagged words in a prompt
 */
export function getHighlightedSegments(prompt: string): Array<{ text: string; type: 'normal' | 'error' | 'warning' }> {
  const { issues } = validatePrompt(prompt);
  if (issues.length === 0) {
    return [{ text: prompt, type: 'normal' }];
  }

  const segments: Array<{ text: string; type: 'normal' | 'error' | 'warning' }> = [];
  let lastEnd = 0;

  for (const issue of issues) {
    // Add normal text before this issue
    if (issue.position > lastEnd) {
      segments.push({
        text: prompt.slice(lastEnd, issue.position),
        type: 'normal',
      });
    }
    
    // Add the flagged word
    segments.push({
      text: prompt.slice(issue.position, issue.position + issue.word.length),
      type: issue.severity,
    });
    
    lastEnd = issue.position + issue.word.length;
  }

  // Add remaining text
  if (lastEnd < prompt.length) {
    segments.push({
      text: prompt.slice(lastEnd),
      type: 'normal',
    });
  }

  return segments;
}

/**
 * Applies a single replacement to a prompt
 */
export function applyReplacement(prompt: string, issue: ValidationIssue): string {
  const before = prompt.slice(0, issue.position);
  const after = prompt.slice(issue.position + issue.word.length);
  return before + issue.replacement + after;
}

/**
 * Fully sanitizes a prompt by replacing all blocked words
 */
export function sanitizePrompt(prompt: string): string {
  return validatePrompt(prompt).sanitizedPrompt;
}

/**
 * Gets a count of issues by severity
 */
export function getIssueCount(prompt: string): { errors: number; warnings: number } {
  const { issues } = validatePrompt(prompt);
  return {
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
  };
}
