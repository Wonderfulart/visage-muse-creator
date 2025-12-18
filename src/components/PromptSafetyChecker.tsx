import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Sparkles, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface SafetyCheckResult {
  isSafe: boolean;
  issues: string[];
  suggestions: string[];
  riskLevel: 'safe' | 'warning' | 'blocked';
  alternativePrompt?: string;
}

interface PromptSafetyCheckerProps {
  prompt: string;
  referenceImage?: string | null;
  onSuggestionAccepted?: (newPrompt: string) => void;
}

export const PromptSafetyChecker = ({ 
  prompt, 
  referenceImage,
  onSuggestionAccepted 
}: PromptSafetyCheckerProps) => {
  const [result, setResult] = useState<SafetyCheckResult | null>(null);

  useEffect(() => {
    if (prompt.trim().length > 0) {
      checkPromptSafety();
    } else {
      setResult(null);
    }
  }, [prompt, referenceImage]);

  const checkPromptSafety = () => {
    // Blocked terms (will fail generation)
    const blockedTerms = [
      'blood', 'gore', 'violent', 'weapon', 'gun', 'knife', 'death', 'kill', 'murder',
      'nude', 'naked', 'nsfw', 'explicit', 'sexual', 'erotic', 'porn',
      'suicide', 'self-harm', 'drug', 'cocaine', 'heroin',
      'disney', 'marvel', 'star wars', 'pokemon', 'mickey mouse', 'spiderman',
      'trump', 'biden', 'putin', 'jesus', 'mohammed', 'hitler',
      'coca-cola', 'pepsi', 'nike', 'adidas', 'apple logo', 'mcdonalds',
      'midjourney', 'dall-e', 'stable diffusion watermark'
    ];

    // Warning terms (might cause issues)
    const warningTerms = [
      'realistic blood', 'intense fight', 'smoking', 'alcohol', 'beer', 'wine',
      'celebrity', 'famous person', 'public figure', 'politician',
      'logo', 'brand', 'trademark', 'copyright',
      'child', 'kid', 'baby', 'toddler'
    ];

    const lowerPrompt = prompt.toLowerCase();
    const foundBlocked = blockedTerms.filter(term => lowerPrompt.includes(term));
    const foundWarnings = warningTerms.filter(term => lowerPrompt.includes(term));

    const issues: string[] = [];
    const suggestions: string[] = [];
    let riskLevel: 'safe' | 'warning' | 'blocked' = 'safe';
    let alternativePrompt = prompt;

    // Check blocked terms
    if (foundBlocked.length > 0) {
      riskLevel = 'blocked';
      const alternatives: Record<string, string> = {
        'blood': 'red liquid effects',
        'gun': 'stylized prop',
        'naked': 'artistic silhouette',
        'drug': 'fantasy potion',
        'disney': 'fairy tale style',
        'midjourney': ''
      };
      
      foundBlocked.forEach(term => {
        issues.push(`Contains blocked term: "${term}"`);
        if (alternatives[term]) {
          alternativePrompt = alternativePrompt.replace(new RegExp(term, 'gi'), alternatives[term]);
          suggestions.push(`Replace "${term}" with "${alternatives[term]}"`);
        } else {
          suggestions.push(`Remove "${term}" from prompt`);
        }
      });
    }

    // Check warning terms
    if (foundWarnings.length > 0 && riskLevel !== 'blocked') {
      riskLevel = 'warning';
      foundWarnings.forEach(term => {
        issues.push(`Risky term: "${term}" - may cause generation failure`);
        suggestions.push(`Consider rewording or removing "${term}"`);
      });
    }

    // Check prompt length
    if (prompt.length < 10 && prompt.length > 0) {
      issues.push('Prompt too short - may produce inconsistent results');
      suggestions.push('Add more descriptive details (lighting, mood, composition)');
      riskLevel = riskLevel === 'safe' ? 'warning' : riskLevel;
    }

    // Check prompt quality
    if (!lowerPrompt.match(/light|lighting|bright|dark|shadow|glow/) && prompt.length > 10) {
      suggestions.push('💡 Consider adding lighting description');
    }

    if (!lowerPrompt.match(/camera|shot|angle|close|wide|zoom/) && prompt.length > 10) {
      suggestions.push('💡 Consider adding camera direction');
    }

    setResult({
      isSafe: riskLevel === 'safe',
      issues,
      suggestions,
      riskLevel,
      alternativePrompt: riskLevel === 'blocked' ? alternativePrompt : undefined
    });
  };

  const acceptSuggestion = () => {
    if (result?.alternativePrompt && onSuggestionAccepted) {
      onSuggestionAccepted(result.alternativePrompt);
      toast.success('Prompt updated with safe alternative!');
    }
  };

  if (!result) return null;

  const getStatusIcon = () => {
    switch(result.riskLevel) {
      case 'safe': return <CheckCircle className="w-5 h-5 text-rainbow-green" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-rainbow-yellow" />;
      case 'blocked': return <Shield className="w-5 h-5 text-destructive" />;
    }
  };

  const getStatusColor = () => {
    switch(result.riskLevel) {
      case 'safe': return 'border-rainbow-green/30 bg-rainbow-green/5';
      case 'warning': return 'border-rainbow-yellow/30 bg-rainbow-yellow/5';
      case 'blocked': return 'border-destructive/30 bg-destructive/5';
    }
  };

  return (
    <Card className={`${getStatusColor()} border`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {getStatusIcon()}
          <span>
            {result.riskLevel === 'safe' && 'Prompt Safety: All Clear ✓'}
            {result.riskLevel === 'warning' && 'Prompt Warning: Review Recommended'}
            {result.riskLevel === 'blocked' && 'Prompt Blocked: Cannot Generate'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Issues */}
        {result.issues.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Issues Found:</p>
            {result.issues.map((issue, idx) => (
              <p key={idx} className="text-sm text-destructive">• {issue}</p>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Suggestions:</p>
            <div className="space-y-1">
              {result.suggestions.slice(0, 3).map((suggestion, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Sparkles className="w-3 h-3 mt-1 text-primary flex-shrink-0" />
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alternative Prompt */}
        {result.alternativePrompt && result.riskLevel === 'blocked' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Safe Alternative:</p>
            <p className="text-sm p-2 rounded-lg bg-secondary/50 border border-border">
              {result.alternativePrompt}
            </p>
            <Button onClick={acceptSuggestion} size="sm" variant="outline" className="w-full">
              <Sparkles className="w-4 h-4 mr-2" />
              Use This Prompt
            </Button>
          </div>
        )}

        {/* Safe badge */}
        {result.riskLevel === 'safe' && result.suggestions.length === 0 && (
          <Alert className="bg-rainbow-green/10 border-rainbow-green/20">
            <CheckCircle className="w-4 h-4 text-rainbow-green" />
            <AlertDescription className="text-sm">
              Your prompt looks great! Ready to generate high-quality videos.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
