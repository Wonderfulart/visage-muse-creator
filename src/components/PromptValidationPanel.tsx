import { useMemo } from "react";
import { AlertTriangle, XCircle, CheckCircle, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validatePrompt, getHighlightedSegments, ValidationIssue } from "@/utils/promptValidator";
import { cn } from "@/lib/utils";

interface PromptValidationPanelProps {
  prompt: string;
  onApplyReplacement: (issue: ValidationIssue) => void;
  onApplyAll: () => void;
  compact?: boolean;
}

export function PromptValidationPanel({
  prompt,
  onApplyReplacement,
  onApplyAll,
  compact = false,
}: PromptValidationPanelProps) {
  const validation = useMemo(() => validatePrompt(prompt), [prompt]);
  const segments = useMemo(() => getHighlightedSegments(prompt), [prompt]);
  
  const errors = validation.issues.filter(i => i.severity === 'error');
  const warnings = validation.issues.filter(i => i.severity === 'warning');

  if (validation.issues.length === 0) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-xs text-green-400">
        <CheckCircle className="w-3 h-3" />
        <span>Prompt looks safe</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* Highlighted prompt preview */}
      {!compact && (
        <div className="p-3 rounded-lg bg-secondary/30 border border-border text-sm leading-relaxed">
          {segments.map((segment, i) => (
            <span
              key={i}
              className={cn(
                segment.type === 'error' && "bg-destructive/30 text-destructive px-1 rounded font-medium",
                segment.type === 'warning' && "bg-yellow-500/20 text-yellow-400 px-1 rounded"
              )}
            >
              {segment.text}
            </span>
          ))}
        </div>
      )}

      {/* Issue summary */}
      <div className="flex items-center gap-3 text-xs">
        {errors.length > 0 && (
          <div className="flex items-center gap-1.5 text-destructive">
            <XCircle className="w-3.5 h-3.5" />
            <span>{errors.length} blocked word{errors.length > 1 ? 's' : ''}</span>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex items-center gap-1.5 text-yellow-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{warnings.length} warning{warnings.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Replacement suggestions */}
      <div className={cn("space-y-2", compact && "space-y-1.5")}>
        {validation.issues.slice(0, compact ? 3 : 10).map((issue, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-between gap-2 p-2 rounded-lg text-xs",
              issue.severity === 'error' 
                ? "bg-destructive/10 border border-destructive/30"
                : "bg-yellow-500/10 border border-yellow-500/30"
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {issue.severity === 'error' ? (
                <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
              )}
              <span className="truncate">
                <span className="font-medium text-foreground">"{issue.word}"</span>
                <span className="text-muted-foreground mx-1">→</span>
                <span className="text-primary">"{issue.replacement}"</span>
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onApplyReplacement(issue)}
              className="h-6 px-2 text-[10px] hover:bg-primary/20 hover:text-primary"
            >
              Fix
            </Button>
          </div>
        ))}
        
        {validation.issues.length > (compact ? 3 : 10) && (
          <p className="text-xs text-muted-foreground text-center">
            +{validation.issues.length - (compact ? 3 : 10)} more issues
          </p>
        )}
      </div>

      {/* Fix All button */}
      {errors.length > 0 && (
        <Button
          size="sm"
          onClick={onApplyAll}
          className="w-full h-8 text-xs btn-gradient-primary"
        >
          <Wand2 className="w-3.5 h-3.5 mr-1.5" />
          Fix All ({errors.length} issue{errors.length > 1 ? 's' : ''})
        </Button>
      )}
    </div>
  );
}

// Compact inline indicator component
interface ValidationIndicatorProps {
  prompt: string;
  className?: string;
}

export function ValidationIndicator({ prompt, className }: ValidationIndicatorProps) {
  const validation = useMemo(() => validatePrompt(prompt), [prompt]);
  
  const errors = validation.issues.filter(i => i.severity === 'error').length;
  const warnings = validation.issues.filter(i => i.severity === 'warning').length;

  if (errors === 0 && warnings === 0) {
    return (
      <div className={cn("flex items-center gap-1 text-green-400", className)}>
        <CheckCircle className="w-3 h-3" />
      </div>
    );
  }

  if (errors > 0) {
    return (
      <div className={cn("flex items-center gap-1 text-destructive", className)}>
        <XCircle className="w-3 h-3" />
        <span className="text-[10px] font-medium">{errors}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 text-yellow-400", className)}>
      <AlertTriangle className="w-3 h-3" />
      <span className="text-[10px] font-medium">{warnings}</span>
    </div>
  );
}
