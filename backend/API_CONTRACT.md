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
| POST | `/auth/register` | `{ full_name, email, password, mobile_no, birthdate? }` (`mobile_no` is required, 11 digits starting with 09) | `Session`; also creates the `"user"` row with role customer |
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

## Users

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/users/me` | – | `UserProfile` |
| PATCH | `/users/me` | any of `{ full_name, birthdate, mobile_no, st_add, postal, city_id }` | `UserProfile` |
| POST | `/users/me/deactivate` | – | 204, bans the login (SCHEMA_GAPS #19); admins get 400 |

## Contact

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/contact` | `{ name, email, subject, message }`, subject is `order`, `refund`, `product` or `other` | `{ to, receipt }`. Emails the message to `CONTACT_EMAIL_TO` (or the store's support email) with Reply-To set to the customer, then a receipt to the customer (`receipt` false if that copy failed). 503 when SMTP isn't set up, 502 when the store email can't be sent. Up to 10 an hour per visitor or email; rows in `contact_message` are only a log |

## Orders

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/orders` | `PlaceOrderInput` | `OrderWithItems` |
| GET | `/orders/me` | – | `OrderWithItems[]`, newest first |
| GET | `/orders/{order_id}` | – | `OrderWithItems` (only the owner or an admin). Each item also has `product_id`, `color` and `images` from its variant |
| POST | `/orders/{order_id}/cancel` | `{ reason }` | `OrderWithItems`; only `Pending` orders, puts the stock back (SCHEMA_GAPS #20) |
| POST | `/orders/{order_id}/received` | – | `OrderWithItems`; the customer confirms a `Shipped` order, it becomes `Delivered` |
| POST | `/orders/uploads` | image file | `{ url }`; a refund photo, up to 5 MB (any logged in customer) |
| POST | `/orders/{order_id}/gcash/confirm` | `{ reference }` (13 digits) | `OrderWithItems`; the order's owner sends the reference number after scanning the store's QR, only while `Pending`. `_temp_payment_status` becomes `For verification` (SCHEMA_GAPS #2) |

```jsonc
// PlaceOrderInput
{
  "lines": [{ "prod_var_id": 19, "quantity": 1 }],
  "payment_method": "GCash",                 // or "COD"
  "customer": { "full_name": "...", "mobile_no": "...", "st_add": "...", "postal": "1600", "city_id": 4 },
  "note": "Please call before delivery",
  "fulfillment": "delivery",                 // or "pickup"; delivery adds DELIVERY_FEE (₱100) to total_amt
  "courier": "LBC"                           // required for delivery, one of COURIERS in backend/app/config.py
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

## Reviews (customers)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/reviews/mine` | – | `ReviewWithMeta[]` the logged-in customer wrote |
| POST | `/reviews` | `{ prod_var_id, rating, content, photos: string[], is_anonymous? }` | `ReviewWithMeta`; anonymous reviews show as "Anonymous" (no `user_id`) on the product page, admins still see the name; only after an order with that item is `Delivered` (403 otherwise). Writing again for the same item updates it |
| POST | `/reviews/uploads` | multipart `file` | `{ url }` for `photos` (max 3 per review) |
| GET | `/store-info` | – | public store name, support email, phone, address, hours (Settings > Store Info) |

## Chat

The FAQ bot (`backend/app/chatbot.py`) answers from fixed text and the Settings page. Logged-in customers' chats are saved; admins answer from `/admin/chats`.

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/chat/faq` | `{ body }` | `{ body, handoff, suggestions }`, no login needed and nothing saved. `handoff` = they asked for staff (the page asks guests to log in) |
| GET | `/chat` | – | `{ needs_staff, messages, suggestions }` for the logged-in customer (403 for admins); marks staff replies read |
| GET | `/chat/unread` | – | `{ unread }` staff replies not seen yet |
| POST | `/chat/messages` | `{ body }` (max 1000) | same as `GET /chat`; the bot replies unless staff is on the chat |
| POST | `/chat/staff` | – | same as `GET /chat`; asks staff to join (`needs_staff` true) |

## Admin (role `admin` or `super_admin`, 403 otherwise)

Every change below is written to `audit_log` (who, what, IP, device).

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/admin/dashboard` | `range` (`7d` / `30d` / `12m` / `24m`) | `DashboardSummary`; `chart` ends with forecast points: 1 day / 1 week, or 6 / 12 months for the monthly ranges |
| POST | `/admin/products` | `ProductInput` | `ProductWithVariants` |
| PUT | `/admin/products/{product_id}` | `ProductInput` | `ProductWithVariants` |
| PATCH | `/admin/products/{product_id}/archive` | `{ archived }` | `ProductWithVariants`; archived = `is_avail` false, hidden from the store |
| DELETE | `/admin/products/{product_id}` | – | 204, **Super Admin only** |
| POST | `/admin/uploads` | multipart `file` (JPG / PNG / WEBP, max 5 MB) | `{ url }`, put it in `prod_var.images` |
| GET | `/admin/orders` | `status`, `q` (order # or customer name) | `OrderWithItems[]`, newest first |
| PATCH | `/admin/orders/{order_id}/status` | `{ order_stat }` | `OrderWithItems`; cancelling puts the stock back |
| GET | `/admin/reviews` | – | `AdminReviews`: `ProductReviews` + `pendingReplies`, `hiddenCount`; includes hidden reviews |
| PATCH | `/admin/reviews/{review_id}` | `{ is_hidden?, is_featured? }` | `ReviewWithMeta` |
| POST | `/admin/reviews/{review_id}/reply` | `{ reply }` | `ReviewWithMeta` |
| GET | `/admin/settings` | – | `{ store, policies, regional, security }` |
| GET | `/admin/chats` | – | `ChatThread[]`, waiting for staff first, with `unread` and `last_message` |
| GET | `/admin/chats/unread` | – | `{ unread }` chats waiting for staff with unopened customer messages |
| GET | `/admin/chats/{thread_id}` | – | `{ thread, messages, orders }` (latest 3 orders); marks it read |
| POST | `/admin/chats/{thread_id}/messages` | `{ body }` | same as GET; the bot stays quiet until resolved |
| PATCH | `/admin/chats/{thread_id}` | `{ resolved }` | same as GET; resolving hands the chat back to the bot |
| GET | `/admin/suppliers` | – | `{ suppliers, categories }`: suppliers with `categories`, `units_sold`, `defective_units`, `report_count`, `open_count`; each category with its `supplier_id` |
| POST | `/admin/suppliers` | `{ supplier_name, contact_person?, phone?, email?, address?, is_active }` | the supplier (400 if the name is taken) |
| PUT | `/admin/suppliers/{supplier_id}` | same as POST | the supplier |
| PUT | `/admin/categories/{item_categ_id}/supplier` | `{ supplier_id }` (null = none) | same as `GET /admin/suppliers` |
| GET | `/admin/defects` | – | defect reports, open ones first; each saves the supplier at the time it was reported |
| GET | `/admin/defects/order/{order_id}` | – | the order's items, refund reason and photos, to start a report from a refund |
| POST | `/admin/defects` | `{ prod_var_id, quantity, defect_type, source, order_id?, notes?, photos }` | the report. `source`: `receiving` / `storage` (takes the units out of stock) / `customer_return` (needs `order_id`) |
| PATCH | `/admin/defects/{defect_id}` | `{ status, notes? }` | the report. Reported → Returned to supplier → Replaced (units go back into stock) / Credited; Reported → Credited |
| GET | `/admin/purchase-orders` | – | restock orders with `items`, open ones (Ordered / Partly received) first |
| POST | `/admin/purchase-orders` | `{ supplier_id, expected_date?, notes?, items: [{ prod_var_id, quantity, unit_cost? }] }` | the order; every item must be in one of the supplier's categories |
| POST | `/admin/purchase-orders/{po_id}/receive` | `{ items: [{ po_item_id, good, damaged, defect_type? }], notes? }` | the order. `good` units are added to `prod_var.stocks`; `damaged` units become a `receiving` defect report tied to the order (`po_id`). Status becomes Received when nothing is left, else Partly received |
| PATCH | `/admin/purchase-orders/{po_id}` | `{ status: "Cancelled" }` and/or `{ expected_date?, notes? }` | the order; cancelling marks the units still to come as cancelled, received ones stay in stock |

## Super Admin only (403 for regular admins)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/admin/admins` | – | admins and the Super Admin with `last_active` and `deactivated_at`. There is only one Super Admin: adding or promoting to `super_admin` is refused (400) |
| POST | `/admin/admins` | `{ full_name, email, password, role }` | the new account |
| PATCH | `/admin/admins/{user_id}/role` | `{ role }` | the account (not your own) |
| POST | `/admin/admins/{user_id}/password` | `{ password }` | 204 |
| POST | `/admin/admins/{user_id}/deactivate` | – | the account; bans the login. Super Admins and yourself can't be deactivated |
| POST | `/admin/admins/{user_id}/reactivate` | – | the account |
| PUT | `/admin/settings/store` / `policies` / `regional` / `security` | that section's fields | the saved section |
| POST | `/admin/settings/force-logout` | – | every admin login from before now gets 401, including yours |
| GET | `/admin/audit-logs` | `admin` (user_id), `action` (`products` / `orders` / `reviews` / `admins` / `settings`), `page`, `page_size` | `{ total, rows }` |

```jsonc
// ProductInput: product fields + variants. Variants with prod_var_id are updated, without are created,
// and existing variants missing from the list are deleted.
{ "item_categ_id": 1, "product_name": "...", "prod_desc": "...", "is_avail": true,
  "variants": [{ "prod_var_id": 1, "sku": "...", "prod_var_name": "...", "prod_attr": "Brown", "b_price": 18500,
                 "pr_price": null, "pr_start": null, "pr_end": null, "stocks": 7, "is_avail": true, "images": "..." }] }

// DashboardSummary (days are Asia/Manila, cancelled orders not counted in sales)
{ "salesToday": 23200, "ordersToday": 3, "lowStockCount": 9, "avgRating": 4.5, "reviewCount": 12,
  // 7d: one bar per day + tomorrow's forecast; 30d: 4 weeks + week 5 forecast (straight-line trend)
  "chart": [{ "label": "Mon", "total": 27900, "forecast": false }, { "label": "Tue", "total": 31000, "forecast": true }],
  "recentOrders": [ /* OrderWithItems, latest 6 */ ] }

// ProductReviews (store side leaves hidden reviews out and lists featured ones first)
{ "summary": { "average": 4.3, "count": 17, "breakdown": { "1": 0, "2": 1, "3": 1, "4": 7, "5": 8 } },
  "reviews": [{ "review_id": 1, "user_id": "...", "prod_var_id": 1, "rating": 5, "content": "...", "created_at": "...",
                "photos": "https://...,https://...", "reply": "Thank you!", "replied_at": "...", "is_featured": true, "is_hidden": false,
                "reviewer_name": "Maria Santos", "product_id": 1, "product_name": "2P Sofa LB01", "prod_attr": "Brown",
                "product_images": "...", "item_categ_id": 1, "item_category": "Living Room" }] }
```

## Not saved yet (waiting on SCHEMA_GAPS)

- `note` in `PlaceOrderInput` is accepted but not stored (#2)
- GCash payment status (#2)

The frontend reads these as optional `_temp_` fields, so nothing breaks while they're missing.
