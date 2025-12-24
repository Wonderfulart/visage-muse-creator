import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Copy, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const CONFIG_PASSWORD = "veostudio2024";

const projectConfig = {
  projectSetup: {
    supabaseProjectId: "gqtggvmfrgaxmobrskxr",
    supabaseUrl: "https://gqtggvmfrgaxmobrskxr.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxdGdndm1mcmdheG1vYnJza3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTU4NTcsImV4cCI6MjA4MTMzMTg1N30.wknvYWtE9j8MqxYfQt2fq1tB2Y391XtcdeUcrnAwzy0"
  },
  requiredSecrets: {
    VERTEX_SERVICE_ACCOUNT: {
      description: "Google Cloud Vertex AI service account JSON key",
      format: {
        type: "service_account",
        project_id: "your-google-cloud-project-id",
        private_key_id: "your-private-key-id",
        private_key: "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
        client_email: "your-service-account@your-project.iam.gserviceaccount.com",
        client_id: "your-client-id",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/..."
      },
      requiredRoles: [
        "Vertex AI User",
        "Vertex AI Service Agent", 
        "Storage Object Admin"
      ],
      howToGet: "Google Cloud Console → IAM & Admin → Service Accounts → Create → Download JSON key"
    },
    SYNC_API_KEY: {
      description: "Sync.so API key for lipsync video generation",
      getFrom: "https://sync.so/dashboard",
      howToGet: "Sign up at sync.so → Dashboard → API Keys → Create new key"
    },
    LOVABLE_API_KEY: {
      description: "Auto-configured by Lovable Cloud for AI character analysis",
      note: "Cannot be deleted - managed by Lovable"
    }
  },
  googleCloudSetup: {
    step1_createProject: {
      url: "https://console.cloud.google.com/projectcreate",
      instructions: "Create a new Google Cloud project"
    },
    step2_enableBilling: {
      url: "https://console.developers.google.com/billing/enable",
      instructions: "Enable billing for the project (REQUIRED for Vertex AI)",
      critical: true
    },
    step3_enableAPIs: {
      apis: [
        {
          name: "Vertex AI API",
          url: "https://console.cloud.google.com/apis/library/aiplatform.googleapis.com"
        },
        {
          name: "Cloud Storage API", 
          url: "https://console.cloud.google.com/apis/library/storage.googleapis.com"
        }
      ]
    },
    step4_createServiceAccount: {
      url: "https://console.cloud.google.com/iam-admin/serviceaccounts/create",
      roles: [
        "Vertex AI User",
        "Vertex AI Service Agent",
        "Storage Object Admin"
      ],
      instructions: "Create service account → Add roles → Create key (JSON) → Download"
    },
    step5_oauthConsentScreen: {
      url: "https://console.cloud.google.com/apis/credentials/consent",
      authorizedJavaScriptOrigins: [
        "https://YOUR_SUPABASE_PROJECT_ID.supabase.co"
      ],
      authorizedRedirectURIs: [
        "https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback"
      ]
    }
  },
  edgeFunctions: [
    {
      name: "generate-video",
      purpose: "Generate videos using Google Vertex AI Veo 3.1",
      secretsUsed: ["VERTEX_SERVICE_ACCOUNT"],
      endpoint: "/functions/v1/generate-video"
    },
    {
      name: "check-video-status",
      purpose: "Poll Vertex AI for video generation status",
      secretsUsed: ["VERTEX_SERVICE_ACCOUNT"],
      endpoint: "/functions/v1/check-video-status"
    },
    {
      name: "generate-image-lipsync",
      purpose: "Full pipeline: Image → Veo video → Sync.so lipsync",
      secretsUsed: ["VERTEX_SERVICE_ACCOUNT", "SYNC_API_KEY"],
      endpoint: "/functions/v1/generate-image-lipsync"
    },
    {
      name: "generate-lipsync-syncso",
      purpose: "Direct Sync.so lipsync generation",
      secretsUsed: ["SYNC_API_KEY"],
      endpoint: "/functions/v1/generate-lipsync-syncso"
    },
    {
      name: "music-video-orchestrator",
      purpose: "Orchestrate full music video generation pipeline",
      secretsUsed: ["VERTEX_SERVICE_ACCOUNT", "SYNC_API_KEY"],
      endpoint: "/functions/v1/music-video-orchestrator"
    },
    {
      name: "generate-batch-videos",
      purpose: "Generate multiple videos in batch",
      secretsUsed: ["VERTEX_SERVICE_ACCOUNT"],
      endpoint: "/functions/v1/generate-batch-videos"
    },
    {
      name: "analyze-character",
      purpose: "AI character analysis using Lovable AI",
      secretsUsed: ["LOVABLE_API_KEY"],
      endpoint: "/functions/v1/analyze-character"
    },
    {
      name: "enhance-prompt",
      purpose: "AI prompt enhancement",
      secretsUsed: ["LOVABLE_API_KEY"],
      endpoint: "/functions/v1/enhance-prompt"
    },
    {
      name: "generate-scene-prompts",
      purpose: "Generate scene prompts from lyrics",
      secretsUsed: ["LOVABLE_API_KEY"],
      endpoint: "/functions/v1/generate-scene-prompts"
    },
    {
      name: "merge-audio-video",
      purpose: "Merge audio with video files",
      secretsUsed: [],
      endpoint: "/functions/v1/merge-audio-video"
    },
    {
      name: "create-checkout",
      purpose: "Stripe checkout session creation",
      secretsUsed: ["STRIPE_SECRET_KEY"],
      endpoint: "/functions/v1/create-checkout"
    },
    {
      name: "check-subscription",
      purpose: "Check user subscription status",
      secretsUsed: ["STRIPE_SECRET_KEY"],
      endpoint: "/functions/v1/check-subscription"
    },
    {
      name: "customer-portal",
      purpose: "Stripe customer portal access",
      secretsUsed: ["STRIPE_SECRET_KEY"],
      endpoint: "/functions/v1/customer-portal"
    }
  ],
  features: {
    simpleMode: {
      name: "Simple Music Video",
      route: "/simple-music-video",
      description: "Upload a character image and audio to generate a lipsync music video",
      flow: [
        "1. Upload character image (face photo)",
        "2. Upload audio file (MP3/WAV)",
        "3. Optionally add lyrics for scene prompts",
        "4. System generates video segments using Veo 3.1",
        "5. Sync.so adds lipsync to match audio",
        "6. Final video is stitched together"
      ],
      apiFlow: "Character Image → Veo 3.1 (video) → Sync.so (lipsync) → Final Video"
    },
    lightningMode: {
      name: "Lightning Mode",
      route: "/lightning",
      description: "Quick video generation with AI-powered prompts",
      flow: [
        "1. Enter text prompts for each scene",
        "2. Upload reference image for character consistency",
        "3. System generates multiple video clips",
        "4. Preview and download clips"
      ],
      apiFlow: "Prompts + Reference → Veo 3.1 → Video Clips"
    },
    storyboardEditor: {
      name: "Storyboard Editor",
      route: "/app",
      description: "Full storyboard editing with timeline",
      features: [
        "Timeline-based scene editing",
        "Audio waveform visualization",
        "Beat detection for sync points",
        "Batch video generation"
      ]
    }
  },
  databaseTables: [
    "profiles - User profiles with subscription info",
    "videos - Generated video records",
    "music_video_jobs - Music video generation jobs",
    "video_segments - Individual video segments",
    "lipsync_videos - Lipsync video records",
    "lipsync_segments - Lipsync segment tracking",
    "stitched_videos - Stitched video outputs",
    "stripe_customers - Stripe customer mapping",
    "user_roles - User role assignments"
  ],
  setupChecklist: [
    "☐ Create Google Cloud project",
    "☐ Enable billing on Google Cloud project",
    "☐ Enable Vertex AI API",
    "☐ Enable Cloud Storage API",
    "☐ Create service account with required roles",
    "☐ Download service account JSON key",
    "☐ Add VERTEX_SERVICE_ACCOUNT secret in Lovable",
    "☐ Create Sync.so account",
    "☐ Get Sync.so API key",
    "☐ Add SYNC_API_KEY secret in Lovable",
    "☐ Test video generation"
  ]
};

