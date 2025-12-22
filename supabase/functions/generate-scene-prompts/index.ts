import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SceneInput {
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  energyLevel?: number;
  tempo?: number;
  beatDensity?: number;
  narrativePosition?: 'opening' | 'rising' | 'climax' | 'resolution';
  sectionType?: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'section';
}

interface LyricSection {
  index: number;
  text: string;
  type: string;
  storyElements?: string[];
  emotionalArc?: string;
}

interface SongAnalysis {
  overallTheme?: string;
  narrativeType?: string;
  keyImagery?: string[];
  emotionalJourney?: string;
}

// Words that commonly trigger Vertex AI content filters
const FLAGGED_PATTERNS = [
  /\b(drug|drugs|cocaine|heroin|meth|weed|marijuana|smoking|drunk|alcohol|beer|wine|vodka)\b/gi,
  /\b(gun|guns|weapon|weapons|kill|murder|blood|death|die|dying|violent|violence)\b/gi,
  /\b(sex|sexy|naked|nude|kiss|kissing|intimate|romantic|love|lover|bed|bedroom)\b/gi,
  /\b(hate|hating|fight|fighting|punch|hit|hurt|pain|suffer|suffering)\b/gi,
  /\b(sad|depressed|depression|crying|tears|lonely|loneliness|heartbreak|heartbroken)\b/gi,
  /\b(night|dark|darkness|shadow|shadows)\b/gi,
];

