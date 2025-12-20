import { useState, useCallback } from "react";
import { Settings, Music, Clock, Wand2, Check, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SetupPanel } from "./SetupPanel";
import { AudioUploadPanel } from "./AudioUploadPanel";
import { TimelinePanel } from "./TimelinePanel";
import { GenerationPanel } from "./GenerationPanel";
import { Scene, StoryboardSettings, StoryboardStep } from "./types";
import { AudioSegment } from "@/utils/audioSplitter";
import { Button } from "@/components/ui/button";

interface StoryboardEditorProps {
  onComplete?: () => void;
}

const STEPS: { id: StoryboardStep; label: string; icon: React.ElementType }[] = [
  { id: "setup", label: "Setup", icon: Settings },
  { id: "audio", label: "Audio", icon: Music },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "generate", label: "Generate", icon: Wand2 },
];

/**
 * Generate fallback prompts based on base style and segment position (used when AI fails)
 */
function generateFallbackPrompts(
  basePrompt: string,
  segments: AudioSegment[]
): string[] {
  const moods = [
    "with intense energy and dynamic movement",
    "with emotional depth and cinematic lighting",
    "with vibrant colors and fluid motion",
    "building dramatic tension",
    "with powerful visual storytelling",
    "in an atmospheric, moody setting",
    "with striking visual contrast",
    "capturing raw emotion and expression",
    "with sweeping camera movements",
    "in a climactic, powerful moment",
  ];

  return segments.map((segment, i) => {
    const mood = moods[i % moods.length];
    const avgEnergy = segment.waveformData.reduce((a, b) => a + b, 0) / segment.waveformData.length;
    const energyDesc = avgEnergy > 0.5 ? "high energy" : avgEnergy > 0.3 ? "moderate energy" : "calm";
    return `${basePrompt}, ${mood}, ${energyDesc} section`;
  });
}

export function StoryboardEditor({ onComplete }: StoryboardEditorProps) {
  const [currentStep, setCurrentStep] = useState<StoryboardStep>("setup");
  const [settings, setSettings] = useState<StoryboardSettings>({
    basePrompt: "",
    referenceImage: null,
    aspectRatio: "16:9",
    clipDuration: 8,
    preserveFace: true,
  });
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [fullWaveform, setFullWaveform] = useState<number[]>([]);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  /**
   * Generate AI-powered prompts for all scenes
   */
  const generateAIPrompts = useCallback(async (currentScenes: Scene[]) => {
    if (!settings.basePrompt || currentScenes.length === 0) return;

    setIsGeneratingPrompts(true);
    try {
      const sceneData = currentScenes.map(scene => {
        const avgEnergy = scene.audioSegment?.waveformData 
          ? scene.audioSegment.waveformData.reduce((a, b) => a + b, 0) / scene.audioSegment.waveformData.length
          : 0.5;
        
        return {
          index: scene.index,
          startTime: scene.startTime,
          endTime: scene.endTime,
          duration: scene.duration,
          energyLevel: avgEnergy,
          tempo: avgEnergy > 0.6 ? "fast" : avgEnergy > 0.35 ? "medium" : "slow"
        };
      });

      const { data, error } = await supabase.functions.invoke('generate-scene-prompts', {
        body: {
          basePrompt: settings.basePrompt,
          scenes: sceneData,
          aspectRatio: settings.aspectRatio,
          preserveFace: settings.preserveFace
        }
      });

      if (error) throw error;

      if (data?.success && data?.prompts) {
        setScenes(prev => prev.map(scene => {
          const aiPrompt = data.prompts.find((p: { index: number; prompt: string }) => p.index === scene.index);
          return aiPrompt ? { ...scene, prompt: aiPrompt.prompt } : scene;
        }));
        toast.success("AI prompts generated!");
      } else {
        throw new Error(data?.error || "Failed to generate prompts");
      }
    } catch (err) {
      console.error("AI prompt generation failed:", err);
      toast.error("AI prompts failed, using fallback prompts");
    } finally {
      setIsGeneratingPrompts(false);
    }
  }, [settings.basePrompt, settings.aspectRatio, settings.preserveFace]);

  const handleAudioProcessed = useCallback(
    (segments: AudioSegment[], waveform: number[], duration: number, file: File) => {
      setFullWaveform(waveform);
      setAudioDuration(duration);
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));

      // Generate fallback prompts first
      const fallbackPrompts = generateFallbackPrompts(settings.basePrompt, segments);

      // Create scenes from segments
      const newScenes: Scene[] = segments.map((segment, i) => ({
        id: segment.id,
        index: i,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration,
        prompt: fallbackPrompts[i],
        audioSegment: segment,
        status: "pending",
        selected: i < 10,
      }));

      setScenes(newScenes);
      
      // Then trigger AI prompt generation in background
      generateAIPrompts(newScenes);
    },
    [settings.basePrompt, generateAIPrompts]
  );

  const goToStep = (step: StoryboardStep) => {
    setCurrentStep(step);
  };

  const handleComplete = () => {
    toast.success("Storyboard complete! Check your gallery for videos.");
    onComplete?.();
  };

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = i < currentStepIndex;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => {
                    if (isCompleted) goToStep(step.id);
                  }}
                  disabled={!isCompleted && !isActive}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                </button>

                {i < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${
                      isCompleted ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Prompt Generation Status */}
      {isGeneratingPrompts && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Generating AI prompts for scenes...</span>
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-[500px]">
        {currentStep === "setup" && (
          <SetupPanel
            settings={settings}
            onSettingsChange={setSettings}
            onNext={() => goToStep("audio")}
          />
        )}

        {currentStep === "audio" && (
          <AudioUploadPanel
            clipDuration={settings.clipDuration}
            onAudioProcessed={handleAudioProcessed}
            onNext={() => goToStep("timeline")}
            onBack={() => goToStep("setup")}
          />
        )}

        {currentStep === "timeline" && (
          <TimelinePanel
            scenes={scenes}
            fullWaveform={fullWaveform}
            audioDuration={audioDuration}
            audioUrl={audioUrl}
            onScenesChange={setScenes}
            onNext={() => goToStep("generate")}
            onBack={() => goToStep("audio")}
            onRegeneratePrompts={() => generateAIPrompts(scenes)}
            isGeneratingPrompts={isGeneratingPrompts}
          />
        )}

        {currentStep === "generate" && (
          <GenerationPanel
            scenes={scenes}
            settings={settings}
            audioUrl={audioUrl}
            onScenesChange={setScenes}
            onBack={() => goToStep("timeline")}
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  );
}

export default StoryboardEditor;
