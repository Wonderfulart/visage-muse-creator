import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Layers, GripVertical } from 'lucide-react';

interface Scene {
  id: string;
  order: number;
  prompt: string;
  duration: number;
}

interface BatchGenerationPanelProps {
  onScenesChange: (scenes: Scene[]) => void;
  aspectRatio: string;
}

export const BatchGenerationPanel = ({ onScenesChange, aspectRatio }: BatchGenerationPanelProps) => {
  const [scenes, setScenes] = useState<Scene[]>([
    { id: '1', order: 1, prompt: '', duration: 8 }
  ]);

  const addScene = () => {
    const newScene: Scene = {
      id: Date.now().toString(),
      order: scenes.length + 1,
      prompt: '',
      duration: 8
    };
    const updated = [...scenes, newScene];
    setScenes(updated);
    onScenesChange(updated);
  };

  const removeScene = (id: string) => {
    if (scenes.length === 1) return;
    const updated = scenes
      .filter(s => s.id !== id)
      .map((s, idx) => ({ ...s, order: idx + 1 }));
    setScenes(updated);
    onScenesChange(updated);
  };

  const updateScene = (id: string, field: keyof Scene, value: string | number) => {
    const updated = scenes.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    );
    setScenes(updated);
    onScenesChange(updated);
  };

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-semibold text-foreground">Batch Scenes</h3>
        </div>
        <Badge variant="secondary">{scenes.length} scene{scenes.length !== 1 ? 's' : ''}</Badge>
      </div>

      <div className="space-y-4">
        {scenes.map((scene) => (
          <div key={scene.id} className="p-4 rounded-xl bg-secondary/30 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              <span className="text-sm font-medium text-muted-foreground">Scene {scene.order}</span>
              {scenes.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeScene(scene.id)}
                  className="ml-auto h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Textarea
              placeholder="Describe this scene..."
              value={scene.prompt}
              onChange={(e) => updateScene(scene.id, 'prompt', e.target.value)}
              className="min-h-[80px] bg-background"
            />
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={addScene}
        className="w-full mt-4"
        disabled={scenes.length >= 10}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Scene {scenes.length >= 10 && '(Max 10)'}
      </Button>
    </div>
  );
};
