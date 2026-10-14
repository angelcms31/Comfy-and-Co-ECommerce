import { useRef, useState, type DragEvent } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { uploadService } from '@/services/uploadService';
import { cn } from '@/lib/cn';

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
}

const MAX_MB = 5;

export default function ImageDropzone({ images, onChange }: Props) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files].filter((f) => {
      if (!f.type.startsWith('image/')) {
        toast.error(`${f.name} is not an image`);
        return false;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.error(`${f.name} is bigger than ${MAX_MB} MB`);
        return false;
      }
      return true;
    });

    setUploading((n) => n + list.length);
    const urls: string[] = [];
    for (const file of list) {
      try {
        urls.push((await uploadService.productImage(file)).url);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (urls.length) onChange([...images, ...urls]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center text-xs text-muted transition-colors',
          dragging ? 'border-forest bg-mint-light' : 'border-line bg-cream hover:border-forest',
        )}
      >
        {uploading > 0 ? <Loader2 className="size-5 animate-spin text-forest" /> : <Upload className="size-5 text-forest" />}
        <span>{uploading > 0 ? 'Uploading...' : 'Drag & drop product photos or browse files'}</span>
        <span className="text-[11px]">JPG, PNG or WEBP, up to {MAX_MB} MB</span>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((src, i) => (
            <div key={src + i} className="group relative size-16 overflow-hidden rounded-lg border border-line bg-cream">
              <img src={src} alt="" className="size-full object-contain p-1" />
              {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-forest/80 text-center text-[10px] text-white">Main</span>}
              <button
                type="button"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
                className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-white/90 text-ink shadow"
                aria-label="Remove image"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
