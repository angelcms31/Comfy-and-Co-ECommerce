import { useEffect, useRef, useState } from 'react';
import { Camera, Star, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import LoadingDots from '@/components/ui/LoadingDots';
import { cn } from '@/lib/cn';
import { parseImages } from '@/lib/images';
import type { OrderWithItems } from '@/types/models';
import { reviewService } from '../reviewService';

const MAX_PHOTOS = 3;
const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// opened from Track Order on a completed order. Writing again for the same item updates the review.
export default function WriteReviewModal({ order, onClose }: { order: OrderWithItems | null; onClose: () => void }) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [varId, setVarId] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  // pick the first item, and fill in the review if they already wrote one for it
  useEffect(() => {
    if (!order) return;
    setVarId(order.items[0]?.prod_var_id ?? null);
  }, [order]);
  useEffect(() => {
    if (!order || varId === null) return;
    setRating(0);
    setContent('');
    setPhotos([]);
    setAnonymous(false);
    setEditing(false);
    reviewService
      .getMine()
      .then((mine) => {
        const r = mine.find((x) => x.prod_var_id === varId);
        if (!r) return;
        setRating(r.rating);
        setContent(r.content);
        setPhotos(parseImages(r.photos));
        setAnonymous(r.is_anonymous);
        setEditing(true);
      })
      .catch(() => {});
  }, [order, varId]);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of [...files].slice(0, MAX_PHOTOS - photos.length)) {
        const { url } = await reviewService.uploadPhoto(file);
        setPhotos((p) => [...p, url]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const submit = async () => {
    if (varId === null) return;
    setBusy(true);
    try {
      await reviewService.write({ prod_var_id: varId, rating, content: content.trim(), photos, is_anonymous: anonymous });
      toast.success(editing ? 'Your review was updated.' : 'Thanks for your review!');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your review');
    } finally {
      setBusy(false);
    }
  };

  const shown = hover || rating;

  return (
    <Modal
      open={!!order}
      onClose={() => !busy && onClose()}
      title={editing ? 'Edit your review' : 'Write a review'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!rating || uploading}>
            {editing ? 'Update review' : 'Submit review'}
          </Button>
        </>
      }
    >
      {order && (
        <div className="space-y-4">
          {order.items.length > 1 ? (
            <Select label="Item" value={varId ?? ''} onChange={(e) => setVarId(Number(e.target.value))}>
              {order.items.map((i) => (
                <option key={i.order_item_id} value={i.prod_var_id}>
                  {i.item_name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm font-medium text-ink">{order.items[0]?.item_name}</p>
          )}

          <div>
            <p className="mb-1 text-sm font-medium text-ink">Your rating</p>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`}>
                  <Star className={cn('size-8 transition-colors', n <= shown ? 'fill-amber text-amber' : 'fill-line text-line')} />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted">{WORDS[shown]}</span>
            </div>
          </div>

          <Textarea
            label="Your review (optional)"
            rows={4}
            maxLength={2000}
            placeholder="How's the quality, size and comfort? Would you recommend it?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          <div>
            <p className="mb-1 text-sm font-medium text-ink">Photos (optional, up to {MAX_PHOTOS})</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((src) => (
                <span key={src} className="relative size-20 overflow-hidden rounded-lg border border-line">
                  <img src={src} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((p) => p.filter((x) => x !== src))}
                    aria-label="Remove photo"
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-ink/70 text-white"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  className="grid size-20 place-items-center rounded-lg border-2 border-dashed border-line text-forest hover:bg-cream"
                  aria-label="Add photos"
                >
                  {uploading ? <LoadingDots size="sm" /> : <Camera className="size-6" />}
                </button>
              )}
            </div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3">
            <input type="checkbox" className="mt-0.5 size-4 accent-forest" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            <span>
              <span className="block text-sm font-medium text-ink">Post anonymously</span>
              <span className="block text-xs text-muted">Your name will show as "Anonymous" on the product page.</span>
            </span>
          </label>
        </div>
      )}
    </Modal>
  );
}
