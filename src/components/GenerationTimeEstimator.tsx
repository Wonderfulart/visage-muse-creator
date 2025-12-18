import { Clock, Zap, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EstimatorProps {
  sceneCount: number;
  averageDuration: number;
  complexity: 'simple' | 'medium' | 'complex';
  hasReferenceImage?: boolean;
}

export const GenerationTimeEstimator = ({ 
  sceneCount, 
  averageDuration,
  complexity,
  hasReferenceImage 
}: EstimatorProps) => {
  // Base time per scene in seconds
  const baseTimePerScene = averageDuration === 5 ? 60 : 90;
  
  // Complexity multiplier
  const complexityMultiplier = {
    simple: 1,
    medium: 1.2,
    complex: 1.5
  }[complexity];

  // Reference image adds processing time
  const referenceBonus = hasReferenceImage ? 15 : 0;

  // Calculate times
  const minTimePerScene = Math.floor((baseTimePerScene * complexityMultiplier) * 0.8);
  const maxTimePerScene = Math.floor((baseTimePerScene * complexityMultiplier) * 1.2) + referenceBonus;
  
  const totalMinTime = Math.ceil((minTimePerScene * sceneCount) / 60);
  const totalMaxTime = Math.ceil((maxTimePerScene * sceneCount) / 60);

  const getComplexityColor = () => {
    switch(complexity) {
      case 'simple': return 'bg-rainbow-green/10 text-rainbow-green border-rainbow-green/20';
      case 'medium': return 'bg-rainbow-yellow/10 text-rainbow-yellow border-rainbow-yellow/20';
      case 'complex': return 'bg-rainbow-red/10 text-rainbow-red border-rainbow-red/20';
    }
  };

  const getSpeedText = () => {
    if (totalMaxTime <= 2) return { text: 'Lightning Fast', icon: '⚡' };
    if (totalMaxTime <= 5) return { text: 'Quick Generation', icon: '🚀' };
    if (totalMaxTime <= 10) return { text: 'Standard Speed', icon: '⏱️' };
    return { text: 'Takes Time', icon: '⏳' };
  };

  const speed = getSpeedText();

  if (sceneCount === 0) return null;

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-heading font-semibold text-foreground">Estimated Time</span>
          </div>
          <Badge variant="outline" className={getComplexityColor()}>
            {complexity} prompt
          </Badge>
        </div>

        {/* Time Display */}
        <div className="text-center py-4">
          <div className="text-4xl font-heading font-bold text-rainbow bg-clip-text text-transparent bg-gradient-to-r from-primary to-rainbow-cyan">
            {totalMinTime}-{totalMaxTime} min
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {speed.icon} {speed.text}
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between p-2 rounded-lg bg-secondary/30">
            <span className="text-muted-foreground">Scenes:</span>
            <span className="font-medium text-foreground">{sceneCount}</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-secondary/30">
            <span className="text-muted-foreground">Per scene:</span>
            <span className="font-medium text-foreground">{minTimePerScene}-{maxTimePerScene}s</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-secondary/30">
            <span className="text-muted-foreground">Clip length:</span>
            <span className="font-medium text-foreground">{averageDuration}s</span>
          </div>
          {hasReferenceImage && (
            <div className="flex justify-between p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">Ref bonus:</span>
              <span className="font-medium text-foreground">+{referenceBonus}s</span>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              {totalMaxTime > 10 
                ? 'Grab a coffee! Large batches take time but generate in parallel.'
                : totalMaxTime > 5
                ? 'Perfect time to prepare your video editor or grab a snack.'
                : 'Quick turnaround! You can monitor progress in real-time.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
