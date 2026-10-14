// The review table is still changing, so its types live here instead of types/db.ts.

export interface Review {
  review_id: number;
  user_id: string;
  prod_var_id: number;
  rating: number; // 1-5
  content: string;
  _temp_is_hidden?: boolean;
  _temp_created_at?: string;
}

export type ReviewWithMeta = Review & {
  reviewer_name: string;
  product_id: number;
  product_name: string;
  prod_attr: string;
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
