# Schema gaps

Things the screens need that the ERD doesn't have yet. The group should decide on each one.

The ones marked **Added** are already in the database through `backend/supabase/migrations/002_admin_panel.sql` (the group agreed to it for the admin panel). The ERD still needs to be updated to show them.

Fields the frontend reads that are not in the ERD start with `_temp_`, so they're easy to find and rename later.

## From the project spec

| # | Gap | What the frontend does for now | Possible fix |
|---|-----|-------------------------------|--------------|
| 1 | `review` has no field for **Hide Review** and no date | **Added:** `is_hidden` and `created_at` (see #26) | – |
| 2 | `order` has no **checkout note** and no **payment status** (needed for GCash) | Sends `note` when placing an order, reads `_temp_note` and `_temp_payment_status` (`Unpaid` / `Paid`) | Add `note text` and `payment_stat text` |
| 3 | `prod_var.images` is one field but the product page shows several images | Stored as comma-separated URLs. `parseImages()` in `frontend/src/lib/images.ts` accepts a string or an array | Change to `text[]`, or add a `prod_var_image` table |
| 4 | No field for **failed login attempts** | The 5-attempt rule is kept in frontend state only, so a page refresh resets it | Count attempts on the backend, or rely on Supabase Auth rate limits |
| 5 | `review` links to `prod_var_id`, but the product page shows reviews for the whole product | `GET /products/{id}/reviews` is expected to return reviews from all variants of the product | Fine as is, just needs the join on the backend |

## Found while building

| # | Gap | What we assumed |
|---|-----|-----------------|
| 6 | **Best Sellers** and **Limited** collections have no field | Best Sellers = most units sold (cancelled orders not counted). Limited = has a promo running today. Could be a `collection` column instead |
| 7 | No **low-stock threshold** | `stocks <= 5`, set in `frontend/src/lib/constants.ts` |
| 8 | What `disc_amt` means is not defined, and there's no voucher or shipping fee | `subtotal` = sum of `b_price × qty`, `disc_amt` = promo savings, `total_amt` = sum of `order_item.sub_total` + delivery fee (₱100 for Standard Delivery, free for Store Pickup, see #18) |
| 9 | `order` doesn't save **who receives** the order (name, mobile), only `shipping_add` | Name and mobile confirmed at checkout are saved back to the `user` row. Old orders lose the receiver if the user edits their profile. Could add the name and mobile to the `shipping_add` text, or add columns |
| 10 | No timestamps for status changes (`shipped_at`, `delivered_at`) and no record of which admin changed it | Not shown anywhere yet |
| 11 | `user` and `order` are reserved words in Postgres | Always quoted as `"user"` and `"order"` in SQL. Renaming to `app_user` / `orders` would be easier for the backend |
| 12 | Naming mismatch: table `wishlist_col` but key `wishlist_coll_id` | Kept exactly as the ERD |
| 13 | No table for **password reset codes** | Supabase Auth can send the code (`resetPasswordForEmail` + `verifyOtp` with type `recovery`), so no table is needed |
| 14 | Deleting a product would break `order_item.prod_var_id` | `schema.sql` uses `on delete set null`; order history still shows `item_name` and `item_price` from the snapshot |
| 15 | Product images point to files in `frontend/public/images/products/` | Products from the inventory sheet (`backend/supabase/load_products.py`) already use Supabase Storage URLs. The demo products in `seed.sql` still use the local files |
| 16 | `item_categ` has one level, but the inventory sheet has a **subcategory** (e.g. Living Room → Sofa & Couches) | Categories are the rooms. The subcategory is kept in `products.json` but not saved; the API reads it from that file by product name and sends it as `_temp_subcategory` (home page category panel, products page `?sub=` filter). Products added in admin don't have one. Could add `parent_id` to `item_categ` |
| 17 | No fields for **specifications** (size, weight, material) | Added to the end of `prod_desc`, e.g. "Size: W55 x D74 x H85cm. Weight: 9kg. Material: Steel." Kept as separate fields in `products.json` in case columns are added |

| 18 | No fields for **fulfilment method** (Standard Delivery / Store Pickup), **courier**, or **delivery fee** on `order` | Checkout sends `fulfillment` and `courier`. The fee is added to `total_amt`, and the method + courier are written into `shipping_add`, e.g. "… (Standard Delivery via LBC)" or "Store pickup. …". Could add `fulfillment`, `courier` and `delivery_fee` columns |
| 19 | No field to **deactivate an account** | `POST /users/me/deactivate` bans the login in Supabase Auth (`ban_duration`), so the `user` row, orders and reviews stay. Login then says "This account has been deactivated". To undo it, remove the ban in the Supabase dashboard. Could add `is_active boolean` |
| 20 | No field for the **cancel reason** | `POST /orders/{id}/cancel` adds " [Cancelled by buyer: <reason>]" to the end of `shipping_add`, and Track Order reads it back. Could add `cancel_reason text` |
| 21 | No **refund** status or table | The Refund tab on Track Order is always empty, and "Request Refund" opens Contact Us with the order number. Could add a `refund` table (order, amount, status, reference) |
| 22 | No **delivery tracking** data (courier GPS, shipped/delivered times) | The rider on the tracking map is placed by the order status and how long ago it was placed (see #10). Could add `shipped_at`, `delivered_at` and a tracking number |
| 23 | No table for **Contact Us messages** | The form opens the customer's email app addressed to the store email. Could add a `message` table |

## Added for the admin panel (migrations/002_admin_panel.sql)

| # | Gap | What was added |
|---|-----|----------------|
| 24 | Only `customer` and `admin` roles, but the mockups have **Super Admin** and **Admin** | `super_admin` row in `user_role` (the check now allows it). Super Admins see Settings: manage admins, store info, security and the audit log |
| 25 | No way to **deactivate an admin** and show when | `"user".deactivated_at timestamptz`. The login is also banned in Supabase Auth (like #19) |
| 26 | `review` can't be **replied to, featured, or have photos** | `review.created_at`, `photos` (comma separated URLs), `reply`, `replied_at`, `is_featured`, `is_hidden` |
| 27 | No **audit log** of what admins change | `audit_log` table: who, what, IP address, device, when |
| 28 | No place for **store settings** (store info, policies, VAT, security) | `store_setting` table, one JSON value per section (`store`, `policies`, `regional`, `security`) |

Notes:
- Archiving a product uses the existing `product.is_avail` (false = archived, hidden from the store).
- "Require 2FA" is saved as a policy only; sign-in codes for admins aren't built yet.
- Policies (cancellation window, free shipping threshold, VAT) are saved and shown, but checkout doesn't apply them yet.

## Constraints added in schema.sql (no new columns)

These aren't new fields, just rules on the existing ones: `unique` on `sku`, `order_num`, `user.email`, one `cart` per user, one row per variant in a cart / wishlist, `check` on `rating` (1–5), `stocks >= 0`, `order_stat` and `payment_method` values.