export default function SetupConfig() {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleUnlock = () => {
    if (password === CONFIG_PASSWORD) {
      setIsUnlocked(true);
      toast.success("Configuration unlocked!");
    } else {
      toast.error("Incorrect password");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(projectConfig, null, 2));
      setCopied(true);
      toast.success("Configuration copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUnlock();
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Project Configuration</CardTitle>
            <p className="text-muted-foreground text-sm mt-2">
              Enter password to view project setup details
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button onClick={handleUnlock} className="w-full">
              Unlock Configuration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Project Configuration</h1>
            <p className="text-muted-foreground">
              Copy this JSON to set up a new project with the same configuration
            </p>
          </div>
          <Button onClick={handleCopy} className="gap-2">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy JSON"}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <pre className="p-4 overflow-auto max-h-[70vh] text-sm bg-muted/50 rounded-lg">
              <code className="text-foreground">
                {JSON.stringify(projectConfig, null, 2)}
              </code>
            </pre>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Setup Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {projectConfig.setupChecklist.map((item, i) => (
                  <li key={i} className="text-muted-foreground">{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Required Secrets</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li>
                  <span className="font-mono font-medium">VERTEX_SERVICE_ACCOUNT</span>
                  <p className="text-muted-foreground">Google Cloud service account JSON</p>
                </li>
                <li>
                  <span className="font-mono font-medium">SYNC_API_KEY</span>
                  <p className="text-muted-foreground">Sync.so API key for lipsync</p>
                </li>
                <li>
                  <span className="font-mono font-medium">LOVABLE_API_KEY</span>
                  <p className="text-muted-foreground">Auto-configured by Lovable</p>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
