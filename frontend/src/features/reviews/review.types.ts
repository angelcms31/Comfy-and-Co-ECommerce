// Review fields from migrations/002_admin_panel.sql (created_at, photos, reply, is_featured, is_hidden) are on top of the ERD.

export interface Review {
  review_id: number;
  user_id: string;
  prod_var_id: number;
  rating: number; // 1-5
  content: string;
  created_at: string;
  photos: string | null; // comma separated URLs, use parseImages()
  reply: string | null; // the store's answer
  replied_at: string | null;
  is_featured: boolean;
  is_hidden: boolean;
}

export type ReviewWithMeta = Review & {
  reviewer_name: string;
  product_id: number;
  product_name: string;
  prod_attr: string;
  product_images: string | null;
  item_categ_id: number;
  item_category: string;
};

export interface RatingSummary {
  average: number;
  count: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ProductReviews {
  summary: RatingSummary;
  reviews: ReviewWithMeta[];
}

export interface AdminReviews extends ProductReviews {
  pendingReplies: number;
  hiddenCount: number;
}

export interface ReviewInput {
  prod_var_id: number;
  rating: number;
  content: string;
  photos: string[];
}
