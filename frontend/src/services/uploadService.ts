import { http } from '@/lib/http';

// admin only, saves the image to Supabase Storage and returns its public url
export const uploadService = {
  productImage(file: File) {
    const form = new FormData();
    form.append('file', file);
    return http<{ url: string }>('/admin/uploads', { method: 'POST', body: form });
  },
};
