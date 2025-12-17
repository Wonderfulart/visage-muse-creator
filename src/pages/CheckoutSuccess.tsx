import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Sparkles } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSubscription } = useSubscription();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Refresh subscription status after successful checkout
    const timer = setTimeout(() => {
      refreshSubscription();
    }, 2000);

    return () => clearTimeout(timer);
  }, [refreshSubscription]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 p-4 rounded-full bg-green-500/10 w-fit">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your subscription has been activated. You now have access to all premium features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="font-medium">Premium features unlocked!</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate('/app')} className="w-full">
              Start Creating Videos
            </Button>
            <Button variant="outline" onClick={() => navigate('/profile')} className="w-full">
              View Account
            </Button>
          </div>

          {sessionId && (
            <p className="text-xs text-muted-foreground">
              Session: {sessionId.slice(0, 20)}...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
