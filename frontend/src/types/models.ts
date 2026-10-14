import type {
  CartItem, City, Country, ItemCateg, Order, OrderItem, OrderStat, PaymentMethod, ProdVar, Product, User,
  UserRoleName, WishlistItem,
} from './db';

export type ProductWithVariants = Product & {
  category: ItemCateg;
  variants: ProdVar[];
};

export type VariantWithProduct = ProdVar & { product: Product };

export type Collection = 'all' | 'best_sellers' | 'limited';
export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'name';

export interface ProductQuery {
  q?: string;
  categoryId?: number;
  collection?: Collection;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  includeUnavailable?: boolean; // admin inventory
}

export type VariantInput = Omit<ProdVar, 'prod_var_id' | 'product_id' | 'date_added'> & { prod_var_id?: number };
export type ProductInput = Omit<Product, 'product_id'> & { variants: VariantInput[] };

// guest cart lines use a string id (no cart_item row yet)
export type CartLine = Omit<CartItem, 'cart_item_id' | 'cart_id'> & {
  cart_item_id: number | string;
  variant: VariantWithProduct;
};

export type WishlistLine = WishlistItem & { variant: VariantWithProduct };

export type OrderWithItems = Order & {
  items: OrderItem[];
  customer_name: string;
};

export interface PlaceOrderInput {
  lines: { prod_var_id: number; quantity: number }[];
  payment_method: PaymentMethod;
  customer: Pick<User, 'full_name' | 'mobile_no' | 'st_add' | 'postal' | 'city_id'>;
  note?: string;
}

export interface OrderQuery {
  status?: OrderStat;
  q?: string;
}

export type CityWithCountry = City & { country: Country };
export type UserProfile = User & { city: CityWithCountry | null; role: UserRoleName };

export interface Session {
  access_token: string;
  user: UserProfile;
}

export interface RegisterInput {
  full_name: string;
  email: string;
  password: string;
  mobile_no?: string;
  birthdate?: string;
}

export interface DashboardSummary {
  salesToday: number;
  ordersToday: number;
  pendingOrders: number;
  lowStockCount: number;
  last7Days: { day: string; total: number }[];
  recentOrders: OrderWithItems[];
}
