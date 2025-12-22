-- Add INSERT policy for profiles table
-- This ensures users can only create a profile for their own user_id
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);