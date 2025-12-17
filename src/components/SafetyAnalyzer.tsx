import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface SafetyIssue {
  type: 'warning' | 'error' | 'info';
  message: string;
  suggestion?: string;
}

interface SafetyAnalysis {
  isSafe: boolean;
  issues: SafetyIssue[];
}

interface SafetyAnalyzerProps {
  prompt: string;
  lyrics: string;
  onAnalysisComplete: (analysis: SafetyAnalysis) => void;
}

// Keywords that might trigger content policy issues
const warningKeywords = [
  'violence', 'blood', 'gore', 'weapon', 'gun', 'knife',
  'nude', 'naked', 'explicit', 'sexual',
  'drug', 'cocaine', 'heroin', 'meth',
  'suicide', 'self-harm', 'murder', 'kill'
];

const analyzeContent = (text: string): SafetyAnalysis => {
  const issues: SafetyIssue[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of warningKeywords) {
    if (lowerText.includes(keyword)) {
      issues.push({
        type: 'warning',
        message: `Content contains "${keyword}" which may trigger content policy`,
        suggestion: `Consider rephrasing to avoid "${keyword}" for better generation success`
      });
    }
  }

  return {
    isSafe: issues.length === 0,
    issues
  };
};

export const SafetyAnalyzer = ({ prompt, lyrics, onAnalysisComplete }: SafetyAnalyzerProps) => {
  const [analysis, setAnalysis] = useState<SafetyAnalysis>({ isSafe: true, issues: [] });

  useEffect(() => {
    const combinedText = `${prompt} ${lyrics}`;
    if (combinedText.trim()) {
      const result = analyzeContent(combinedText);
      setAnalysis(result);
      onAnalysisComplete(result);
    } else {
      const emptyResult = { isSafe: true, issues: [] };
      setAnalysis(emptyResult);
      onAnalysisComplete(emptyResult);
    }
  }, [prompt, lyrics, onAnalysisComplete]);

  if (analysis.isSafe && !prompt && !lyrics) {
    return null;
  }

  return (
    <div className={`rounded-2xl p-4 border ${
      analysis.isSafe 
        ? 'bg-green-500/5 border-green-500/20' 
        : 'bg-yellow-500/5 border-yellow-500/20'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Shield className={`w-4 h-4 ${analysis.isSafe ? 'text-green-500' : 'text-yellow-500'}`} />
        <span className="text-sm font-medium">
          {analysis.isSafe ? 'Content looks safe' : 'Safety warnings detected'}
        </span>
        <Badge variant={analysis.isSafe ? 'secondary' : 'outline'} className="ml-auto">
          {analysis.isSafe ? (
            <><CheckCircle className="w-3 h-3 mr-1" /> Clear</>
          ) : (
            <><AlertTriangle className="w-3 h-3 mr-1" /> {analysis.issues.length} issue{analysis.issues.length !== 1 ? 's' : ''}</>
          )}
        </Badge>
      </div>

      {analysis.issues.length > 0 && (
        <div className="space-y-2 mt-3">
          {analysis.issues.map((issue, idx) => (
            <div key={idx} className="text-sm p-2 rounded-lg bg-yellow-500/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-foreground">{issue.message}</p>
                  {issue.suggestion && (
                    <p className="text-muted-foreground text-xs mt-1">{issue.suggestion}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
