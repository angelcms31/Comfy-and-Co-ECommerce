# Schema gaps

Things the screens need that the ERD doesn't have yet. Nothing here has been added to `backend/supabase/schema.sql`. The group should decide on each one.

Fields the frontend reads that are not in the ERD start with `_temp_`, so they're easy to find and rename later.

## From the project spec

| # | Gap | What the frontend does for now | Possible fix |
|---|-----|-------------------------------|--------------|
| 1 | `review` has no field for **Hide Review** and no date | Reads `_temp_is_hidden` and `_temp_created_at` if the API sends them | Add `is_hidden boolean default false` and `created_at timestamptz default now()` |
| 2 | `order` has no **checkout note** and no **payment status** (needed for GCash) | Sends `note` when placing an order, reads `_temp_note` and `_temp_payment_status` (`Unpaid` / `Paid`) | Add `note text` and `payment_stat text` |
| 3 | `prod_var.images` is one field but the product page shows several images | Stored as comma-separated URLs. `parseImages()` in `frontend/src/lib/images.ts` accepts a string or an array | Change to `text[]`, or add a `prod_var_image` table |
| 4 | No field for **failed login attempts** | The 3-attempt rule is kept in frontend state only, so a page refresh resets it | Count attempts on the backend, or rely on Supabase Auth rate limits |
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
| 16 | `item_categ` has one level, but the inventory sheet has a **subcategory** (e.g. Living Room → Sofa & Couches) | Categories are the rooms. The subcategory is kept in `products.json` but not saved. Could add `parent_id` to `item_categ` |
| 17 | No fields for **specifications** (size, weight, material) | Added to the end of `prod_desc`, e.g. "Size: W55 x D74 x H85cm. Weight: 9kg. Material: Steel." Kept as separate fields in `products.json` in case columns are added |

| 18 | No fields for **fulfilment method** (Standard Delivery / Store Pickup), **courier**, or **delivery fee** on `order` | Checkout sends `fulfillment` and `courier`. The fee is added to `total_amt`, and the method + courier are written into `shipping_add`, e.g. "… (Standard Delivery via LBC)" or "Store pickup. …". Could add `fulfillment`, `courier` and `delivery_fee` columns |
| 19 | No field to **deactivate an account** | `POST /users/me/deactivate` bans the login in Supabase Auth (`ban_duration`), so the `user` row, orders and reviews stay. Login then says "This account has been deactivated". To undo it, remove the ban in the Supabase dashboard. Could add `is_active boolean` |

## Constraints added in schema.sql (no new columns)

These aren't new fields, just rules on the existing ones: `unique` on `sku`, `order_num`, `user.email`, one `cart` per user, one row per variant in a cart / wishlist, `check` on `rating` (1–5), `stocks >= 0`, `order_stat` and `payment_method` values.
