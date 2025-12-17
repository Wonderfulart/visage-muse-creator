import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, X, User, Shield, AlertTriangle, Crop, ScanFace } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FaceDetectionResult {
  detected: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
}

interface ReferenceImageUploadProps {
  onImageChange: (image: string | null) => void;
  onFaceDetected?: (result: FaceDetectionResult) => void;
  aspectRatio?: string;
  className?: string;
}

const getAspectRatioClass = (ratio?: string) => {
  switch (ratio) {
    case '16:9': return 'aspect-video';
    case '9:16': return 'aspect-[9/16]';
    default: return 'aspect-video';
  }
};

// Simple canvas-based face detection heuristic using skin tone detection
const detectFace = async (imageUrl: string): Promise<FaceDetectionResult> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ detected: false });
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Scan for skin-tone pixels (simplified face detection)
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let skinPixelCount = 0;
      const totalPixels = canvas.width * canvas.height;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Skin tone detection (works for various skin tones)
          const isSkinTone = 
            r > 60 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15 &&
            r - b > 15 &&
            r < 250 && g < 250 && b < 250;

          if (isSkinTone) {
            skinPixelCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Check if enough skin pixels found (at least 3% of image)
      const skinRatio = skinPixelCount / totalPixels;
      const hasFace = skinRatio > 0.03 && (maxX - minX) > 50 && (maxY - minY) > 50;

      if (hasFace) {
        // Add padding around detected region
        const padding = Math.max((maxX - minX), (maxY - minY)) * 0.3;
        resolve({
          detected: true,
          bounds: {
            x: Math.max(0, minX - padding),
            y: Math.max(0, minY - padding),
            width: Math.min(canvas.width - minX + padding, maxX - minX + padding * 2),
            height: Math.min(canvas.height - minY + padding, maxY - minY + padding * 2)
          }
        });
      } else {
        resolve({ detected: false });
      }
    };
    img.onerror = () => resolve({ detected: false });
    img.src = imageUrl;
  });
};

// Crop image to face bounds
const cropToFace = async (imageUrl: string, bounds: FaceDetectionResult['bounds']): Promise<string> => {
  if (!bounds) return imageUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageUrl);
        return;
      }

      // Make the crop square for better face preservation
      const size = Math.max(bounds.width, bounds.height);
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const cropX = Math.max(0, centerX - size / 2);
      const cropY = Math.max(0, centerY - size / 2);
      const cropSize = Math.min(size, img.width - cropX, img.height - cropY);

      canvas.width = cropSize;
      canvas.height = cropSize;
      ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
};

export function ReferenceImageUpload({ onImageChange, onFaceDetected, aspectRatio = '16:9', className }: ReferenceImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [faceDetection, setFaceDetection] = useState<FaceDetectionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoCrop, setAutoCrop] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (imageUrl: string) => {
    setIsAnalyzing(true);
    setOriginalImage(imageUrl);

    const detection = await detectFace(imageUrl);
    setFaceDetection(detection);
    onFaceDetected?.(detection);

    if (detection.detected && detection.bounds && autoCrop) {
      const croppedImage = await cropToFace(imageUrl, detection.bounds);
      setPreview(croppedImage);
      onImageChange(croppedImage);
    } else {
      setPreview(imageUrl);
      onImageChange(imageUrl);
    }

    setIsAnalyzing(false);
  }, [onImageChange, onFaceDetected, autoCrop]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      processImage(result);
    };
    reader.readAsDataURL(file);
  }, [processImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearImage = useCallback(() => {
    setPreview(null);
    setOriginalImage(null);
    setFaceDetection(null);
    onImageChange(null);
    onFaceDetected?.({ detected: false });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onImageChange, onFaceDetected]);

  const toggleAutoCrop = useCallback(async () => {
    const newAutoCrop = !autoCrop;
    setAutoCrop(newAutoCrop);

    if (originalImage && faceDetection?.detected && faceDetection.bounds) {
      if (newAutoCrop) {
        const croppedImage = await cropToFace(originalImage, faceDetection.bounds);
        setPreview(croppedImage);
        onImageChange(croppedImage);
      } else {
        setPreview(originalImage);
        onImageChange(originalImage);
      }
    }
  }, [autoCrop, originalImage, faceDetection, onImageChange]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Reference Image
        </label>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 text-primary" />
          Face preserved
        </div>
      </div>
      
      {preview ? (
        <div className="space-y-3 animate-fade-in">
          <div className="relative group">
            <div className={cn(
              "relative overflow-hidden rounded-xl border border-border/50 glow-sm",
              getAspectRatioClass(aspectRatio)
            )}>
              <img
                src={preview}
                alt="Reference"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              {/* Face detection indicator */}
              {faceDetection?.detected && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/90 text-primary-foreground text-xs">
                  <ScanFace className="w-3.5 h-3.5" />
                  Face detected
                </div>
              )}
            </div>
            <button
              onClick={clearImage}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 border border-border hover:bg-destructive hover:border-destructive transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Face Detection Warning */}
          {faceDetection && !faceDetection.detected && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-500">No clear face detected</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Facial preservation may not work as expected. Upload an image with a clearly visible face for best results.
                </p>
              </div>
            </div>
          )}

          {/* Auto-crop toggle */}
          {faceDetection?.detected && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/50">
              <div className="flex items-center gap-2">
                <Crop className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-crop to face</p>
                  <p className="text-xs text-muted-foreground">Centers and crops image on detected face</p>
                </div>
              </div>
              <button
                onClick={toggleAutoCrop}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-all",
                  autoCrop ? "bg-primary" : "bg-muted"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-all",
                    autoCrop ? "left-5" : "left-0.5"
                  )}
                />
              </button>
            </div>
          )}
        </div>
      ) : (
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300",
            getAspectRatioClass(aspectRatio),
            isDragging
              ? "border-primary bg-primary/5 glow-sm"
              : "border-border/50 hover:border-primary/50 hover:bg-secondary/50"
          )}
        >
          {isAnalyzing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-primary/20">
                <ScanFace className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground">Analyzing face...</p>
            </div>
          ) : (
            <>
              <div className={cn(
                "p-4 rounded-full transition-all",
                isDragging ? "bg-primary/20" : "bg-secondary"
              )}>
                <Upload className={cn(
                  "w-6 h-6 transition-colors",
                  isDragging ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Drop your reference image here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to browse
                </p>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}
