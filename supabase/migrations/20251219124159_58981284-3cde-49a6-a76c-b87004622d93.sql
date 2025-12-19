-- Create a security definer function to get all users (admin only)
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  subscription_tier text,
  videos_generated_this_month integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.created_at,
    p.subscription_tier,
    p.videos_generated_this_month
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

-- Create function to get user roles (admin only)
CREATE OR REPLACE FUNCTION public.get_user_roles_for_admin()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role app_role,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT ur.id, ur.user_id, ur.role, ur.created_at
  FROM public.user_roles ur
  ORDER BY ur.created_at DESC;
END;
$$;

-- Create function to add a role to a user (admin only)
CREATE OR REPLACE FUNCTION public.admin_add_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Create function to remove a role from a user (admin only)
CREATE OR REPLACE FUNCTION public.admin_remove_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Prevent removing own admin role
  IF _user_id = auth.uid() AND _role = 'admin' THEN
    RAISE EXCEPTION 'Cannot remove your own admin role';
  END IF;
  
  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = _role;
END;
$$;