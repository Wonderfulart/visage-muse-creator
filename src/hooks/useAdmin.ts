import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'moderator' | 'user';

interface UserProfile {
  id: string;
  email: string | null;
  created_at: string;
  subscription_tier: string | null;
  videos_generated_this_month: number | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  // Check if current user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any).rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (err) {
        console.error('Error checking admin:', err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user]);

  // Fetch all users (admin only)
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await (supabase as any).rpc('get_all_users_for_admin');
      
      if (error) {
        console.error('Error fetching users:', error);
        return;
      }

      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [isAdmin]);

  // Fetch all user roles (admin only)
  const fetchUserRoles = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await (supabase as any).rpc('get_user_roles_for_admin');
      
      if (error) {
        console.error('Error fetching user roles:', error);
        return;
      }

      setUserRoles(data || []);
    } catch (err) {
      console.error('Error fetching user roles:', err);
    }
  }, [isAdmin]);

  // Add role to user
  const addUserRole = useCallback(async (userId: string, role: AppRole) => {
    try {
      const { error } = await (supabase as any).rpc('admin_add_user_role', {
        _user_id: userId,
        _role: role
      });

      if (error) throw error;

      await fetchUserRoles();
      return { success: true };
    } catch (err) {
      console.error('Error adding role:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to add role' };
    }
  }, [fetchUserRoles]);

  // Remove role from user
  const removeUserRole = useCallback(async (userId: string, role: AppRole) => {
    try {
      const { error } = await (supabase as any).rpc('admin_remove_user_role', {
        _user_id: userId,
        _role: role
      });

      if (error) throw error;

      await fetchUserRoles();
      return { success: true };
    } catch (err) {
      console.error('Error removing role:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to remove role' };
    }
  }, [fetchUserRoles]);

  // Get roles for a specific user
  const getUserRoles = useCallback((userId: string): AppRole[] => {
    return userRoles
      .filter(ur => ur.user_id === userId)
      .map(ur => ur.role);
  }, [userRoles]);

  // Fetch data when admin status changes
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchUserRoles();
    }
  }, [isAdmin, fetchUsers, fetchUserRoles]);

  return {
    isAdmin,
    loading,
    users,
    userRoles,
    fetchUsers,
    fetchUserRoles,
    addUserRole,
    removeUserRole,
    getUserRoles
  };
};
