import { Settings, Image, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReferenceImageUpload } from "@/components/ReferenceImageUpload";
import { StoryboardSettings } from "./types";

interface SetupPanelProps {
  settings: StoryboardSettings;
  onSettingsChange: (settings: StoryboardSettings) => void;
  onNext: () => void;
}

export function SetupPanel({ settings, onSettingsChange, onNext }: SetupPanelProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-gradient-primary">
          <Settings className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Visual Setup</h2>
          <p className="text-sm text-muted-foreground">Define your base style and settings</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          {/* Base Visual Style */}
          <div className="card-elevated rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="w-4 h-4 text-primary" />
              <Label className="font-medium">Base Visual Style</Label>
            </div>
            <Textarea
              value={settings.basePrompt}
              onChange={(e) => onSettingsChange({ ...settings, basePrompt: e.target.value })}
              placeholder="Describe your visual style... e.g., 'Cinematic music video with dramatic lighting, artist performing with passionate expression, neon-lit urban environment'"
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              This style will be applied to all scenes. Scene-specific prompts will be auto-generated.
            </p>
          </div>

          {/* Aspect Ratio */}
          <div className="card-elevated rounded-xl p-5">
            <Label className="font-medium mb-3 block">Aspect Ratio</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => onSettingsChange({ ...settings, aspectRatio: ratio })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    settings.aspectRatio === ratio
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-sm font-medium">{ratio}</div>
                  <div className="text-xs text-muted-foreground">
                    {ratio === "16:9" ? "Landscape" : ratio === "9:16" ? "Portrait" : "Square"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Clip Duration */}
          <div className="card-elevated rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <Label className="font-medium">Clip Duration</Label>
              <span className="text-sm font-medium text-primary">{settings.clipDuration}s</span>
            </div>
            <Slider
              value={[settings.clipDuration]}
              onValueChange={([value]) => onSettingsChange({ ...settings, clipDuration: value })}
              min={5}
              max={8}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>5s (more scenes)</span>
              <span>8s (fewer scenes)</span>
            </div>
          </div>

          {/* Face Preservation */}
          <div className="card-elevated rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Face Preservation</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Maintain consistent face across scenes
                </p>
              </div>
              <Switch
                checked={settings.preserveFace}
                onCheckedChange={(checked) => onSettingsChange({ ...settings, preserveFace: checked })}
              />
            </div>
          </div>
        </div>

        {/* Right Column - Reference Image */}
        <div className="space-y-6">
          <div className="card-elevated rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Image className="w-4 h-4 text-primary" />
              <Label className="font-medium">Reference Image (Optional)</Label>
            </div>
            <ReferenceImageUpload
              onImageChange={(img) => onSettingsChange({ ...settings, referenceImage: img })}
              aspectRatio={settings.aspectRatio}
            />
            <p className="text-xs text-muted-foreground mt-3">
              Upload a reference image to maintain visual consistency
            </p>
          </div>
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={onNext}
          disabled={!settings.basePrompt.trim()}
          variant="hero"
          size="lg"
          className="min-w-[200px]"
        >
          Continue to Audio
        </Button>
      </div>
    </div>
  );
}
