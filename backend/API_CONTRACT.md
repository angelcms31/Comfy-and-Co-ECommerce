# API contract (frontend ⇄ FastAPI)

These are the endpoints in `backend/app/routers/` and the frontend calls them from `frontend/src/services/`. If you change a path or a field name, update both sides. FastAPI also shows them at http://localhost:8000/docs while the server is running.

- Base URL: `VITE_API_URL` in `frontend/.env` (default `http://localhost:8000/api`)
- JSON in, JSON out. Field names are snake_case and match the ERD.
- Logged-in requests send `Authorization: Bearer <access_token>`. The backend gets the user from the token, so the frontend never sends `user_id`.
- Errors: use FastAPI's normal `{"detail": "message"}`. The frontend shows `detail` to the user.
- CORS: allow `http://localhost:5173` (Vite dev server).

Response types are in `frontend/src/types/models.ts` and `frontend/src/features/reviews/review.types.ts`.

## Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `Session` |
| POST | `/auth/register` | `{ full_name, email, password, mobile_no?, birthdate? }` | `Session`; also creates the `"user"` row with role customer |
| POST | `/auth/logout` | – | 204 |
| GET | `/auth/me` | – | `UserProfile` (401 if the token is invalid) |
| POST | `/auth/forgot-password` | `{ email }` | 204, Supabase emails a 6 digit code |
| POST | `/auth/verify-code` | `{ email, code }` | `{ reset_token }`, or 400 if wrong |
| POST | `/auth/reset-password` | `{ reset_token, new_password }` | 204 |

```jsonc
// Session
{
  "access_token": "eyJ...",
  "user": {
    "user_id": "uuid", "user_role_id": 1, "full_name": "Juan Dela Cruz", "birthdate": "1999-05-14",
    "email": "juan@comfyco.ph", "mobile_no": "09171234567", "st_add": "12 Sampaguita St.", "postal": "1600",
    "city_id": 4, "date_added": "...",
    "role": "customer",                                   // from user_role.user_role
    "city": { "city_id": 4, "city": "Pasig", "country_id": 1, "date_added": "...",
              "country": { "country_id": 1, "country": "Philippines", "date_added": "..." } }
  }
}
```

## Catalog

| Method | Path | Query / body | Returns |
|---|---|---|---|
| GET | `/categories` | – | `item_categ[]` |
| GET | `/cities` | – | `CityWithCountry[]` |
| GET | `/products` | `q`, `item_categ_id`, `collection` (`all` / `best_sellers` / `limited`), `min_price`, `max_price`, `sort` (`newest` / `price_asc` / `price_desc` / `name`), `include_unavailable` | `ProductWithVariants[]` |
| GET | `/products/{product_id}` | – | `ProductWithVariants` (404 if missing) |
| GET | `/variants` | `ids=1,2,3` | `VariantWithProduct[]` (used for the guest cart) |
| GET | `/products/{product_id}/reviews` | – | `ProductReviews`, all variants, hidden reviews left out |

- Without `include_unavailable`, leave out products with `is_avail = false` and variants with `is_avail = false`.
- Price filters and sorting use the **effective price**: `pr_price` if today is between `pr_start` and `pr_end`, otherwise `b_price`. Same rule as `getEffectivePrice()` in `frontend/src/lib/pricing.ts`.
- `best_sellers` = products ordered most (not counting cancelled orders). `limited` = has a variant with a running promo. See SCHEMA_GAPS #6.

```jsonc
// ProductWithVariants
{
  "product_id": 1, "item_categ_id": 1, "product_name": "2P Sofa LB01", "prod_desc": "...", "is_avail": true,
  "category": { "item_categ_id": 1, "item_category": "Sofas", "date_added": "..." },
  "variants": [{
    "prod_var_id": 1, "product_id": 1, "sku": "SOF-001-BRO", "prod_var_name": "2P Sofa LB01 - Brown",
    "prod_attr": "Brown", "b_price": 18500, "pr_price": 16900, "pr_start": "2026-09-30", "pr_end": "2026-10-30",
    "stocks": 7, "is_avail": true, "images": "/images/products/SOF-001-BRO-1.svg,...", "date_added": "..."
  }]
}
// VariantWithProduct = a prod_var row + "product": { ...product row }
```

## Cart (logged in)

All of these return the full cart afterwards as `CartLine[]`. Quantity can never go above `stocks`.

| Method | Path | Body |
|---|---|---|
| GET | `/cart` | – |
| POST | `/cart/items` | `{ prod_var_id, quantity }`, adds to the existing row if the variant is already in the cart |
| PATCH | `/cart/items/{cart_item_id}` | `{ quantity }` |
| DELETE | `/cart/items/{cart_item_id}` | – |
| POST | `/cart/merge` | `{ items: [{ prod_var_id, quantity }] }`, the guest cart after login |
| DELETE | `/cart` | – (204) |

