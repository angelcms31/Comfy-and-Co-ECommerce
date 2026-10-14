import type { ProdVar } from '@/types/db';

export const PLACEHOLDER_IMG = '/images/placeholder.svg';

export function parseImages(images: ProdVar['images']): string[] {
  if (!images) return [];
  const list = Array.isArray(images) ? images : images.split(',');
  return list.map((s) => s.trim()).filter(Boolean);
}

export function firstImage(images: ProdVar['images']) {
  return parseImages(images)[0] ?? PLACEHOLDER_IMG;
}
