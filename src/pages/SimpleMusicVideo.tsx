import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Music, Image, Video, Loader2, CheckCircle, Download, RotateCcw, ArrowRight, ArrowLeft, Clock, MoveLeft, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { splitAudio, AudioSegment, formatTime } from "@/utils/audioSplitter";

type Step = 1 | 2 | 3 | 4;
type MediaType = 'image' | 'video' | null;

interface GeneratedClip {
  id: string;
  segmentIndex: number;
  outputUrl: string;
  startTime: number;
  endTime: number;
}

const SimpleMusicVideo = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  
  // Audio state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  
  // Media state (photo or video)
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | null>(null);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  
  // Generated clips
  const [generatedClips, setGeneratedClips] = useState<GeneratedClip[]>([]);
  const [clipOrder, setClipOrder] = useState<number[]>([]);
  
  // Database record
  const [videoRecordId, setVideoRecordId] = useState<string | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  // Handle audio upload with splitting
  const handleAudioUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a)$/i)) {
      toast.error("Please upload an MP3, WAV, or M4A file");
      return;
    }

    setAudioFile(file);
    toast.success(`${file.name} uploaded`);

    // Get audio duration first
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    
    audio.onloadedmetadata = async () => {
      const duration = audio.duration;
      setAudioDuration(duration);
      URL.revokeObjectURL(audio.src);

      // Split audio if longer than 8 seconds
      if (duration > 8) {
        setStatusMessage("Splitting audio into segments...");
        try {
          const result = await splitAudio(file, 8, (splitProgress) => {
            setStatusMessage(`Splitting audio... ${splitProgress.toFixed(0)}%`);
          });
          setAudioSegments(result.segments);
          setEstimatedCost(result.segments.length * 0.40);
          setStatusMessage("");
          toast.success(`Audio split into ${result.segments.length} segments`);
        } catch (error) {
          console.error('Split error:', error);
          toast.error("Failed to split audio");
        }
      } else {
        // Single segment for short audio
        setAudioSegments([{
          id: 'segment-1',
          index: 0,
          startTime: 0,
          endTime: duration,
          duration: duration,
          audioBlob: file,
          waveformData: []
        }]);
        setEstimatedCost(0.40);
      }
    };
  }, []);

  // Handle media upload (photo or video)
  const handleMediaUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast.error("Please upload an image or video file");
      return;
    }

    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    const preview = URL.createObjectURL(file);
    setMediaPreview(preview);
    setMediaFile(file);
    setMediaType(isImage ? 'image' : 'video');
    toast.success(`${file.name} uploaded (${isImage ? 'Photo' : 'Video'})`);
  }, [mediaPreview]);

  // Upload file to Supabase storage
  const uploadToStorage = async (file: File | Blob, bucket: string, path: string): Promise<string> => {
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

  // Start generation for all segments
  const handleGenerate = async () => {
    if (!audioFile || !mediaFile || audioSegments.length === 0) {
      toast.error("Please upload both audio and a photo/video");
      return;
    }

    setIsGenerating(true);
    setStep(3);
    setProgress(5);
    setGeneratedClips([]);
    setCurrentSegmentIndex(0);

    // Determine which model to use based on media type
    const selectedModel = mediaType === 'video' ? 'lipsync-2' : 'lipsync-1.9.0-beta';

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Upload character media first
      setStatusMessage(`Uploading ${mediaType === 'video' ? 'video' : 'photo'}...`);
      setProgress(10);
      const mediaUrl = await uploadToStorage(
        mediaFile,
        'videos',
        `lipsync-character-${Date.now()}.${mediaFile.name.split('.').pop()}`
      );
      setUploadedMediaUrl(mediaUrl);

      // Create database record for this video
      const { data: videoRecord, error: videoError } = await supabase
        .from('lipsync_videos')
        .insert({
          user_id: userData.user.id,
          title: audioFile.name.replace(/\.[^/.]+$/, ''),
          character_image_url: mediaUrl,
          status: 'processing',
          total_segments: audioSegments.length,
          completed_segments: 0,
          total_cost: estimatedCost
        })
        .select()
        .single();

      if (videoError) throw videoError;
      setVideoRecordId(videoRecord.id);

      // Process each segment sequentially
      const completedClips: GeneratedClip[] = [];
      
      for (let i = 0; i < audioSegments.length; i++) {
        const segment = audioSegments[i];
        setCurrentSegmentIndex(i);
        setStatusMessage(`Processing clip ${i + 1} of ${audioSegments.length}...`);
        
        const baseProgress = 15 + (i / audioSegments.length) * 70;
        setProgress(baseProgress);

        // Upload segment audio
        const segmentAudioUrl = await uploadToStorage(
          segment.audioBlob,
          'background-music',
          `lipsync-segment-${Date.now()}-${i}.wav`
        );

        // Create segment record in database
        const { data: segmentRecord, error: segmentError } = await supabase
          .from('lipsync_segments')
          .insert({
            video_id: videoRecord.id,
            segment_index: i,
            audio_url: segmentAudioUrl,
            status: 'processing',
            start_time: segment.startTime,
            end_time: segment.endTime
          })
          .select()
          .single();

        if (segmentError) throw segmentError;

        // Start lip-sync generation for this segment
        const { data: genData, error: genError } = await supabase.functions.invoke('generate-lipsync-syncso', {
          body: {
            characterImageUrl: mediaUrl,
            audioUrl: segmentAudioUrl,
            model: selectedModel
          }
        });

        if (genError) throw genError;
        if (!genData.success) throw new Error(genData.error || 'Failed to start generation');

        // Update segment with job ID
        await supabase
          .from('lipsync_segments')
          .update({ job_id: genData.jobId })
          .eq('id', segmentRecord.id);

        // Poll for this segment's completion
        const outputUrl = await pollSegmentStatus(genData.jobId, i, audioSegments.length);
        
        // Update segment record with output
        await supabase
          .from('lipsync_segments')
          .update({ 
            output_url: outputUrl, 
            status: 'completed' 
          })
          .eq('id', segmentRecord.id);

        // Update video record progress
        await supabase
          .from('lipsync_videos')
          .update({ completed_segments: i + 1 })
          .eq('id', videoRecord.id);

        completedClips.push({
          id: segmentRecord.id,
          segmentIndex: i,
          outputUrl: outputUrl,
          startTime: segment.startTime,
          endTime: segment.endTime
        });

        setGeneratedClips([...completedClips]);
      }

      // All segments complete
      await supabase
        .from('lipsync_videos')
        .update({ status: 'completed' })
        .eq('id', videoRecord.id);

      setClipOrder(completedClips.map((_, i) => i));
      setProgress(100);
      setStatusMessage("All clips ready!");
      setStep(4);
      setIsGenerating(false);
      toast.success("All video clips generated!");

    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate video');
      
      // Update video status to failed
      if (videoRecordId) {
        await supabase
          .from('lipsync_videos')
          .update({ status: 'failed' })
          .eq('id', videoRecordId);
      }
      
      setIsGenerating(false);
      setStep(2);
    }
  };

  // Poll for single segment completion
  const pollSegmentStatus = (jobId: string, segmentIndex: number, totalSegments: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('generate-lipsync-syncso?action=status', {
            body: { jobId }
          });

          if (error) {
            clearInterval(interval);
            reject(error);
            return;
          }

          if (data.status === 'completed' && data.outputUrl) {
            clearInterval(interval);
            resolve(data.outputUrl);
          } else if (data.status === 'failed') {
            clearInterval(interval);
            reject(new Error(data.error || 'Segment generation failed'));
          } else {
            // Update progress within segment
            const segmentProgress = 15 + ((segmentIndex + 0.5) / totalSegments) * 70;
            setProgress(segmentProgress);
            setStatusMessage(`Making clip ${segmentIndex + 1} of ${totalSegments} sing...`);
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, 5000);
    });
  };

  // Reorder clips
  const moveClip = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= clipOrder.length) return;

    const newOrder = [...clipOrder];
    [newOrder[fromIndex], newOrder[toIndex]] = [newOrder[toIndex], newOrder[fromIndex]];
    setClipOrder(newOrder);
  };

  // Reset to start over
  const handleReset = () => {
    setStep(1);
    setAudioFile(null);
    setAudioDuration(null);
    setAudioSegments([]);
    setMediaFile(null);
    setMediaType(null);
    setMediaPreview(null);
    setUploadedMediaUrl(null);
    setIsGenerating(false);
    setProgress(0);
    setStatusMessage("");
    setGeneratedClips([]);
    setClipOrder([]);
    setVideoRecordId(null);
    setEstimatedCost(0);
    setCurrentSegmentIndex(0);
  };

  // Get ordered clips
  const orderedClips = clipOrder.map(i => generatedClips[i]).filter(Boolean);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Studio</span>
          </Link>
          <h1 className="font-heading font-bold text-xl text-gray-900">Simple Music Video</h1>
          <Link to="/simple/history" className="flex items-center gap-2 text-purple-600 hover:text-purple-700 transition-colors">
            <Clock className="w-5 h-5" />
            <span className="font-medium">My Videos</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          
          {/* Step 1: Upload Music */}
          {step === 1 && (
            <div className="text-center space-y-8 animate-fade-in max-w-2xl mx-auto">
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
                        <p className="text-gray-600">Duration: {formatTime(audioDuration)}</p>
                      )}
                      {audioSegments.length > 1 && (
                        <p className="text-purple-600 font-medium mt-1">
                          Will be split into {audioSegments.length} clips
                        </p>
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

              {statusMessage && (
                <div className="flex items-center justify-center gap-2 text-purple-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{statusMessage}</span>
                </div>
              )}

              <Button
                onClick={() => setStep(2)}
                disabled={!audioFile || audioSegments.length === 0}
                className="h-14 px-8 text-lg font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                Next: Choose Your Character
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Upload Photo or Video */}
          {step === 2 && (
            <div className="text-center space-y-8 animate-fade-in max-w-2xl mx-auto">
              <div>
                <h2 className="font-heading text-3xl font-bold text-gray-900 mb-2">
                  Step 2: Upload a Photo or Video
                </h2>
                <p className="text-lg text-gray-600">
                  This person will sing your song
                </p>
              </div>

              <div
                onClick={() => mediaInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-16 cursor-pointer transition-all
                  ${mediaFile 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                  }
                `}
              >
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaUpload}
                  className="hidden"
                />
                
                {mediaPreview ? (
                  <div className="space-y-4">
                    {mediaType === 'video' ? (
                      <video 
                        src={mediaPreview} 
                        className="w-48 h-48 object-cover rounded-xl mx-auto border-4 border-white shadow-lg"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    ) : (
                      <img 
                        src={mediaPreview} 
                        alt="Character preview" 
                        className="w-48 h-48 object-cover rounded-xl mx-auto border-4 border-white shadow-lg"
                      />
                    )}
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{mediaFile?.name}</p>
                      <p className="text-sm text-purple-600 font-medium">
                        {mediaType === 'video' ? '🎬 Video mode (lipsync-2)' : '📷 Photo mode (lipsync-1.9.0-beta)'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-20 h-20 rounded-full bg-purple-100 mx-auto flex items-center justify-center">
                      <div className="flex gap-1">
                        <Image className="w-6 h-6 text-purple-600" />
                        <Video className="w-6 h-6 text-purple-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-gray-900">Click to Upload Photo or Video</p>
                      <p className="text-gray-500">Clear face recommended • Video gives better lip-sync quality</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Model info */}
              {mediaFile && (
                <div className="bg-purple-50 rounded-xl p-4 text-left">
                  <p className="font-medium text-purple-900">
                    {mediaType === 'video' ? '🎬 Video Input' : '📷 Photo Input'}
                  </p>
                  <p className="text-sm text-purple-700">
                    {mediaType === 'video' 
                      ? 'Using lipsync-2 model for best quality video-to-video lip-sync'
                      : 'Using lipsync-1.9.0-beta model for image-to-video generation'
                    }
                  </p>
                </div>
              )}

              {/* Cost estimate */}
              <div className="bg-gray-100 rounded-xl p-4 space-y-1">
                <p className="text-gray-600">
                  Estimated cost: <span className="font-bold text-gray-900">${estimatedCost.toFixed(2)}</span>
                </p>
                {audioSegments.length > 1 && (
                  <p className="text-sm text-gray-500">
                    ({audioSegments.length} clips × $0.40 each)
                  </p>
                )}
              </div>

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
                  disabled={!mediaFile}
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
            <div className="text-center space-y-8 animate-fade-in max-w-2xl mx-auto">
              <div>
                <h2 className="font-heading text-3xl font-bold text-gray-900 mb-2">
                  Creating Your Music Video...
                </h2>
                <p className="text-lg text-gray-600">
                  {audioSegments.length > 1 
                    ? `Processing ${audioSegments.length} clips (about ${audioSegments.length * 2} minutes)` 
                    : 'This usually takes 1-3 minutes'
                  }
                </p>
              </div>

              <div className="space-y-6 py-8">
                <div className="w-24 h-24 rounded-full bg-purple-100 mx-auto flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                </div>

                <Progress value={progress} className="h-3 max-w-md mx-auto" />
                
                <p className="text-xl font-medium text-gray-700">{statusMessage}</p>

                {/* Segment progress */}
                {audioSegments.length > 1 && (
                  <div className="flex justify-center gap-2 flex-wrap">
                    {audioSegments.map((_, i) => (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          i < generatedClips.length 
                            ? 'bg-green-500 text-white' 
                            : i === currentSegmentIndex && isGenerating
                              ? 'bg-purple-500 text-white animate-pulse'
                              : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {i < generatedClips.length ? '✓' : i + 1}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-gray-500">
                Estimated cost: ${estimatedCost.toFixed(2)}
              </p>
            </div>
          )}

          {/* Step 4: Complete with Reordering */}
          {step === 4 && generatedClips.length > 0 && (
            <div className="text-center space-y-8 animate-fade-in">
              <div>
                <h2 className="font-heading text-3xl font-bold text-gray-900 mb-2">
                  🎉 Your Video Clips Are Ready!
                </h2>
                <p className="text-lg text-gray-600">
                  {generatedClips.length > 1 
                    ? 'Drag or use arrows to reorder clips before downloading'
                    : 'Download and share your music video'
                  }
                </p>
              </div>

              {/* Clip Reordering UI */}
              {generatedClips.length > 1 ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Use arrows to reorder clips
                  </p>
                  
                  <div className="flex gap-4 overflow-x-auto pb-4 px-4 justify-center">
                    {clipOrder.map((clipIndex, orderIndex) => {
                      const clip = generatedClips[clipIndex];
                      if (!clip) return null;
                      
                      return (
                        <div 
                          key={clip.id}
                          className="flex-shrink-0 bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm hover:border-purple-300 transition-all w-48"
                        >
                          <video
                            src={clip.outputUrl}
                            className="w-full aspect-video bg-black"
                            controls
                            muted
                          />
                          <div className="p-3 space-y-2">
                            <div className="text-center">
                              <p className="font-semibold text-gray-900">Clip {orderIndex + 1}</p>
                              <p className="text-xs text-gray-500">
                                {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                              </p>
                            </div>
                            
                            {/* Reorder controls */}
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => moveClip(orderIndex, 'left')}
                                disabled={orderIndex === 0}
                                className="h-8 w-8 p-0"
                              >
                                <MoveLeft className="w-4 h-4" />
                              </Button>
                              
                              <div className="text-purple-500">
                                <RotateCcw className="w-5 h-5" />
                              </div>
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => moveClip(orderIndex, 'right')}
                                disabled={orderIndex === clipOrder.length - 1}
                                className="h-8 w-8 p-0"
                              >
                                <MoveRight className="w-4 h-4" />
                              </Button>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = clip.outputUrl;
                                link.download = `clip-${orderIndex + 1}.mp4`;
                                link.target = '_blank';
                                link.click();
                              }}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Single clip view
                <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200 max-w-2xl mx-auto">
                  <video
                    src={generatedClips[0]?.outputUrl}
                    controls
                    autoPlay
                    className="w-full aspect-video bg-black"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 justify-center flex-wrap">
                <Button
                  onClick={() => {
                    orderedClips.forEach((clip, i) => {
                      setTimeout(() => {
                        const link = document.createElement('a');
                        link.href = clip.outputUrl;
                        link.download = `clip-${i + 1}.mp4`;
                        link.target = '_blank';
                        link.click();
                      }, i * 500);
                    });
                  }}
                  className="h-14 px-8 text-lg font-semibold bg-purple-600 hover:bg-purple-700"
                >
                  <Download className="w-5 h-5 mr-2" />
                  {generatedClips.length > 1 ? 'Download All Clips' : 'Download Video'}
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

              {/* Cost summary */}
              <p className="text-gray-500">
                Total cost: ${estimatedCost.toFixed(2)} for {generatedClips.length} clip{generatedClips.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SimpleMusicVideo;