// Sanitize prompts to avoid content policy violations
function sanitizePrompt(prompt: string): string {
  let sanitized = prompt;
  
  const replacements: Record<string, string> = {
    'drug': 'abstract particle', 'drugs': 'abstract particles',
    'smoking': 'atmospheric haze', 'drunk': 'dreamlike motion',
    'alcohol': 'liquid reflection', 'gun': 'geometric shape',
    'weapon': 'angular form', 'kill': 'transform', 'murder': 'dissolve',
    'blood': 'crimson light', 'death': 'transition', 'die': 'fade',
    'dying': 'fading', 'violent': 'dynamic', 'violence': 'motion',
    'sex': 'movement', 'sexy': 'elegant', 'naked': 'silhouette',
    'nude': 'abstract form', 'kiss': 'approach', 'kissing': 'moving closer',
    'intimate': 'close-up', 'romantic': 'soft-lit', 'love': 'warmth',
    'lover': 'figure', 'bed': 'soft surface', 'bedroom': 'dimly lit interior',
    'hate': 'intensity', 'hating': 'intense', 'fight': 'dynamic movement',
    'fighting': 'moving dynamically', 'punch': 'swift motion', 'hit': 'impact',
    'hurt': 'react', 'pain': 'expression', 'suffer': 'experience',
    'suffering': 'experiencing', 'sad': 'contemplative', 'depressed': 'introspective',
    'depression': 'stillness', 'crying': 'emotional expression',
    'tears': 'light reflections', 'lonely': 'solitary', 'loneliness': 'solitude',
    'heartbreak': 'emotional moment', 'heartbroken': 'pensive',
    'night': 'low-light environment', 'dark': 'dimly lit',
    'darkness': 'shadow play', 'shadow': 'silhouette', 'shadows': 'silhouettes',
  };

  for (const [word, replacement] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(regex, replacement);
  }

  sanitized = sanitized.replace(/["'].*?["']/g, '');
  sanitized = sanitized.replace(/\b(sings?|says?|speaks?|whispers?|shouts?)\s+["']?[^.]+["']?/gi, 'performs expressively');
  
  return sanitized.trim();
}

// Get camera movement based on tempo and energy
function getCameraMovement(tempo: number, energy: number, narrativePosition: string): string {
  if (tempo > 140 || energy > 0.8) {
    return 'rapid tracking shots, quick cuts, handheld energy, dynamic dolly movements';
  } else if (tempo > 100 || energy > 0.6) {
    return 'smooth crane movements, steady tracking, moderate push-ins, orbital shots';
  } else if (tempo > 70 || energy > 0.4) {
    return 'slow dolly, gentle push-ins, floating camera, lingering shots';
  } else {
    return 'static wide shots, very slow push-ins, contemplative stillness, breathing room';
  }
}

// Get visual intensity based on section type
function getSectionVisuals(sectionType: string): string {
  const visuals: Record<string, string> = {
    'intro': 'wide establishing shot, slow reveal, building anticipation, mysterious atmosphere',
    'verse': 'character-focused, storytelling progression, conversational pacing, intimate framing',
    'chorus': 'maximum visual energy, dramatic reveals, dynamic movement, emotional peak, expansive shots',
    'bridge': 'transition moment, change of scenery, visual breath, unexpected angle shifts',
    'outro': 'resolution and closure, pull-back shots, fading atmosphere, final statement',
    'section': 'balanced composition, narrative continuation, steady progression'
  };
  return visuals[sectionType] || visuals['section'];
}

// Get narrative arc guidance
function getNarrativeGuidance(position: string, sceneIndex: number, totalScenes: number): string {
  const guidance: Record<string, string> = {
    'opening': `SCENE ${sceneIndex + 1}/${totalScenes} - OPENING: Establish the visual world. Introduce the character/setting. Create intrigue and anticipation. Wide shots transitioning to medium.`,
    'rising': `SCENE ${sceneIndex + 1}/${totalScenes} - RISING ACTION: Build visual tension. Develop the story. Increase movement and energy. Layer complexity.`,
    'climax': `SCENE ${sceneIndex + 1}/${totalScenes} - CLIMAX: Peak visual intensity. Maximum emotional impact. Dynamic camera work. The visual high point.`,
    'resolution': `SCENE ${sceneIndex + 1}/${totalScenes} - RESOLUTION: Wind down visually. Bring closure. Echo opening imagery. Contemplative, final statement.`
  };
  return guidance[position] || guidance['rising'];
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const userInfo = await getUserFromToken(req);
    if (!userInfo) {
      console.error('Unauthorized access attempt to generate-scene-prompts');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please log in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scene prompt generation for user:', userInfo.userId);
    const { basePrompt, scenes, aspectRatio, preserveFace, lyrics, lyricSections, songAnalysis } = await req.json();

    const sanitizedBasePrompt = sanitizePrompt(basePrompt);
    console.log('Generating NARRATIVE prompts for', scenes.length, 'scenes');
    console.log('Lyrics mode:', lyrics ? 'enabled' : 'disabled');
    console.log('Song analysis provided:', songAnalysis ? 'yes' : 'no');

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const typedLyricSections = lyricSections as LyricSection[] | undefined;
    const typedSongAnalysis = songAnalysis as SongAnalysis | undefined;
    
    // Build enhanced scene descriptions with rhythm and narrative context
    const sceneDescriptions = (scenes as SceneInput[]).map((scene, i) => {
      const energy = scene.energyLevel || 0.5;
      const tempo = scene.tempo || 100;
      const narrativePos = scene.narrativePosition || 'rising';
      const sectionType = scene.sectionType || 'section';
      
      const cameraMovement = getCameraMovement(tempo, energy, narrativePos);
      const sectionVisuals = getSectionVisuals(sectionType);
      const narrativeGuide = getNarrativeGuidance(narrativePos, i, scenes.length);
      
      let lyricContext = "";
      if (typedLyricSections && typedLyricSections[i]) {
        const section = typedLyricSections[i];
        const sanitizedLyric = sanitizePrompt(section.text);
        const storyElements = section.storyElements?.join(', ') || '';
        lyricContext = `
LYRIC THEMES: "${sanitizedLyric.substring(0, 80)}..."
STORY ELEMENTS: ${storyElements || 'visual metaphor'}
EMOTIONAL ARC: ${section.emotionalArc || 'continuing'}`;
      }
      
      return `
---
${narrativeGuide}
SECTION TYPE: ${sectionType.toUpperCase()}
TEMPO: ${tempo} BPM | ENERGY: ${(energy * 100).toFixed(0)}%
CAMERA STYLE: ${cameraMovement}
VISUAL TREATMENT: ${sectionVisuals}${lyricContext}
TIMING: ${scene.startTime.toFixed(1)}s - ${scene.endTime.toFixed(1)}s (${scene.duration.toFixed(1)}s)
---`;
    }).join("\n");

    // Build song context if available
    let songContext = "";
    if (typedSongAnalysis) {
      songContext = `
OVERALL SONG NARRATIVE:
- Theme: ${typedSongAnalysis.overallTheme || 'artistic expression'}
- Story Type: ${typedSongAnalysis.narrativeType || 'emotional journey'}
- Key Imagery: ${typedSongAnalysis.keyImagery?.join(', ') || 'abstract visuals'}
- Emotional Journey: ${typedSongAnalysis.emotionalJourney || 'dynamic progression'}`;
    }

    const systemPrompt = `You are a VISUAL STORYTELLER creating a cohesive music video narrative. Your job is to create a VISUAL STORY that progresses scene by scene, matching the music's rhythm and emotion.

═══════════════════════════════════════════════════════════════
CORE PRINCIPLE: LYRICS ARE STORYTELLING
═══════════════════════════════════════════════════════════════
Every song tells a story. Your visuals must:
• CREATE A VISUAL NARRATIVE with beginning, development, climax, and resolution
• Scene 1 ESTABLISHES the world/character - who, where, what
• Middle scenes BUILD tension, show transformation, emotional growth
• Final scenes RESOLVE or conclude the visual story
• Even abstract visuals need NARRATIVE FLOW - not random disconnected clips
• Each scene should feel like a chapter that leads to the next

═══════════════════════════════════════════════════════════════
AUDIO RHYTHM MATCHING - THE VIDEO MUST FEEL LIKE THE MUSIC
═══════════════════════════════════════════════════════════════
• HIGH TEMPO (120+ BPM): Quick cuts, rapid camera movement, dynamic action, energetic motion
• MEDIUM TEMPO (80-120 BPM): Balanced pacing, smooth transitions, moderate movement
• LOW TEMPO (<80 BPM): Lingering shots, slow push-ins, contemplative stillness
• ENERGY BUILDUP: Increasingly dynamic camera work as energy rises
• QUIET MOMENTS: Stillness, soft focus, breathing room
• DROPS/CHORUSES: Explosive movement, dramatic reveals, visual peaks

The visual PACE must FEEL like the music SOUNDS.

═══════════════════════════════════════════════════════════════
SAFETY RULES - FOLLOW STRICTLY
═══════════════════════════════════════════════════════════════
• Generate ONLY visual descriptions - NO dialogue, lyrics, text, or spoken words
• Focus on: lighting, camera angles, movement, colors, atmosphere, abstract visuals
• NEVER reference: relationships, romance, intimacy, violence, weapons, drugs, alcohol, death
• Use ABSTRACT VISUAL metaphors instead of literal interpretations
• NO specific person names or celebrity references
• Keep all prompts appropriate for general audiences

═══════════════════════════════════════════════════════════════
VISUAL LANGUAGE
═══════════════════════════════════════════════════════════════
Camera: tracking, dolly, crane, push-in, orbit, handheld, steadicam, drone
Lighting: neon, volumetric, silhouette, rim light, ambient glow, golden hour
Atmosphere: fog, particles, lens flares, bokeh, reflections, haze
Abstract: geometric shapes, light trails, fluid motion, fractal patterns
Environment: industrial, natural landscapes, abstract voids, urban, ethereal

═══════════════════════════════════════════════════════════════
PROMPT FORMAT
═══════════════════════════════════════════════════════════════
• 1-2 sentences, under 50 words
• Present tense, active voice
• Include camera movement + lighting + atmosphere
• Match visual energy to audio energy
• Aspect ratio: ${aspectRatio}
• ${preserveFace ? "Maintain consistent character appearance using reference image style" : "Focus on environment and abstract motion"}`;

    const userPrompt = `BASE VISUAL STYLE: "${sanitizedBasePrompt}"
${songContext}

═══════════════════════════════════════════════════════════════
CREATE A COHESIVE VISUAL NARRATIVE FOR THESE SCENES:
═══════════════════════════════════════════════════════════════

${sceneDescriptions}

═══════════════════════════════════════════════════════════════
INSTRUCTIONS:
═══════════════════════════════════════════════════════════════
1. Treat this as ONE continuous story told through ${scenes.length} visual chapters
2. Scene 1 must ESTABLISH - introduce visual world and character
3. Each scene should PROGRESS the visual narrative logically
4. Match camera movement speed to the tempo provided
5. Match visual intensity to the energy level provided
6. Final scene should feel like CLOSURE

Return a JSON array with {"index": number, "prompt": string} for each scene.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_scene_prompts",
              description: "Generate narrative-driven video prompts that tell a visual story matching the music",
              parameters: {
                type: "object",
                properties: {
                  prompts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number", description: "Scene index (0-based)" },
                        prompt: { type: "string", description: "The generated video prompt - narrative, rhythm-matched, safe" }
                      },
                      required: ["index", "prompt"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["prompts"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_scene_prompts" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received:", JSON.stringify(data).substring(0, 500));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const args = JSON.parse(toolCall.function.arguments);
    let prompts = args.prompts;

    // Post-process: sanitize all generated prompts
    prompts = prompts.map((p: { index: number; prompt: string }) => ({
      index: p.index,
      prompt: sanitizePrompt(p.prompt)
    }));

    console.log("Generated", prompts.length, "narrative-driven scene prompts");

    return new Response(
      JSON.stringify({ success: true, prompts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Scene prompt generation error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: "Scene prompt generation failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
