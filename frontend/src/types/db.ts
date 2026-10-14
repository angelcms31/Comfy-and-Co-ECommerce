// Table types, same field names as the ERD.
// Fields starting with _temp_ are not in the ERD yet (see SCHEMA_GAPS.md).

export type UserRoleName = 'customer' | 'admin';

export interface UserRole {
  user_role_id: number;
  user_role: UserRoleName;
  date_added: string;
}

export interface Country {
  country_id: number;
  country: string;
  date_added: string;
}

export interface City {
  city_id: number;
  country_id: number;
  city: string;
  date_added: string;
}

export interface User {
  user_id: string; // supabase auth id
  user_role_id: number;
  full_name: string;
  birthdate: string | null;
  email: string;
  mobile_no: string | null;
  st_add: string | null;
  postal: string | null;
  city_id: number | null;
  date_added: string;
}

export interface ItemCateg {
  item_categ_id: number;
  item_category: string;
  date_added: string;
}

export interface Product {
  product_id: number;
  item_categ_id: number;
  product_name: string;
  prod_desc: string;
  is_avail: boolean;
}

export interface ProdVar {
  prod_var_id: number;
  product_id: number;
  sku: string;
  prod_var_name: string;
  prod_attr: string;
  b_price: number;
  pr_price: number | null;
  pr_start: string | null;
  pr_end: string | null;
  stocks: number;
  is_avail: boolean;
  images: string | string[] | null; // use parseImages()
  date_added: string;
}

export interface WishlistCol {
  wishlist_coll_id: number;
  user_id: string;
  created_at: string;
}

export interface WishlistItem {
  wishlist_item_id: number;
  wishlist_coll_id: number;
  prod_var_id: number;
  created_at: string;
}

export interface Cart {
  cart_id: number;
  user_id: string;
  created_at: string;
}

export interface CartItem {
  cart_item_id: number;
  cart_id: number;
  prod_var_id: number;
  quantity: number;
}

export type OrderStat = 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
export const ORDER_STATUSES: OrderStat[] = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

export type PaymentMethod = 'GCash' | 'COD';
export type PaymentStatus = 'Unpaid' | 'Paid';

export interface Order {
  order_id: number;
  order_num: string;
  user_id: string;
  order_stat: OrderStat;
  subtotal: number;
  disc_amt: number;
  total_amt: number;
  payment_method: PaymentMethod;
  shipping_add: string;
  placed_at: string;
  _temp_note?: string | null;
  _temp_payment_status?: PaymentStatus;
}

export interface OrderItem {
  order_item_id: number;
  order_id: number;
  prod_var_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  sub_total: number;
}
