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
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSubscription = useCallback(async () => {
    if (!session?.access_token) {
      setSubscription(defaultSubscription);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fnError } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fnError) {
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
  }, [session?.access_token]);

  // Check subscription on mount and when user changes
  useEffect(() => {
    if (user) {
      refreshSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user, refreshSubscription]);

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
