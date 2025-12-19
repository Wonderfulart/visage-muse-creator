import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Check if user has admin role via database function
async function checkIsAdmin(supabaseClient: any, userId: string): Promise<boolean> {
  const { data, error } = await supabaseClient.rpc('has_role', {
    _user_id: userId,
    _role: 'admin'
  });
  if (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
  return data === true;
}

// Product IDs from Stripe
const PRODUCT_TO_TIER: Record<string, string> = {
  "prod_TcVk7bToD3CHAF": "free",
  "prod_TcVkf19uPseh3x": "creator_pro",
  "prod_TcVk8XWwrCiD6w": "music_video_pro",
};

const TIER_LIMITS: Record<string, number> = {
  free: 3,
  creator_pro: 50,
  music_video_pro: 150,
  admin: 999999,
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user is admin via database role
    const isAdmin = await checkIsAdmin(supabaseClient, user.id);
    if (isAdmin) {
      logStep("Admin user detected, returning unlimited access");
      
      // Update profile to admin tier
      await supabaseClient
        .from("profiles")
        .update({ subscription_tier: "admin" })
        .eq("id", user.id);

      return new Response(JSON.stringify({
        subscribed: true,
        subscription_tier: "admin",
        subscription_end: null,
        videos_generated_this_month: 0,
        videos_limit: 999999,
        videos_remaining: 999999,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists in Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    // Get current profile data
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("videos_generated_this_month, usage_reset_date, subscription_tier")
      .eq("id", user.id)
      .single();

    // Check if we need to reset the monthly counter
    let videosThisMonth = profile?.videos_generated_this_month || 0;
    const usageResetDate = profile?.usage_reset_date ? new Date(profile.usage_reset_date) : new Date();
    const now = new Date();
    
    // Reset counter if it's a new month
    if (usageResetDate.getMonth() !== now.getMonth() || usageResetDate.getFullYear() !== now.getFullYear()) {
      videosThisMonth = 0;
      await supabaseClient
        .from("profiles")
        .update({ 
          videos_generated_this_month: 0, 
          usage_reset_date: now.toISOString() 
        })
        .eq("id", user.id);
      logStep("Reset monthly counter for new month");
    }

    if (customers.data.length === 0) {
      logStep("No Stripe customer found, returning free tier");
      
      // Update profile to ensure it has free tier
      await supabaseClient
        .from("profiles")
        .update({ subscription_tier: "free" })
        .eq("id", user.id);

      return new Response(JSON.stringify({
        subscribed: false,
        subscription_tier: "free",
        subscription_end: null,
        videos_generated_this_month: videosThisMonth,
        videos_limit: TIER_LIMITS.free,
        videos_remaining: Math.max(0, TIER_LIMITS.free - videosThisMonth),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    let subscriptionTier = "free";
    let subscriptionEnd = null;
    let hasActiveSub = false;

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      hasActiveSub = true;
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      
      const productId = subscription.items.data[0].price.product as string;
      subscriptionTier = PRODUCT_TO_TIER[productId] || "free";
      
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        productId, 
        tier: subscriptionTier,
        endDate: subscriptionEnd 
      });
    } else {
      logStep("No active subscription found");
    }

    // Update profile with subscription info
    await supabaseClient
      .from("profiles")
      .update({
        stripe_customer_id: customerId,
        subscription_tier: subscriptionTier,
        subscription_end: subscriptionEnd,
      })
      .eq("id", user.id);

    const limit = TIER_LIMITS[subscriptionTier] || TIER_LIMITS.free;

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      videos_generated_this_month: videosThisMonth,
      videos_limit: limit,
      videos_remaining: Math.max(0, limit - videosThisMonth),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: "Failed to check subscription. Please try again." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
