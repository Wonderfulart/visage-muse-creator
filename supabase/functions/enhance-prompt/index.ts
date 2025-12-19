import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation
function validateInput(data: unknown): { valid: true; data: { prompt: string } } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const body = data as Record<string, unknown>;

  // Validate prompt
  if (!body.prompt || typeof body.prompt !== 'string') {
    return { valid: false, error: 'Prompt is required and must be a string' };
  }
  if (body.prompt.length > 2000) {
    return { valid: false, error: 'Prompt must be less than 2000 characters' };
  }
  if (body.prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt cannot be empty' };
  }

  return {
    valid: true,
    data: {
      prompt: body.prompt.trim()
    }
  };
}

// Get user from JWT token
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
    // Verify user authentication
    const userInfo = await getUserFromToken(req);
    if (!userInfo) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please log in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', userInfo.userId);

    // Validate input
    const rawBody = await req.json();
    const validation = validateInput(rawBody);
    
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt } = validation.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Enhancing prompt for user:', userInfo.userId);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert at crafting detailed, cinematic video generation prompts for music videos. Your task is to enhance user prompts to be more vivid, specific, and visually compelling.

Guidelines for enhancement:
- Add specific lighting details (golden hour, neon, dramatic shadows, etc.)
- Include camera movement suggestions (slow-mo, tracking shot, dolly zoom, etc.)
- Describe atmosphere and mood in detail
- Add visual style references (cinematic, film grain, high contrast, etc.)
- Keep the core intent of the original prompt
- Make it suitable for AI video generation
- Keep the enhanced prompt concise but detailed (2-4 sentences max)
- IMPORTANT: If the prompt mentions a person or face, emphasize preserving their facial features and likeness

Respond with ONLY the enhanced prompt, no explanations or additional text.`
          },
          {
            role: 'user',
            content: `Enhance this music video prompt: "${prompt}"`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim();

    if (!enhancedPrompt) {
      throw new Error('No enhanced prompt received from AI');
    }

    console.log('Enhanced prompt generated successfully');

    return new Response(
      JSON.stringify({ enhancedPrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error enhancing prompt:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to enhance prompt. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
