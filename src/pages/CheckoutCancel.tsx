import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle, ArrowLeft } from 'lucide-react';

export default function CheckoutCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 p-4 rounded-full bg-destructive/10 w-fit">
            <XCircle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Checkout Cancelled</CardTitle>
          <CardDescription>
            Your payment was not completed. No charges were made to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If you experienced any issues during checkout, please try again or contact support.
          </p>
          
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate('/pricing')} className="w-full">
              View Plans Again
            </Button>
            <Button variant="outline" onClick={() => navigate('/app')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Studio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
