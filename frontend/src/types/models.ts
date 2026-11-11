import type {
  CartItem, City, Country, DeliveryAttempt, ItemCateg, Order, OrderItem, OrderStat, PaymentMethod, ProdVar, Product, Refund, User,
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

// the backend adds these from the variant, they're null if the product was deleted
export type OrderLine = OrderItem & {
  product_id: number | null;
  color: string | null;
  images: string | string[] | null;
};

export type OrderWithItems = Order & {
  items: OrderLine[];
  attempts: DeliveryAttempt[]; // the rider's failed hand-overs, oldest first
  customer_name: string;
  customer_mobile: string | null;
  refund: Refund | null; // null until the customer asks for a refund
};

export interface PlaceOrderInput {
  lines: { prod_var_id: number; quantity: number }[];
  payment_method: PaymentMethod;
  customer: Pick<User, 'full_name' | 'mobile_no' | 'st_add' | 'postal' | 'city_id'>;
  note?: string;
  fulfillment: Fulfillment;
  drop_off?: DropOff; // where the Lalamove rider goes; the pin is optional
}

export interface DropOff {
  lat: number | null;
  lng: number | null;
  delivery_note: string | null;
}

// POST /orders/delivery-quote: what a delivery would cost before the order is placed
export interface DeliveryQuote {
  courier: string;
  vehicle: string;
  trips: number;
  distance_km: number;
  by_road: boolean; // false when the route server was down and the distance is a straight-line estimate
  delivery_fee: number;
  drop_lat: number;
  drop_lng: number;
  located_by: 'pin' | 'address';
  unmeasured: string[]; // items with no size/weight saved, the vehicle is a guess for them
}

// GET /delivery/<order>/<token>: what the rider sees after scanning the receipt
export interface RiderOrder {
  order_id: number;
  order_num: string;
  order_stat: OrderStat;
  payment_method: PaymentMethod;
  total_amt: number;
  collect_amt: number; // cash to collect at the door (0 when paid by e-wallet)
  address: string;
  vehicle: string | null;
  trips: number;
  drop_lat: number | null;
  drop_lng: number | null;
  delivery_note: string | null;
  delivered_at: string | null;
  delivered_by: 'rider' | 'customer' | 'admin' | null;
  proof_photos: string | null;
  customer_name: string;
  mobile_no: string | null;
  items: { item_name: string; quantity: number }[];
  attempts: Pick<DeliveryAttempt, 'reason' | 'note' | 'attempted_at'>[];
  max_attempts: number; // after this many failed attempts the order is Returned
  reasons: string[]; // what the rider can pick for a failed attempt
}

export type Fulfillment = 'delivery' | 'pickup';

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
  mobile_no: string;
  birthdate?: string;
}
