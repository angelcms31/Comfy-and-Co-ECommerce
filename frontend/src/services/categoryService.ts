import { http } from '@/lib/http';
import type { ItemCateg } from '@/types/db';

// header and footer both need categories, so keep one request around
let cached: Promise<ItemCateg[]> | null = null;

export const categoryService = {
  getAll() {
    cached ??= http<ItemCateg[]>('/categories').catch((err) => {
      cached = null;
      throw err;
    });
    return cached;
  },

  // call after admin changes so the next getAll() refetches
  clearCache() {
    cached = null;
  },
};
