import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import LoadingDots from '@/components/ui/LoadingDots';
import { compressImage, formatKb } from '@/lib/compressImage';

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
  upload: (file: File) => Promise<{ url: string }>;
  max?: number;
  label?: string;
  onUploadingChange?: (uploading: boolean) => void;
};

// Up to `max` photos. Each one is shrunk to a few hundred KB in the browser first, then uploaded,
// and its new size is shown under the thumbnail.
export default function PhotoPicker({ photos, onChange, upload, max = 3, label, onUploadingChange }: Props) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);

  const setBusy = (busy: boolean) => {
    setUploading(busy);
    onUploadingChange?.(busy);
  };

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = max - photos.length;
    if (files.length > room) toast.error(`You can add up to ${max} photos.`);
    setBusy(true);
    let next = photos;
    try {
      for (const file of [...files].slice(0, room)) {
        const small = await compressImage(file);
        const { url } = await upload(small);
        next = [...next, url];
        onChange(next);
        setSizes((s) => ({ ...s, [url]: small.size }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-ink">{label ?? `Photos (optional, up to ${max})`}</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((src) => (
          <figure key={src} className="w-20">
            <span className="relative block size-20 overflow-hidden rounded-lg border border-line">
              <img src={src} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(photos.filter((x) => x !== src))}
                aria-label="Remove photo"
                className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-ink/70 text-white"
              >
                <X className="size-3" />
              </button>
            </span>
            {sizes[src] != null && <figcaption className="mt-0.5 text-center text-[11px] text-muted">{formatKb(sizes[src])}</figcaption>}
          </figure>
        ))}
        {photos.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading}
            className="grid size-20 place-items-center rounded-lg border-2 border-dashed border-line text-forest hover:bg-cream disabled:cursor-wait"
            aria-label="Add photos"
          >
            {uploading ? <LoadingDots size="sm" /> : <Camera className="size-6" />}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add(e.target.files)} />
    </div>
  );
}
