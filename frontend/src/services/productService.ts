import { http } from '@/lib/http';
import type { ProductInput, ProductQuery, ProductWithVariants, VariantWithProduct } from '@/types/models';

export const productService = {
  getAll: (query: ProductQuery = {}) =>
    http<ProductWithVariants[]>('/products', {
      params: {
        q: query.q,
        item_categ_id: query.categoryId,
        collection: query.collection,
        min_price: query.minPrice,
        max_price: query.maxPrice,
        sort: query.sort,
        include_unavailable: query.includeUnavailable,
      },
    }),

  getById: (productId: number) => http<ProductWithVariants>(`/products/${productId}`),

  // used by the guest cart to show the saved variants
  getVariants: (ids: number[]) => http<VariantWithProduct[]>('/variants', { params: { ids: ids.join(',') } }),

  create: (input: ProductInput) => http<ProductWithVariants>('/admin/products', { method: 'POST', body: input }),

  update: (productId: number, input: ProductInput) =>
    http<ProductWithVariants>(`/admin/products/${productId}`, { method: 'PUT', body: input }),

  remove: (productId: number) => http<void>(`/admin/products/${productId}`, { method: 'DELETE' }),
};