```jsonc
// CartLine
{ "cart_item_id": 3, "prod_var_id": 19, "quantity": 1, "variant": { /* VariantWithProduct */ } }
```

## Wishlist

Each user has one `wishlist_col`. Create it on the first add. All return `WishlistLine[]` (a `wishlist_item` row + `variant: VariantWithProduct`), newest first.

| Method | Path | Body |
|---|---|---|
| GET | `/wishlist` | – |
| POST | `/wishlist/items` | `{ prod_var_id }`, ignore if already there |
| DELETE | `/wishlist/items/{wishlist_item_id}` | – |

## Orders

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/orders` | `PlaceOrderInput` | `OrderWithItems` |
| GET | `/orders/me` | – | `OrderWithItems[]`, newest first |
| GET | `/orders/{order_id}` | – | `OrderWithItems` (only the owner or an admin) |
| POST | `/orders/{order_id}/gcash/confirm` | – | `OrderWithItems` (mock GCash; can't be marked paid until SCHEMA_GAPS #2) |

```jsonc
// PlaceOrderInput
{
  "lines": [{ "prod_var_id": 19, "quantity": 1 }],
  "payment_method": "GCash",                 // or "COD"
  "customer": { "full_name": "...", "mobile_no": "...", "st_add": "...", "postal": "1600", "city_id": 4 },
  "note": "Please call before delivery"
}
```

When placing an order the backend should:
1. Check every line is available and `quantity <= stocks`, and reject the whole order if not.
2. Save `customer` back to the `"user"` row (one address per user).
3. Make `order_num` like `ORD-1021` (next number).
4. Copy `item_name = prod_var_name` and `item_price = effective price` into `order_item` (snapshot).
5. `subtotal` = Σ `b_price × qty`, `total_amt` = Σ `sub_total`, `disc_amt` = the difference (see SCHEMA_GAPS #8).
6. `shipping_add` = text like `"12 Sampaguita St., Pasig, 1600, Philippines"`.
7. Lower `stocks`, and remove the ordered variants from the user's cart.

```jsonc
// OrderWithItems = order row + "items": order_item[] + "customer_name": "Juan Dela Cruz"
```

## Admin (role must be admin, return 403 otherwise)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/admin/dashboard` | – | `DashboardSummary` |
| POST | `/admin/products` | `ProductInput` | `ProductWithVariants` |
| PUT | `/admin/products/{product_id}` | `ProductInput` | `ProductWithVariants` |
| DELETE | `/admin/products/{product_id}` | – | 204 |
| POST | `/admin/uploads` | multipart `file` (JPG / PNG / WEBP, max 5 MB) | `{ url }`, put it in `prod_var.images` |
| GET | `/admin/orders` | `status`, `q` (order # or customer name) | `OrderWithItems[]`, newest first |
| PATCH | `/admin/orders/{order_id}/status` | `{ order_stat }` | `OrderWithItems`; cancelling puts the stock back |
| GET | `/admin/reviews` | – | `ProductReviews`, includes hidden reviews |
| PATCH | `/admin/reviews/{review_id}` | `{ is_hidden }` | 501 for now, needs the `is_hidden` column (SCHEMA_GAPS #1) |

```jsonc
// ProductInput: product fields + variants. Variants with prod_var_id are updated, without are created,
// and existing variants missing from the list are deleted.
{ "item_categ_id": 1, "product_name": "...", "prod_desc": "...", "is_avail": true,
  "variants": [{ "prod_var_id": 1, "sku": "...", "prod_var_name": "...", "prod_attr": "Brown", "b_price": 18500,
                 "pr_price": null, "pr_start": null, "pr_end": null, "stocks": 7, "is_avail": true, "images": "..." }] }

// DashboardSummary (days are Asia/Manila, cancelled orders not counted in sales)
{ "salesToday": 23200, "ordersToday": 3, "pendingOrders": 5, "lowStockCount": 9,
  "last7Days": [{ "day": "2026-10-07", "total": 27900 }],   // 7 items, oldest first
  "recentOrders": [ /* OrderWithItems, latest 6 */ ] }

// ProductReviews
{ "summary": { "average": 4.3, "count": 17, "breakdown": { "1": 0, "2": 1, "3": 1, "4": 7, "5": 8 } },
  "reviews": [{ "review_id": 1, "user_id": "...", "prod_var_id": 1, "rating": 5, "content": "...",
                "reviewer_name": "Maria Santos", "product_id": 1, "product_name": "2P Sofa LB01", "prod_attr": "Brown" }] }
```

## Not saved yet (waiting on SCHEMA_GAPS)

- `note` in `PlaceOrderInput` is accepted but not stored (#2)
- GCash payment status (#2)
- Hide review, review date (#1)

The frontend reads these as optional `_temp_` fields, so nothing breaks while they're missing.
