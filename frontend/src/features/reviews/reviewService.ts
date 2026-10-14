import { http } from '@/lib/http';
import type { ProductReviews, ReviewWithMeta } from './review.types';

export const reviewService = {
  // reviews are saved per variant, the backend groups all variants of the product
  getForProduct: (productId: number) => http<ProductReviews>(`/products/${productId}/reviews`),

  // admin, includes hidden reviews
  getAll: () => http<ProductReviews>('/admin/reviews'),
  setHidden: (reviewId: number, hidden: boolean) =>
    http<ReviewWithMeta>(`/admin/reviews/${reviewId}`, { method: 'PATCH', body: { is_hidden: hidden } }),
};
