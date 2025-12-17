import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Film, Waves, Zap, Sun, Moon, Cloud, Flame } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  sceneDescription: string;
  duration: number;
  aspectRatio: string;
  icon: React.ReactNode;
  color: string;
}

interface TemplateSelectorProps {
  onSelectTemplate: (template: Template) => void;
  selectedTemplateId: string | null;
}

const templates: Template[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    sceneDescription: 'Neon-lit futuristic cityscape with rain, holographic billboards, and cyberpunk aesthetics. Dark moody atmosphere with vibrant purple and cyan lighting.',
    duration: 8,
    aspectRatio: '16:9',
    icon: <Zap className="w-4 h-4" />,
    color: 'from-purple-500 to-cyan-500'
  },
  {
    id: 'dreamy',
    name: 'Dreamy',
    sceneDescription: 'Soft ethereal atmosphere with floating particles, gentle light rays, and pastel colors. Dreamlike quality with slow graceful movements.',
    duration: 8,
    aspectRatio: '16:9',
    icon: <Cloud className="w-4 h-4" />,
    color: 'from-pink-400 to-purple-400'
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    sceneDescription: 'Professional film-quality scene with dramatic lighting, shallow depth of field, and cinematic color grading. Epic and emotional atmosphere.',
    duration: 8,
    aspectRatio: '16:9',
    icon: <Film className="w-4 h-4" />,
    color: 'from-amber-500 to-orange-600'
  },
  {
    id: 'nature',
    name: 'Nature',
    sceneDescription: 'Beautiful natural landscape with golden hour lighting, lush vegetation, and serene atmosphere. Organic textures and warm earth tones.',
    duration: 8,
    aspectRatio: '16:9',
    icon: <Sun className="w-4 h-4" />,
    color: 'from-green-500 to-emerald-600'
  },
  {
    id: 'dark',
    name: 'Dark & Moody',
    sceneDescription: 'High contrast dark scene with dramatic shadows, rim lighting, and mysterious atmosphere. Deep blacks and selective highlights.',
    duration: 8,
    aspectRatio: '16:9',
    icon: <Moon className="w-4 h-4" />,
    color: 'from-slate-600 to-slate-900'
  },
  {
    id: 'ocean',
    name: 'Ocean Vibes',
    sceneDescription: 'Calming ocean scene with gentle waves, underwater light rays, and aquatic colors. Peaceful and flowing movement throughout.',
    duration: 8,
    aspectRatio: '16:9',
    icon: <Waves className="w-4 h-4" />,
    color: 'from-blue-400 to-teal-500'
  },
  {
    id: 'abstract',
    name: 'Abstract',
    sceneDescription: 'Artistic abstract visuals with geometric shapes, color gradients, and fluid motion. Modern and visually striking composition.',
    duration: 8,
    aspectRatio: '16:9',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'from-violet-500 to-fuchsia-500'
  },
  {
    id: 'fire',
    name: 'Fire & Energy',
    sceneDescription: 'Intense scene with fire elements, sparks, and warm orange lighting. High energy and dynamic movement with dramatic flames.',
    duration: 8,
    aspectRatio: '16:9',
    icon: <Flame className="w-4 h-4" />,
    color: 'from-red-500 to-orange-500'
  }
];

export const TemplateSelector = ({ onSelectTemplate, selectedTemplateId }: TemplateSelectorProps) => {
  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-foreground">Visual Templates</h3>
        <Badge variant="secondary">8 styles</Badge>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className={`p-3 rounded-xl border transition-all duration-200 text-left ${
              selectedTemplateId === template.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 bg-card'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${template.color} flex items-center justify-center text-white mb-2`}>
              {template.icon}
            </div>
            <p className="text-sm font-medium text-foreground">{template.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
