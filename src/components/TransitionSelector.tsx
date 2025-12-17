import { cn } from '@/lib/utils';

const transitions = [
  { 
    id: 'none', 
    name: 'None', 
    description: 'Hard cut between clips',
    preview: '⬜➡️⬛'
  },
  { 
    id: 'fade', 
    name: 'Fade', 
    description: 'Smooth fade to black',
    preview: '⬜🌫️⬛'
  },
  { 
    id: 'crossfade', 
    name: 'Cross Dissolve', 
    description: 'Blend between clips',
    preview: '⬜✨⬛'
  },
  { 
    id: 'slide', 
    name: 'Slide', 
    description: 'Slide transition',
    preview: '⬜▶️⬛'
  }
];

interface TransitionSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const TransitionSelector = ({ value, onChange, disabled }: TransitionSelectorProps) => {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Transition Effect</label>
      
      <div className="grid grid-cols-2 gap-2">
        {transitions.map((transition) => (
          <button
            key={transition.id}
            onClick={() => onChange(transition.id)}
            disabled={disabled}
            className={cn(
              "p-3 rounded-lg border text-left transition-all",
              value === transition.id
                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                : "border-border hover:border-primary/50 bg-card",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="text-lg mb-1">{transition.preview}</div>
            <p className="text-sm font-medium">{transition.name}</p>
            <p className="text-xs text-muted-foreground">{transition.description}</p>
          </button>
        ))}
      </div>
      
      {disabled && (
        <p className="text-xs text-muted-foreground">
          Upgrade to Creator Pro for transition effects
        </p>
      )}
    </div>
  );
};
