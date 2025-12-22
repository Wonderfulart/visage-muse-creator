-- Create a separate admin-only table for Stripe customer data
-- This table will never be directly queried by client applications

CREATE TABLE public.stripe_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

-- Only allow service role (edge functions) to access this table
-- No policies for regular users = complete isolation
CREATE POLICY "Service role only access"
ON public.stripe_customers
FOR ALL
USING (false)
WITH CHECK (false);

-- Migrate existing data from profiles to stripe_customers
INSERT INTO public.stripe_customers (user_id, stripe_customer_id)
SELECT id, stripe_customer_id
FROM public.profiles
WHERE stripe_customer_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Remove stripe_customer_id from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;