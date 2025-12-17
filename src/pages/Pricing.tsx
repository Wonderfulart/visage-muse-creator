import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Zap, Crown, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const tiers = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out video generation',
    icon: Sparkles,
    features: [
      '3 videos per month',
      'Single scene generation',
      'Basic templates',
      'Watermarked videos',
      'Community support',
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    id: 'creator_pro',
    name: 'Creator Pro',
    price: '$29',
    period: '/month',
    description: 'For serious content creators',
    icon: Zap,
    features: [
      '50 videos per month',
      '5-scene batch generation',
      'All templates',
      'Safety analyzer',
      'Cover art + SEO tools',
      'No watermark',
      'Priority support',
    ],
    cta: 'Upgrade Now',
    popular: true,
  },
  {
    id: 'music_video_pro',
    name: 'Music Video Pro',
    price: '$79',
    period: '/month',
    description: 'Professional music video production',
    icon: Crown,
    features: [
      '150 videos per month',
      'Lyrics-to-video sync',
      'Unlimited batch scenes',
      'Priority processing',
      'Full SEO suite',
      'API access',
      'Dedicated support',
      'Early feature access',
    ],
    cta: 'Go Pro',
    popular: false,
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { subscription, refreshSubscription } = useSubscription();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSelectTier = async (tierId: string) => {
    if (!user || !session) {
      navigate('/auth');
      return;
    }

    if (tierId === 'free') {
      toast({
        title: 'Free Plan',
        description: "You're already on the free plan!",
      });
      return;
    }

    if (subscription?.subscription_tier === tierId) {
      toast({
        title: 'Already Subscribed',
        description: `You're already on the ${tiers.find(t => t.id === tierId)?.name} plan.`,
      });
      return;
    }

    setLoadingTier(tierId);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier: tierId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to start checkout',
        variant: 'destructive',
      });
    } finally {
      setLoadingTier(null);
    }
  };

  const currentTier = subscription?.subscription_tier || 'free';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Choose Your Plan</h1>
            <p className="text-muted-foreground">Unlock the full power of AI video generation</p>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isCurrentTier = currentTier === tier.id;
            const isLoading = loadingTier === tier.id;

            return (
              <Card 
                key={tier.id} 
                className={`relative flex flex-col ${tier.popular ? 'border-primary shadow-lg scale-105' : ''} ${isCurrentTier ? 'ring-2 ring-primary' : ''}`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}
                {isCurrentTier && (
                  <Badge className="absolute -top-3 right-4 bg-green-500">
                    Your Plan
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 w-fit">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="text-center pb-4">
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-muted-foreground">{tier.period}</span>
                  </div>
                  
                  <ul className="space-y-2 text-left">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter className="mt-auto">
                  <Button 
                    className="w-full" 
                    variant={tier.popular ? 'default' : 'outline'}
                    disabled={isCurrentTier || isLoading}
                    onClick={() => handleSelectTier(tier.id)}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentTier ? (
                      'Current Plan'
                    ) : (
                      tier.cta
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* FAQ or additional info */}
        <div className="mt-12 text-center text-muted-foreground">
          <p>All plans include automatic monthly usage reset.</p>
          <p className="mt-1">Cancel anytime from your profile settings.</p>
        </div>
      </div>
    </div>
  );
}
