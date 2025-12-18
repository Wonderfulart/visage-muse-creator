import { BookOpen, CheckCircle, XCircle, Lightbulb, Sparkles, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const PromptGuide = () => {
  const dos = [
    { title: 'Describe lighting', example: 'soft dramatic lighting with rim light', why: 'Lighting dramatically affects mood' },
    { title: 'Specify camera movement', example: 'slow camera push in, shallow depth of field', why: 'Guides composition and focus' },
    { title: 'Set the mood', example: 'ethereal dreamy atmosphere, melancholic vibe', why: 'Ensures emotional consistency' },
    { title: 'Be specific about style', example: 'cinematic music video, 80s aesthetic', why: 'Creates coherent visual language' },
    { title: 'Describe environment', example: 'neon-lit city street at night', why: 'Establishes clear setting' },
    { title: 'Use color palette', example: 'warm orange and teal color grading', why: 'Defines visual tone' }
  ];

  const donts = [
    { title: 'Named celebrities', example: '❌ "Taylor Swift" ✓ "Female pop star"', why: 'Copyright issues' },
    { title: 'Copyrighted characters', example: '❌ "Spider-Man" ✓ "Superhero in red suit"', why: 'Trademark infringement' },
    { title: 'Brand logos', example: '❌ "Nike swoosh" ✓ "Athletic style"', why: 'Commercial trademark' },
    { title: 'Violent content', example: '❌ "Blood and gore" ✓ "Dramatic action"', why: 'Policy violations' },
    { title: 'AI watermarks', example: '❌ "Midjourney style" ✓ "Digital art"', why: 'Platform issues' }
  ];

  const proTips = [
    { icon: '🎬', tip: 'Use cinematic terminology', detail: '"bokeh", "anamorphic", "film grain" trigger quality' },
    { icon: '🎨', tip: 'Reference art movements', detail: '"impressionist", "art nouveau", "retrofuturism"' },
    { icon: '⚡', tip: 'Shorter prompts for speed', detail: '50-100 words is the sweet spot' },
    { icon: '🌈', tip: 'Layer 2-3 styles max', detail: '"cyberpunk noir with 80s aesthetics"' },
    { icon: '📸', tip: 'Think like a cinematographer', detail: 'Describe angles, movements, focus' }
  ];

  const templates = [
    { name: 'Dreamy Pop', prompt: 'Ethereal dreamy atmosphere, soft pastel colors, floating particles, gentle camera drift, shallow depth of field, female vocalist in flowing white dress, golden hour lighting with lens flares, music video aesthetic' },
    { name: 'Urban Hip-Hop', prompt: 'Gritty urban street scene at night, neon signs reflecting on wet pavement, dramatic rim lighting, slow motion camera circle, male rapper in streetwear, orange and teal grading' },
    { name: 'Cyberpunk Electronic', prompt: 'Futuristic cyberpunk cityscape, neon purple and blue lighting, holographic effects, camera push through crowds, electronic music aesthetic, rain effects with glowing reflections' },
    { name: 'Indie Acoustic', prompt: 'Intimate bedroom studio setup, warm tungsten lighting, shallow depth of field on acoustic guitar, soft shadows, handheld camera feel, film grain texture' }
  ];

  const copyTemplate = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Template copied!');
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Prompt Writing Guide
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="dos" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dos" className="gap-1 text-xs">
              <CheckCircle className="w-3 h-3" />
              Do's
            </TabsTrigger>
            <TabsTrigger value="donts" className="gap-1 text-xs">
              <XCircle className="w-3 h-3" />
              Don'ts
            </TabsTrigger>
            <TabsTrigger value="tips" className="gap-1 text-xs">
              <Lightbulb className="w-3 h-3" />
              Tips
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1 text-xs">
              <Sparkles className="w-3 h-3" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dos" className="mt-4 space-y-3 max-h-[300px] overflow-y-auto">
            {dos.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-rainbow-green/5 border border-rainbow-green/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-rainbow-green" />
                  <span className="font-medium text-sm text-foreground">{item.title}</span>
                </div>
                <p className="text-xs text-primary pl-6 mb-1">"{item.example}"</p>
                <p className="text-xs text-muted-foreground pl-6">💡 {item.why}</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="donts" className="mt-4 space-y-3 max-h-[300px] overflow-y-auto">
            {donts.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <span className="font-medium text-sm text-foreground">{item.title}</span>
                </div>
                <p className="text-xs pl-6 mb-1">{item.example}</p>
                <p className="text-xs text-muted-foreground pl-6">⚠️ {item.why}</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="tips" className="mt-4 space-y-3 max-h-[300px] overflow-y-auto">
            {proTips.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <span>{item.icon}</span>
                  <span className="font-medium text-sm text-foreground">{item.tip}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">{item.detail}</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="templates" className="mt-4 space-y-3 max-h-[300px] overflow-y-auto">
            <Alert className="bg-primary/10 border-primary/20 mb-3">
              <AlertDescription className="text-xs">
                Copy these proven templates and customize them
              </AlertDescription>
            </Alert>
            {templates.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-secondary/30 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary">{item.name}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => copyTemplate(item.prompt)}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{item.prompt}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
