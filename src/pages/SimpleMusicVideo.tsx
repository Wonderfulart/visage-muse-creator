import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Music, Image, Loader2, CheckCircle, Download, RotateCcw, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";

type Step = 1 | 2 | 3 | 4;

const SimpleMusicVideo = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  
  // Audio state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // Handle audio upload
  const handleAudioUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a)$/i)) {
      toast.error("Please upload an MP3, WAV, or M4A file");
      return;
    }

    // Get audio duration
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      setAudioDuration(audio.duration);
      // Calculate estimated cost (~$0.40 per 8 seconds)
      const segments = Math.ceil(audio.duration / 8);
      setEstimatedCost(segments * 0.40);
      URL.revokeObjectURL(audio.src);
    };

    setAudioFile(file);
    toast.success(`${file.name} uploaded`);
  }, []);

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Create preview
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setImageFile(file);
    toast.success(`${file.name} uploaded`);
  }, [imagePreview]);

  // Upload file to Supabase storage
  const uploadToStorage = async (file: File, bucket: string, path: string): Promise<string> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not authenticated");

    const filePath = `${userData.user.id}/${path}`;
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  // Start generation
  const handleGenerate = async () => {
    if (!audioFile || !imageFile) {
      toast.error("Please upload both audio and image");
      return;
    }

    setIsGenerating(true);
    setStep(3);
    setProgress(5);
    setStatusMessage("Uploading your files...");

    try {
      // Upload audio
      setProgress(10);
      setStatusMessage("Uploading music file...");
      const uploadedAudioUrl = await uploadToStorage(
        audioFile, 
        'background-music', 
        `lipsync-${Date.now()}.${audioFile.name.split('.').pop()}`
      );
      setAudioUrl(uploadedAudioUrl);
      
      // Upload image
      setProgress(20);
      setStatusMessage("Uploading photo...");
      const uploadedImageUrl = await uploadToStorage(
        imageFile, 
        'videos', 
        `lipsync-character-${Date.now()}.${imageFile.name.split('.').pop()}`
      );
      setImageUrl(uploadedImageUrl);

      // Start lip-sync generation
      setProgress(30);
      setStatusMessage("Starting video generation...");
      
      const { data, error } = await supabase.functions.invoke('generate-lipsync-syncso', {
        body: {
          characterImageUrl: uploadedImageUrl,
          audioUrl: uploadedAudioUrl,
          model: 'lipsync-2'
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to start generation');

      setJobId(data.jobId);
      setStatusMessage("Making person sing your song...");
      setProgress(40);

      // Start polling
      pollingRef.current = setInterval(() => {
        pollStatus(data.jobId);
      }, 5000);

    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate video');
      setIsGenerating(false);
      setStep(2);
    }
  };

  // Poll for status
  const pollStatus = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-lipsync-syncso?action=status', {
        body: { jobId: id }
      });

      if (error) throw error;

      if (data.status === 'completed' && data.outputUrl) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setProgress(100);
        setOutputVideoUrl(data.outputUrl);
        setStatusMessage("Your video is ready!");
        setStep(4);
        setIsGenerating(false);
        toast.success("Video generated successfully!");
      } else if (data.status === 'failed') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        throw new Error(data.error || 'Video generation failed');
      } else {
        // Still processing - increment progress
        setProgress(prev => Math.min(prev + 5, 90));
        const elapsed = Math.floor((Date.now() % 60000) / 1000);
        setStatusMessage(`Making person sing... (${elapsed}s)`);
      }
    } catch (error) {
      console.error('Polling error:', error);
      if (pollingRef.current) clearInterval(pollingRef.current);
      toast.error(error instanceof Error ? error.message : 'Failed to check status');
      setIsGenerating(false);
      setStep(2);
    }
  };

  // Reset to start over
  const handleReset = () => {
    setStep(1);
    setAudioFile(null);
    setAudioDuration(null);
    setAudioUrl(null);
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    setIsGenerating(false);
    setProgress(0);
    setStatusMessage("");
    setJobId(null);
    setOutputVideoUrl(null);
    setEstimatedCost(0);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Simple Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Studio</span>
          </Link>
          <h1 className="font-heading font-bold text-xl text-gray-900">Simple Music Video</h1>
          <div className="w-32" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          
          {/* Step 1: Upload Music */}
          {step === 1 && (
            <div className="text-center space-y-8 animate-fade-in">
              <div>
                <h2 className="font-heading text-3xl font-bold text-gray-900 mb-2">
                  Step 1: Upload Your Music
                </h2>
                <p className="text-lg text-gray-600">
                  Choose the song you want your character to sing
                </p>
              </div>

              <div
                onClick={() => audioInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-16 cursor-pointer transition-all
                  ${audioFile 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                  }
                `}
              >
                <input
                  ref={audioInputRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
                
                {audioFile ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-green-500 mx-auto flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-gray-900">{audioFile.name}</p>
                      {audioDuration && (
                        <p className="text-gray-600">Duration: {formatDuration(audioDuration)}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-20 h-20 rounded-full bg-purple-100 mx-auto flex items-center justify-center">
                      <Music className="w-10 h-10 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-gray-900">Click to Upload Music File</p>
                      <p className="text-gray-500">MP3, WAV, or M4A supported</p>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!audioFile}
                className="h-14 px-8 text-lg font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                Next: Choose Your Character
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Upload Photo */}
          {step === 2 && (
            <div className="text-center space-y-8 animate-fade-in">
              <div>
                <h2 className="font-heading text-3xl font-bold text-gray-900 mb-2">
                  Step 2: Upload a Photo
                </h2>
                <p className="text-lg text-gray-600">
                  This person will sing your song
                </p>
              </div>

              <div
                onClick={() => imageInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-16 cursor-pointer transition-all
                  ${imageFile 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                  }
                `}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                {imagePreview ? (
                  <div className="space-y-4">
                    <img 
                      src={imagePreview} 
                      alt="Character preview" 
                      className="w-48 h-48 object-cover rounded-xl mx-auto border-4 border-white shadow-lg"
                    />
                    <p className="text-lg font-semibold text-gray-900">{imageFile?.name}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-20 h-20 rounded-full bg-purple-100 mx-auto flex items-center justify-center">
                      <Image className="w-10 h-10 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-gray-900">Click to Upload Photo</p>
                      <p className="text-gray-500">Clear face photo recommended</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Cost estimate */}
              {estimatedCost > 0 && (
                <div className="bg-gray-100 rounded-xl p-4">
                  <p className="text-gray-600">
                    Estimated cost: <span className="font-bold text-gray-900">${estimatedCost.toFixed(2)}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="h-14 px-8 text-lg font-semibold"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!imageFile}
                  className="h-14 px-8 text-lg font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                >
                  Create My Video
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Generating */}
          {step === 3 && (
            <div className="text-center space-y-8 animate-fade-in">
              <div>
                <h2 className="font-heading text-3xl font-bold text-gray-900 mb-2">
                  Creating Your Music Video...
                </h2>
                <p className="text-lg text-gray-600">
                  This usually takes 1-3 minutes
                </p>
              </div>

              <div className="space-y-6 py-8">
                <div className="w-24 h-24 rounded-full bg-purple-100 mx-auto flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                </div>

                <Progress value={progress} className="h-3 max-w-md mx-auto" />
                
                <p className="text-xl font-medium text-gray-700">{statusMessage}</p>

                {/* Progress steps */}
                <div className="space-y-3 max-w-sm mx-auto text-left">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-600">Music uploaded</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-600">Photo uploaded</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {progress >= 90 ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                    )}
                    <span className="text-gray-600">Making person sing</span>
                  </div>
                </div>
              </div>

              {estimatedCost > 0 && (
                <p className="text-gray-500">
                  Estimated cost: ${estimatedCost.toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && outputVideoUrl && (
            <div className="text-center space-y-8 animate-fade-in">
              <div>
                <h2 className="font-heading text-3xl font-bold text-gray-900 mb-2">
                  🎉 Your Video is Ready!
                </h2>
                <p className="text-lg text-gray-600">
                  Download and share your music video
                </p>
              </div>

              <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200">
                <video
                  src={outputVideoUrl}
                  controls
                  autoPlay
                  className="w-full aspect-video bg-black"
                />
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = outputVideoUrl;
                    link.download = `lipsync-video-${Date.now()}.mp4`;
                    link.click();
                  }}
                  className="h-14 px-8 text-lg font-semibold bg-purple-600 hover:bg-purple-700"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download My Video
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="h-14 px-8 text-lg font-semibold"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Make Another Video
                </Button>
              </div>

              {estimatedCost > 0 && (
                <p className="text-gray-500">
                  Cost: ${estimatedCost.toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SimpleMusicVideo;
