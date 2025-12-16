import { useState, useCallback } from 'react';
import { Upload, X, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReferenceImageUploadProps {
  onImageChange: (image: string | null) => void;
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

export function ReferenceImageUpload({ onImageChange, aspectRatio = '16:9', className }: ReferenceImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
      onImageChange(result);
    };
    reader.readAsDataURL(file);
  }, [onImageChange]);

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
    onImageChange(null);
  }, [onImageChange]);

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
        <div className="relative group animate-fade-in">
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
          </div>
          <button
            onClick={clearImage}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 border border-border hover:bg-destructive hover:border-destructive transition-all"
          >
            <X className="w-4 h-4" />
          </button>
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
          <input
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
