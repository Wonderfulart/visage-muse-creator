import { useState } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Layers, 
  Music, 
  Scissors, 
  Volume2,
  Lightbulb,
  ChevronRight,
  Play,
  Upload,
  Settings,
  Crown,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const sections = [
  { id: 'getting-started', title: 'Getting Started', icon: Sparkles },
  { id: 'quick-generate', title: 'Quick Generate', icon: Play },
  { id: 'batch-generation', title: 'Batch Scenes', icon: Layers },
  { id: 'lyrics-sync', title: 'Lyrics Sync', icon: Music },
  { id: 'video-stitching', title: 'Video Stitching', icon: Scissors },
  { id: 'audio-editor', title: 'Audio Editor', icon: Volume2 },
  { id: 'tips', title: 'Tips & Tricks', icon: Lightbulb }
];

export const Guide = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('getting-started');

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-heading font-bold text-foreground">How to Use VeoStudio Pro</h1>
            <p className="text-xs text-muted-foreground">Complete guide to creating AI music videos</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <nav className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                      activeSection === section.id
                        ? "bg-primary/10 text-primary border-l-2 border-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{section.title}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 max-w-3xl space-y-16">
            
            {/* Getting Started */}
            <section id="getting-started" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Getting Started</h2>
              </div>
              
              <div className="prose prose-invert max-w-none">
                <p className="text-muted-foreground text-lg">
                  Welcome to VeoStudio Pro! This guide will help you create professional AI-powered music videos in minutes.
                </p>

                <div className="grid sm:grid-cols-3 gap-4 my-8">
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <span className="font-bold text-primary">1</span>
                    </div>
                    <h4 className="font-semibold mb-2">Sign Up</h4>
                    <p className="text-sm text-muted-foreground">Create a free account to get 3 videos per month</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <span className="font-bold text-primary">2</span>
                    </div>
                    <h4 className="font-semibold mb-2">Write Prompt</h4>
                    <p className="text-sm text-muted-foreground">Describe your video scene or use a template</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <span className="font-bold text-primary">3</span>
                    </div>
                    <h4 className="font-semibold mb-2">Generate</h4>
                    <p className="text-sm text-muted-foreground">Click generate and wait ~90 seconds</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mt-8 mb-4">Subscription Tiers</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge variant="secondary">Free</Badge>
                    <span className="text-sm">3 videos/month, watermarked</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge>Creator Pro</Badge>
                    <span className="text-sm">50 videos/month, batch generation, no watermark</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Badge variant="default" className="bg-primary">Music Video Pro</Badge>
                    <span className="text-sm">150 videos/month, lyrics sync, video stitching</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Generate */}
            <section id="quick-generate" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Play className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Quick Generate</h2>
              </div>
              
              <div className="space-y-6">
                <p className="text-muted-foreground">
                  Quick Generate is the fastest way to create a single video clip. Perfect for testing ideas or creating standalone scenes.
                </p>

                <div className="space-y-4">
                  <StepCard
                    step={1}
                    title="Choose a Template (Optional)"
                    description="Select from 8 pre-made visual styles like Cyberpunk, Dreamy, or Cinematic. Templates auto-fill your prompt with optimized settings."
                    icon={<Settings className="w-4 h-4" />}
                  />
                  <StepCard
                    step={2}
                    title="Upload Reference Image (Optional)"
                    description="Upload a face or character image to maintain consistency across generations. The AI will preserve facial features."
                    icon={<Upload className="w-4 h-4" />}
                  />
                  <StepCard
                    step={3}
                    title="Write Your Prompt"
                    description="Describe what you want to see. Be specific about lighting, camera movement, and atmosphere. Use the 'Enhance with AI' button for better results."
                    icon={<Sparkles className="w-4 h-4" />}
                  />
                  <StepCard
                    step={4}
                    title="Adjust Settings"
                    description="Set duration (5-8 seconds) and aspect ratio (16:9 landscape or 9:16 portrait). Enable 'Preserve Face' if using reference images."
                    icon={<Settings className="w-4 h-4" />}
                  />
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <h4 className="font-semibold text-amber-500 mb-2">💡 Pro Tip</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the Safety Analyzer to check your prompt before generating. It identifies words that might cause failures and suggests alternatives.
                  </p>
                </div>
              </div>
            </section>

            {/* Batch Generation */}
            <section id="batch-generation" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Batch Scenes</h2>
                <Badge variant="secondary">Creator Pro+</Badge>
              </div>
              
              <div className="space-y-6">
                <p className="text-muted-foreground">
                  Create multiple scenes at once for full music videos. Each scene generates in parallel, saving you hours of work.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <h4 className="font-semibold mb-2">Free Tier</h4>
                    <p className="text-sm text-muted-foreground">1 scene at a time</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <h4 className="font-semibold mb-2">Creator Pro</h4>
                    <p className="text-sm text-muted-foreground">Up to 5 scenes per batch</p>
                  </div>
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 sm:col-span-2">
                    <h4 className="font-semibold mb-2">Music Video Pro</h4>
                    <p className="text-sm text-muted-foreground">Unlimited scenes per batch</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mt-8">How to Use</h3>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">1</span>
                    <span className="text-muted-foreground">Click "Add Scene" to create multiple scene cards</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">2</span>
                    <span className="text-muted-foreground">Write a unique prompt for each scene</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">3</span>
                    <span className="text-muted-foreground">Set individual durations (5-8s each)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">4</span>
                    <span className="text-muted-foreground">Click "Generate All" to start batch processing</span>
                  </li>
                </ol>
              </div>
            </section>

            {/* Lyrics Sync */}
            <section id="lyrics-sync" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Music className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Lyrics Sync</h2>
                <Badge className="bg-gradient-to-r from-primary to-purple-500">Exclusive</Badge>
              </div>
              
              <div className="space-y-6">
                <p className="text-muted-foreground">
                  Our exclusive AI analyzes your lyrics and generates perfectly synchronized scenes matching each line's emotion. No other platform has this.
                </p>

                <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20">
                  <h4 className="font-semibold mb-4">How It Works</h4>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Emotion Analysis</p>
                        <p className="text-sm text-muted-foreground">AI detects mood changes: joy, sadness, anger, hope</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Scene Suggestions</p>
                        <p className="text-sm text-muted-foreground">Automatic visual prompts for each lyric section</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Visual Consistency</p>
                        <p className="text-sm text-muted-foreground">Maintains your base style across all scenes</p>
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-semibold">Formatting Tips</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex gap-2">
                    <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-1" />
                    Separate verses with blank lines
                  </li>
                  <li className="flex gap-2">
                    <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-1" />
                    Mark choruses with [Chorus] tags
                  </li>
                  <li className="flex gap-2">
                    <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-1" />
                    Include emotional context in brackets: [angry], [soft]
                  </li>
                </ul>
              </div>
            </section>

            {/* Video Stitching */}
            <section id="video-stitching" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Scissors className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Video Stitching</h2>
                <Badge variant="secondary">New</Badge>
              </div>
              
              <div className="space-y-6">
                <p className="text-muted-foreground">
                  Combine multiple generated videos into a single cohesive music video with transitions and background music.
                </p>

                <div className="space-y-4">
                  <StepCard
                    step={1}
                    title="Select Videos"
                    description="Choose videos from your gallery. Free tier: 3 clips max. Pro: 10 clips. Music Video Pro: 50 clips."
                    icon={<CheckCircle className="w-4 h-4" />}
                  />
                  <StepCard
                    step={2}
                    title="Arrange Timeline"
                    description="Drag and drop to reorder your clips. The total duration is shown automatically."
                    icon={<Layers className="w-4 h-4" />}
                  />
                  <StepCard
                    step={3}
                    title="Add Transitions"
                    description="Choose between None, Fade, Cross Dissolve, or Slide transitions. (Creator Pro+)"
                    icon={<Sparkles className="w-4 h-4" />}
                  />
                  <StepCard
                    step={4}
                    title="Add Background Music"
                    description="Upload an MP3 or WAV file to play over your combined video. (Creator Pro+)"
                    icon={<Music className="w-4 h-4" />}
                  />
                </div>
              </div>
            </section>

            {/* Audio Editor */}
            <section id="audio-editor" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Volume2 className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Audio Editor</h2>
                <Badge variant="secondary">New</Badge>
              </div>
              
              <div className="space-y-6">
                <p className="text-muted-foreground">
                  Trim and split your audio files before using them as background music. Create perfect loops or extract specific sections.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <h4 className="font-semibold mb-2">Supported Formats</h4>
                    <p className="text-sm text-muted-foreground">MP3, WAV, M4A, OGG</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <h4 className="font-semibold mb-2">Max File Size</h4>
                    <p className="text-sm text-muted-foreground">100MB per file</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold">Features</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-1" />
                    Visual waveform display
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-1" />
                    Drag-to-select trim regions
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-1" />
                    Preview before export
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-1" />
                    Export as WAV
                  </li>
                </ul>
              </div>
            </section>

            {/* Tips & Tricks */}
            <section id="tips" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Lightbulb className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Tips & Tricks</h2>
              </div>
              
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-card border border-border">
                  <h4 className="font-semibold mb-2">✨ Prompt Engineering</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Be specific about lighting: "golden hour sunlight", "neon glow", "soft diffused light"</li>
                    <li>• Include camera movement: "slow pan left", "dolly zoom", "steady tracking shot"</li>
                    <li>• Describe atmosphere: "dreamy fog", "rain-soaked streets", "dusty desert wind"</li>
                    <li>• Use the "Enhance with AI" button to improve basic prompts</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border">
                  <h4 className="font-semibold mb-2">🛡️ Avoiding Failures</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Always run Safety Analyzer before generating</li>
                    <li>• Avoid explicit violence or adult content</li>
                    <li>• Don't include real celebrity names or copyrighted characters</li>
                    <li>• Keep prompts focused on one main subject</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border">
                  <h4 className="font-semibold mb-2">🎬 Best Practices</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Use consistent aspect ratios across all scenes</li>
                    <li>• Upload a reference image for character consistency</li>
                    <li>• Start with templates until you learn what works</li>
                    <li>• Generate test clips before committing to full videos</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* CTA */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30 text-center">
              <Crown className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-bold mb-2">Ready to Create?</h3>
              <p className="text-muted-foreground mb-6">
                Start with 3 free videos, no credit card required
              </p>
              <Button onClick={() => navigate('/app')} variant="hero" size="lg">
                Launch VeoStudio Pro
              </Button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

function StepCard({ step, title, description, icon }: { 
  step: number; 
  title: string; 
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 p-4 rounded-xl bg-card border border-border">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted-foreground">Step {step}</span>
        </div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default Guide;
