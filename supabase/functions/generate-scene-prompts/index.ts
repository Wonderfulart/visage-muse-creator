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
  energyLevel?: number; // 0-1 scale
  tempo?: string; // "slow", "medium", "fast"
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { basePrompt, scenes, aspectRatio, preserveFace } = await req.json();

    console.log('Generating prompts for', scenes.length, 'scenes with base:', basePrompt);

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

    const systemPrompt = `You are a creative director specializing in music video production. Generate vivid, cinematic video prompts for AI video generation (like Google Veo).

Rules:
- Each prompt should be 1-2 sentences, under 50 words
- Focus on visual action, movement, lighting, and atmosphere
- Match the energy level: high energy = dynamic movement, fast cuts; low energy = slow motion, intimate moments
- Maintain visual consistency across scenes using the base style
- ${preserveFace ? "Include subtle face references to maintain character consistency" : "Focus on environment and action"}
- Aspect ratio is ${aspectRatio}, frame compositions accordingly
- Avoid text overlays, subtitles, or watermarks in descriptions
- Use present tense, active voice`;

    const userPrompt = `Base visual style: "${basePrompt}"

Generate a unique, creative prompt for each scene that matches its energy level while maintaining the base style:

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
              description: "Generate video prompts for each scene",
              parameters: {
                type: "object",
                properties: {
                  prompts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number", description: "Scene index (0-based)" },
                        prompt: { type: "string", description: "The generated video prompt" }
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

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const args = JSON.parse(toolCall.function.arguments);
    const prompts = args.prompts;

    console.log("Generated", prompts.length, "scene prompts");

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
