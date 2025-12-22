-- Fix 1: Remove email column from profiles to reduce exposure surface
-- Email is already accessible via auth.users and the trigger only writes it
-- Edge functions use auth.getUser() to get email anyway
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Fix 2: Drop the overly restrictive RLS policy on stripe_customers
-- Service role bypasses RLS, so this false policy is unnecessary
-- RLS being enabled with no valid policies ensures client apps can't access
DROP POLICY IF EXISTS "Service role only access" ON public.stripe_customers;

-- Create a more appropriate policy that explicitly denies authenticated user access
-- This is clearer than using 'false' and documents the intent
-- Note: service_role bypasses RLS entirely, so this only affects regular users
CREATE POLICY "No client access to stripe data"
ON public.stripe_customers
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);