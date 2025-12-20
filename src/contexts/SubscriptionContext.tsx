import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionTier = 'free' | 'creator_pro' | 'music_video_pro' | 'admin';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: SubscriptionTier;
  subscription_end: string | null;
  videos_generated_this_month: number;
  videos_limit: number;
  videos_remaining: number;
}

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  loading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  canGenerateVideo: boolean;
  tierName: string;
}

const defaultSubscription: SubscriptionData = {
  subscribed: false,
  subscription_tier: 'free',
  subscription_end: null,
  videos_generated_this_month: 0,
  videos_limit: 3,
  videos_remaining: 3,
};

const TIER_NAMES: Record<SubscriptionTier, string> = {
  free: 'Free',
  creator_pro: 'Creator Pro',
  music_video_pro: 'Music Video Pro',
  admin: 'Admin',
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user, session, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSubscription = useCallback(async () => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (!user) {
      setSubscription(defaultSubscription);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Get fresh session to avoid stale token issues during refresh
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        setSubscription(defaultSubscription);
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (fnError) {
        // If JWT is invalid, try refreshing the session once
        if (fnError.message?.includes('Invalid JWT') || fnError.message?.includes('401')) {
          const { data: refreshedSession } = await supabase.auth.refreshSession();
          if (refreshedSession.session?.access_token) {
            const { data: retryData, error: retryError } = await supabase.functions.invoke('check-subscription', {
              headers: {
                Authorization: `Bearer ${refreshedSession.session.access_token}`,
              },
            });
            if (!retryError && retryData) {
              setSubscription(retryData as SubscriptionData);
              return;
            }
          }
        }
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setSubscription(data as SubscriptionData);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to check subscription');
      setSubscription(defaultSubscription);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  // Check subscription on mount and when user/auth state changes
  useEffect(() => {
    // Don't check until auth is done loading
    if (authLoading) {
      return;
    }

    if (user && session?.access_token) {
      refreshSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user, authLoading, refreshSubscription]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(refreshSubscription, 300000);
    return () => clearInterval(interval);
  }, [user, refreshSubscription]);

  const canGenerateVideo = subscription ? subscription.videos_remaining > 0 : false;
  const tierName = subscription ? TIER_NAMES[subscription.subscription_tier] : 'Free';

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      loading,
      error,
      refreshSubscription,
      canGenerateVideo,
      tierName,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
