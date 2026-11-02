import { http } from '@/lib/http';
import type { AdminReviews, ProductReviews, ReviewInput, ReviewWithMeta } from './review.types';

export const reviewService = {
  // reviews are saved per variant, the backend groups all variants of the product (hidden ones left out)
  getForProduct: (productId: number) => http<ProductReviews>(`/products/${productId}/reviews`),

  // customers: only for items in a delivered order, writing again updates the review
  getMine: () => http<ReviewWithMeta[]>('/reviews/mine'),
  write: (input: ReviewInput) => http<ReviewWithMeta>('/reviews', { method: 'POST', body: input }),
  uploadPhoto(file: File) {
    const form = new FormData();
    form.append('file', file);
    return http<{ url: string }>('/reviews/uploads', { method: 'POST', body: form });
  },

  // admin, includes hidden reviews
  getAll: () => http<AdminReviews>('/admin/reviews'),
  setFlags: (reviewId: number, flags: { is_hidden?: boolean; is_featured?: boolean }) =>
    http<ReviewWithMeta>(`/admin/reviews/${reviewId}`, { method: 'PATCH', body: flags }),
  reply: (reviewId: number, reply: string) => http<ReviewWithMeta>(`/admin/reviews/${reviewId}/reply`, { method: 'POST', body: { reply } }),
};
