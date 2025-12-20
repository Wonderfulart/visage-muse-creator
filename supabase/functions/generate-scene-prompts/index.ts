import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  tempo?: string;
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
  
  // Replace potentially flagged words with safe visual alternatives
  const replacements: Record<string, string> = {
    'drug': 'abstract particle',
    'drugs': 'abstract particles',
    'smoking': 'atmospheric haze',
    'drunk': 'dreamlike motion',
    'alcohol': 'liquid reflection',
    'gun': 'geometric shape',
    'weapon': 'angular form',
    'kill': 'transform',
    'murder': 'dissolve',
    'blood': 'crimson light',
    'death': 'transition',
    'die': 'fade',
    'dying': 'fading',
    'violent': 'dynamic',
    'violence': 'motion',
    'sex': 'movement',
    'sexy': 'elegant',
    'naked': 'silhouette',
    'nude': 'abstract form',
    'kiss': 'approach',
    'kissing': 'moving closer',
    'intimate': 'close-up',
    'romantic': 'soft-lit',
    'love': 'warmth',
    'lover': 'figure',
    'bed': 'soft surface',
    'bedroom': 'dimly lit interior',
    'hate': 'intensity',
    'hating': 'intense',
    'fight': 'dynamic movement',
    'fighting': 'moving dynamically',
    'punch': 'swift motion',
    'hit': 'impact',
    'hurt': 'react',
    'pain': 'expression',
    'suffer': 'experience',
    'suffering': 'experiencing',
    'sad': 'contemplative',
    'depressed': 'introspective',
    'depression': 'stillness',
    'crying': 'emotional expression',
    'tears': 'light reflections',
    'lonely': 'solitary',
    'loneliness': 'solitude',
    'heartbreak': 'emotional moment',
    'heartbroken': 'pensive',
    'night': 'low-light environment',
    'dark': 'dimly lit',
    'darkness': 'shadow play',
    'shadow': 'silhouette',
    'shadows': 'silhouettes',
  };

  for (const [word, replacement] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(regex, replacement);
  }

  // Remove any quotes or lyrics that might be embedded
  sanitized = sanitized.replace(/["'].*?["']/g, '');
  
  // Remove phrases that indicate lyrics or dialogue
  sanitized = sanitized.replace(/\b(sings?|says?|speaks?|whispers?|shouts?)\s+["']?[^.]+["']?/gi, 'performs expressively');
  
  return sanitized.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { basePrompt, scenes, aspectRatio, preserveFace } = await req.json();

    // Sanitize the base prompt first
    const sanitizedBasePrompt = sanitizePrompt(basePrompt);
    console.log('Generating prompts for', scenes.length, 'scenes');
    console.log('Original base prompt:', basePrompt.substring(0, 100));
    console.log('Sanitized base prompt:', sanitizedBasePrompt.substring(0, 100));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const sceneDescriptions = (scenes as SceneInput[]).map((scene, i) => {
      const energyDesc = scene.energyLevel 
        ? scene.energyLevel > 0.7 ? "high energy" : scene.energyLevel > 0.4 ? "medium energy" : "calm/low energy"
        : "unknown energy";
      const tempoDesc = scene.tempo || "medium tempo";
      return `Scene ${scene.index + 1} (${scene.startTime.toFixed(1)}s - ${scene.endTime.toFixed(1)}s, ${scene.duration.toFixed(1)}s): ${energyDesc}, ${tempoDesc}`;
    }).join("\n");

    const systemPrompt = `You are a visual director creating prompts for Google Veo AI video generation. Generate ONLY safe, abstract visual descriptions.

CRITICAL SAFETY RULES - FOLLOW STRICTLY:
- Generate ONLY visual descriptions - NO dialogue, lyrics, text, or spoken words
- Focus EXCLUSIVELY on: lighting, camera angles, movement, colors, atmosphere, abstract visuals
- NEVER reference: relationships, romance, intimacy, violence, weapons, drugs, alcohol, death, sadness, depression
- AVOID emotional themes - use ABSTRACT VISUAL metaphors instead
- NO specific person names or celebrity references
- NO suggestive, provocative, or mature content
- Keep all prompts appropriate for general audiences

VISUAL FOCUS:
- Camera movements: tracking, dolly, crane, slow push-in, orbit
- Lighting: neon, volumetric, silhouette, rim light, ambient glow
- Atmosphere: fog, particles, lens flares, bokeh, reflections
- Abstract elements: geometric shapes, light trails, fluid motion
- Environment: industrial spaces, natural landscapes, abstract voids

PROMPT STRUCTURE:
- Each prompt: 1-2 sentences, under 50 words
- Use present tense, active voice
- Match energy level to visual dynamism (not emotional content)
- Aspect ratio is ${aspectRatio}
- ${preserveFace ? "Maintain consistent character appearance across scenes" : "Focus on environment and abstract motion"}`;

    const userPrompt = `Base visual style (sanitized): "${sanitizedBasePrompt}"

Generate a unique, SAFE visual prompt for each scene. Focus on camera movement, lighting, and abstract visuals. Do NOT include any lyrics, dialogue, or emotional text.

${sceneDescriptions}

Return a JSON array with prompts for each scene in order. Each object should have "index" (number) and "prompt" (string).`;

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
              description: "Generate safe video prompts for each scene",
              parameters: {
                type: "object",
                properties: {
                  prompts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number", description: "Scene index (0-based)" },
                        prompt: { type: "string", description: "The generated video prompt - must be safe and abstract" }
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

    // Post-process: sanitize all generated prompts as a final safety check
    prompts = prompts.map((p: { index: number; prompt: string }) => ({
      index: p.index,
      prompt: sanitizePrompt(p.prompt)
    }));

    console.log("Generated and sanitized", prompts.length, "scene prompts");

    return new Response(
      JSON.stringify({ success: true, prompts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Scene prompt generation error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
