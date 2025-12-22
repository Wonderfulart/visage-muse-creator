import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CharacterAnalysis {
  mood: string[];
  colorPalette: string[];
  visualStyle: string;
  characterDescription: string;
  suggestedCameraWork: string;
  emotionalTone: string;
  settingSuggestions: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    console.log('Analyzing character image:', imageUrl);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert cinematographer and visual storyteller. Analyze this reference image to extract key visual and mood information that will guide music video generation.

Your analysis should be comprehensive and actionable for AI video generation.

Return your analysis as a JSON object with these exact fields:
- mood: Array of 3-5 mood keywords (e.g., "melancholic", "energetic", "dreamy", "intense", "serene")
- colorPalette: Array of 4-6 dominant/suggested colors in descriptive terms (e.g., "warm amber", "deep navy", "soft pink")
- visualStyle: A single phrase describing the overall visual aesthetic (e.g., "cinematic noir", "vibrant pop art", "ethereal dreamscape", "gritty urban")
- characterDescription: A detailed but concise description of the person/character for maintaining consistency (e.g., "young woman with long dark hair, defined cheekbones, wearing a vintage leather jacket")
- suggestedCameraWork: Suggested camera techniques that match the mood (e.g., "slow dolly movements, intimate close-ups, shallow depth of field")
- emotionalTone: The primary emotional undercurrent (e.g., "longing and hope", "rebellious energy", "peaceful contemplation")
- settingSuggestions: Array of 3-4 setting/environment suggestions that would complement this character (e.g., "rain-soaked city streets", "golden hour meadow", "neon-lit club")

Be specific and creative. Your analysis will directly influence the quality of the generated music video.`;

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
          { 
            role: "user", 
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl }
              },
              {
                type: "text",
                text: "Analyze this image for music video generation. Return only valid JSON matching the specified format."
              }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    console.log('Raw AI response:', content);

    // Parse the JSON response
    let analysis: CharacterAnalysis;
    try {
      // Try to extract JSON from the response (in case it's wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a default analysis if parsing fails
      analysis = {
        mood: ["cinematic", "expressive", "dynamic"],
        colorPalette: ["warm tones", "natural lighting", "subtle shadows"],
        visualStyle: "contemporary cinematic",
        characterDescription: "person from reference image",
        suggestedCameraWork: "dynamic tracking shots with intimate close-ups",
        emotionalTone: "engaging and authentic",
        settingSuggestions: ["urban environment", "natural outdoor setting", "minimal studio backdrop"]
      };
    }

    console.log('Character analysis complete:', analysis);

    return new Response(JSON.stringify({ 
      success: true, 
      analysis 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error analyzing character:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to analyze character" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
