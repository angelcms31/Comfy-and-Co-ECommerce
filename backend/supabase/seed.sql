-- Sample data for Comfy&Co. Run schema.sql first.
-- Demo logins:  juan@comfyco.ph / password123 (customer)   admin@comfyco.ph / admin123 (admin)
-- Every customer in this file uses password123.
-- Dates were written around 2026-10-13.

begin;

-- auth accounts
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'juan@comfyco.ph',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Juan Dela Cruz"}', '2025-12-16T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '{"sub":"00000000-0000-4000-8000-000000000001","email":"juan@comfyco.ph","email_verified":true}', 'email', now(), now(), now());
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'maria.santos@gmail.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Maria Santos"}', '2025-12-31T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '{"sub":"00000000-0000-4000-8000-000000000002","email":"maria.santos@gmail.com","email_verified":true}', 'email', now(), now(), now());
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'jose.reyes@yahoo.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Jose Reyes"}', '2026-01-15T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', '{"sub":"00000000-0000-4000-8000-000000000003","email":"jose.reyes@yahoo.com","email_verified":true}', 'email', now(), now(), now());
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'andrea.bautista@gmail.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Andrea Bautista"}', '2026-01-30T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', '{"sub":"00000000-0000-4000-8000-000000000004","email":"andrea.bautista@gmail.com","email_verified":true}', 'email', now(), now(), now());
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'carlo.mendoza@gmail.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Carlo Mendoza"}', '2026-02-14T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', '{"sub":"00000000-0000-4000-8000-000000000005","email":"carlo.mendoza@gmail.com","email_verified":true}', 'email', now(), now(), now());
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'pat.villanueva@outlook.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Patricia Villanueva"}', '2026-03-01T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '{"sub":"00000000-0000-4000-8000-000000000006","email":"pat.villanueva@outlook.com","email_verified":true}', 'email', now(), now(), now());
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'miguel.ramos@gmail.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Miguel Ramos"}', '2026-03-16T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007', '{"sub":"00000000-0000-4000-8000-000000000007","email":"miguel.ramos@gmail.com","email_verified":true}', 'email', now(), now(), now());
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'kristine.aquino@gmail.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Kristine Aquino"}', '2026-03-31T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000008', '{"sub":"00000000-0000-4000-8000-000000000008","email":"kristine.aquino@gmail.com","email_verified":true}', 'email', now(), now(), now());
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'paolo.garcia@gmail.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Paolo Garcia"}', '2026-04-15T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000009', '{"sub":"00000000-0000-4000-8000-000000000009","email":"paolo.garcia@gmail.com","email_verified":true}', 'email', now(), now(), now());
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'bea.fernandez@gmail.com',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Bea Fernandez"}', '2026-04-30T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000010', '{"sub":"00000000-0000-4000-8000-000000000010","email":"bea.fernandez@gmail.com","email_verified":true}', 'email', now(), now(), now());
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'admin@comfyco.ph',
  extensions.crypt('admin123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Liza Navarro"}', '2026-05-15T01:00:00.000Z', now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000011', '{"sub":"00000000-0000-4000-8000-000000000011","email":"admin@comfyco.ph","email_verified":true}', 'email', now(), now(), now());

-- user_role
insert into user_role (user_role_id, user_role, date_added) values
  (1, 'customer', '2025-09-07T01:00:00.000Z'),
  (2, 'admin', '2025-09-07T01:00:00.000Z');

-- country
insert into country (country_id, country, date_added) values
  (1, 'Philippines', '2025-09-07T01:00:00.000Z');

-- city
insert into city (city_id, country_id, city, date_added) values
  (1, 1, 'Manila', '2025-09-07T01:00:00.000Z'),
  (2, 1, 'Quezon City', '2025-09-07T01:00:00.000Z'),
  (3, 1, 'Makati', '2025-09-07T01:00:00.000Z'),
  (4, 1, 'Pasig', '2025-09-07T01:00:00.000Z'),
  (5, 1, 'Taguig', '2025-09-07T01:00:00.000Z'),
  (6, 1, 'Mandaluyong', '2025-09-07T01:00:00.000Z'),
  (7, 1, 'Caloocan', '2025-09-07T01:00:00.000Z'),
  (8, 1, 'Parañaque', '2025-09-07T01:00:00.000Z'),
  (9, 1, 'Cebu City', '2025-09-07T01:00:00.000Z'),
  (10, 1, 'Davao City', '2025-09-07T01:00:00.000Z');

-- user
insert into "user" (user_id, user_role_id, full_name, birthdate, email, mobile_no, st_add, postal, city_id, date_added) values
  ('00000000-0000-4000-8000-000000000001', 1, 'Juan Dela Cruz', '1999-05-14', 'juan@comfyco.ph', '09171234567', '12 Sampaguita St., Brgy. San Antonio', '1600', 4, '2025-12-16T01:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000002', 1, 'Maria Santos', '1996-11-02', 'maria.santos@gmail.com', '09181112233', 'Unit 5B Lumiere Residences, Shaw Blvd.', '1600', 4, '2025-12-31T01:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000003', 1, 'Jose Reyes', '1990-02-20', 'jose.reyes@yahoo.com', '09192223344', '45 Katipunan Ave., Loyola Heights', '1100', 2, '2026-01-15T01:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000004', 1, 'Andrea Bautista', '1998-07-30', 'andrea.bautista@gmail.com', '09201234598', '88 Jupiter St., Bel-Air', '1200', 3, '2026-01-30T01:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000005', 1, 'Carlo Mendoza', '1993-03-09', 'carlo.mendoza@gmail.com', '09273456781', 'Blk 7 Lot 3 Mabuhay Homes, Brgy. Bagumbong', '1400', 7, '2026-02-14T01:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000006', 1, 'Patricia Villanueva', '1995-09-18', 'pat.villanueva@outlook.com', '09175556677', '21st Floor Uptown Parksuites, BGC', '1630', 5, '2026-03-01T01:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000007', 1, 'Miguel Ramos', '2000-01-25', 'miguel.ramos@gmail.com', '09062227788', '1023 Taft Ave., Malate', '1000', 1, '2026-03-16T01:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000008', 1, 'Kristine Aquino', '1997-12-12', 'kristine.aquino@gmail.com', '09358889900', '9 Banawa Heights, Brgy. Guadalupe', '6000', 9, '2026-03-31T01:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000009', 1, 'Paolo Garcia', '1992-06-06', 'paolo.garcia@gmail.com', '09451239876', '33 Dr. A. Santos Ave., Brgy. San Dionisio', '1700', 8, '2026-04-15T01:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000010', 1, 'Bea Fernandez', '2001-04-03', 'bea.fernandez@gmail.com', '09661472583', '14 Mabini St., Poblacion', '8000', 10, '2026-04-30T01:00:00.000Z'),
  ('00000000-0000-4000-8000-000000000011', 2, 'Liza Navarro', '1988-08-08', 'admin@comfyco.ph', '09170001111', 'Comfy&Co Office, 2F Ortigas Center', '1600', 4, '2026-05-15T01:00:00.000Z');

-- item_categ
insert into item_categ (item_categ_id, item_category, date_added) values
  (1, 'Sofas', '2025-09-27T01:00:00.000Z'),
  (2, 'Bedroom', '2025-09-27T01:00:00.000Z'),
  (3, 'Living Room', '2025-09-27T01:00:00.000Z'),
  (4, 'Mattresses', '2025-09-27T01:00:00.000Z'),
  (5, 'Kitchen Dining', '2025-09-27T01:00:00.000Z'),
  (6, 'Home Office', '2025-09-27T01:00:00.000Z'),
  (7, 'Room Storage', '2025-09-27T01:00:00.000Z');

-- product
insert into product (product_id, item_categ_id, product_name, prod_desc, is_avail) values
  (1, 1, '2P Sofa LB01', 'A compact two-seater with soft faux-leather upholstery and solid wood legs. Fits snugly in condos and small living rooms.', true),
  (2, 1, '3P Sofa Nordic Linen', 'Three-seater in breathable linen-blend fabric with removable seat covers for easy washing.', true),
  (3, 1, 'L-Shape Sofa Kalma', 'Reversible L-shape sofa with deep seats, made for long weekend movie marathons with the barkada.', true),
  (4, 2, 'NS-001 Bedframe with Drawers', 'Single bedframe with two pull-out storage drawers. Space-saving pick for dorms and kids'' rooms.', true),
  (5, 2, 'Haru Platform Bed Queen', 'Low-profile queen platform bed with a slatted base. No box spring needed.', true),
  (6, 2, 'Tala Bedside Table', 'Bedside table with one drawer and an open shelf for your books and phone charger.', true),
  (7, 3, 'Loft C-Frame Side Table', 'C-shaped side table that slides under the sofa. Steel frame with a wood-look top.', true),
  (8, 3, 'Mabini Coffee Table', 'Rounded-corner coffee table with a lower shelf for magazines and remotes.', true),
  (9, 3, 'DC Sazanami 2', 'Solid wood armchair with a thick, removable cushion. Comfortable for reading in the afternoon.', true),
  (10, 3, 'Lowline TV Board 150', '150 cm TV board with cable holes and three compartments for consoles and speakers.', true),
  (11, 4, 'Dream Pocket Spring Mattress', 'Individually wrapped pocket springs with a cool-touch cover. 10-year warranty.', true),
  (12, 4, 'Ulap Foam Topper', '5 cm memory foam topper that makes an old mattress feel new again.', true),
  (13, 5, 'DC N-Collection Chair', 'Windsor-style dining chair in solid rubberwood. Light, sturdy and easy to move.', true),
  (14, 5, 'Salu-Salo Dining Table 4-Seater', 'Four-seater dining table with rounded edges, made for everyday family meals.', true),
  (15, 5, 'Lifting Counter Chair', 'Height-adjustable counter chair with a swivel seat and a weighted round base.', true),
  (16, 5, 'Luto Kitchen Rack 3-Tier', 'Three-tier kitchen rack for the microwave, rice cooker and spices. Two sliding doors at the bottom.', true),
  (17, 6, 'Ergo-Flex Mesh Office Chair', 'Breathable mesh office chair with lumbar support and adjustable armrests, great for WFH.', true),
  (18, 6, 'Aral Study Desk 120', '120 cm desk with a side drawer unit and a cable tray. Big enough for a laptop and a monitor.', true),
  (19, 7, 'Chest PST2 3D', 'Three-drawer chest with fabric bins and a steel frame. Lightweight and easy to assemble.', true),
  (20, 7, 'Tago Shoe Cabinet', 'Slim two-door shoe cabinet with adjustable shelves. Holds up to 18 pairs.', true);

-- prod_var
insert into prod_var (prod_var_id, product_id, sku, prod_var_name, prod_attr, b_price, pr_price, pr_start, pr_end, stocks, is_avail, images, date_added) values
  (1, 1, 'SOF-001-BRO', '2P Sofa LB01 - Brown', 'Brown', 18500, 16900, '2026-09-30', '2026-10-30', 7, true, '/images/products/SOF-001-BRO-1.svg,/images/products/SOF-001-BRO-2.svg,/images/products/SOF-001-BRO-3.svg', '2026-03-26T01:00:00.000Z'),
  (2, 1, 'SOF-001-BLA', '2P Sofa LB01 - Black', 'Black', 18500, 16900, '2026-09-30', '2026-10-30', 3, true, '/images/products/SOF-001-BLA-1.svg,/images/products/SOF-001-BLA-2.svg,/images/products/SOF-001-BLA-3.svg', '2026-03-26T01:00:00.000Z'),
  (3, 1, 'SOF-001-GRA', '2P Sofa LB01 - Gray', 'Gray', 18500, null, null, null, 0, true, '/images/products/SOF-001-GRA-1.svg,/images/products/SOF-001-GRA-2.svg,/images/products/SOF-001-GRA-3.svg', '2026-03-26T01:00:00.000Z'),
  (4, 2, 'SOF-002-BEI', '3P Sofa Nordic Linen - Beige', 'Beige', 27900, null, null, null, 12, true, '/images/products/SOF-002-BEI-1.svg,/images/products/SOF-002-BEI-2.svg,/images/products/SOF-002-BEI-3.svg', '2026-03-31T01:00:00.000Z'),
  (5, 2, 'SOF-002-MOSGRE', '3P Sofa Nordic Linen - Moss Green', 'Moss Green', 27900, 24900, '2026-11-01', '2026-11-16', 5, true, '/images/products/SOF-002-MOSGRE-1.svg,/images/products/SOF-002-MOSGRE-2.svg,/images/products/SOF-002-MOSGRE-3.svg', '2026-03-31T01:00:00.000Z'),
  (6, 3, 'SOF-003-GRA', 'L-Shape Sofa Kalma - Gray', 'Gray', 42000, 37800, '2026-09-30', '2026-10-30', 4, true, '/images/products/SOF-003-GRA-1.svg,/images/products/SOF-003-GRA-2.svg,/images/products/SOF-003-GRA-3.svg', '2026-04-05T01:00:00.000Z'),
  (7, 3, 'SOF-003-NAV', 'L-Shape Sofa Kalma - Navy', 'Navy', 42000, null, null, null, 2, true, '/images/products/SOF-003-NAV-1.svg,/images/products/SOF-003-NAV-2.svg,/images/products/SOF-003-NAV-3.svg', '2026-04-05T01:00:00.000Z'),
  (8, 4, 'BED-004-NAT', 'NS-001 Bedframe with Drawers - Natural', 'Natural', 15900, null, null, null, 9, true, '/images/products/BED-004-NAT-1.svg,/images/products/BED-004-NAT-2.svg,/images/products/BED-004-NAT-3.svg', '2026-04-10T01:00:00.000Z'),
  (9, 4, 'BED-004-WAL', 'NS-001 Bedframe with Drawers - Walnut', 'Walnut', 16500, 14900, '2026-09-30', '2026-10-30', 6, true, '/images/products/BED-004-WAL-1.svg,/images/products/BED-004-WAL-2.svg,/images/products/BED-004-WAL-3.svg', '2026-04-10T01:00:00.000Z'),
  (10, 5, 'BED-005-OAK', 'Haru Platform Bed Queen - Oak', 'Oak', 21500, null, null, null, 5, true, '/images/products/BED-005-OAK-1.svg,/images/products/BED-005-OAK-2.svg,/images/products/BED-005-OAK-3.svg', '2026-04-15T01:00:00.000Z'),
  (11, 5, 'BED-005-WHI', 'Haru Platform Bed Queen - White', 'White', 21500, 19500, '2026-08-03', '2026-09-02', 8, true, '/images/products/BED-005-WHI-1.svg,/images/products/BED-005-WHI-2.svg,/images/products/BED-005-WHI-3.svg', '2026-04-15T01:00:00.000Z'),
  (12, 6, 'BST-006-OAK', 'Tala Bedside Table - Oak', 'Oak', 3490, null, null, null, 20, true, '/images/products/BST-006-OAK-1.svg,/images/products/BST-006-OAK-2.svg,/images/products/BST-006-OAK-3.svg', '2026-04-20T01:00:00.000Z'),
  (13, 6, 'BST-006-WHI', 'Tala Bedside Table - White', 'White', 3490, 2990, '2026-09-30', '2026-10-30', 14, true, '/images/products/BST-006-WHI-1.svg,/images/products/BST-006-WHI-2.svg,/images/products/BST-006-WHI-3.svg', '2026-04-20T01:00:00.000Z'),
  (14, 7, 'SDT-007-WAL', 'Loft C-Frame Side Table - Walnut', 'Walnut', 2990, null, null, null, 25, true, '/images/products/SDT-007-WAL-1.svg,/images/products/SDT-007-WAL-2.svg,/images/products/SDT-007-WAL-3.svg', '2026-04-25T01:00:00.000Z'),
  (15, 7, 'SDT-007-OAK', 'Loft C-Frame Side Table - Oak', 'Oak', 2990, 2490, '2026-09-30', '2026-10-30', 18, true, '/images/products/SDT-007-OAK-1.svg,/images/products/SDT-007-OAK-2.svg,/images/products/SDT-007-OAK-3.svg', '2026-04-25T01:00:00.000Z'),
  (16, 8, 'CFT-008-WAL', 'Mabini Coffee Table - Walnut', 'Walnut', 6800, null, null, null, 10, true, '/images/products/CFT-008-WAL-1.svg,/images/products/CFT-008-WAL-2.svg,/images/products/CFT-008-WAL-3.svg', '2026-04-30T01:00:00.000Z'),
  (17, 8, 'CFT-008-NAT', 'Mabini Coffee Table - Natural', 'Natural', 6800, null, null, null, 1, true, '/images/products/CFT-008-NAT-1.svg,/images/products/CFT-008-NAT-2.svg,/images/products/CFT-008-NAT-3.svg', '2026-04-30T01:00:00.000Z'),
  (18, 9, 'ARM-009-BRO', 'DC Sazanami 2 - Brown', 'Brown', 9800, 8900, '2026-09-30', '2026-10-30', 6, true, '/images/products/ARM-009-BRO-1.svg,/images/products/ARM-009-BRO-2.svg,/images/products/ARM-009-BRO-3.svg', '2026-05-05T01:00:00.000Z'),
  (19, 9, 'ARM-009-GRA', 'DC Sazanami 2 - Gray', 'Gray', 9800, null, null, null, 9, true, '/images/products/ARM-009-GRA-1.svg,/images/products/ARM-009-GRA-2.svg,/images/products/ARM-009-GRA-3.svg', '2026-05-05T01:00:00.000Z'),
  (20, 10, 'TVB-010-WAL', 'Lowline TV Board 150 - Walnut', 'Walnut', 11200, null, null, null, 7, true, '/images/products/TVB-010-WAL-1.svg,/images/products/TVB-010-WAL-2.svg,/images/products/TVB-010-WAL-3.svg', '2026-05-10T01:00:00.000Z'),
  (21, 10, 'TVB-010-WHI', 'Lowline TV Board 150 - White', 'White', 11200, 9900, '2026-11-01', '2026-11-16', 4, true, '/images/products/TVB-010-WHI-1.svg,/images/products/TVB-010-WHI-2.svg,/images/products/TVB-010-WHI-3.svg', '2026-05-10T01:00:00.000Z'),
  (22, 11, 'MAT-011-SIN', 'Dream Pocket Spring Mattress - Single', 'Single', 8900, null, null, null, 15, true, '/images/products/MAT-011-SIN-1.svg,/images/products/MAT-011-SIN-2.svg,/images/products/MAT-011-SIN-3.svg', '2026-05-15T01:00:00.000Z'),
  (23, 11, 'MAT-011-DOU', 'Dream Pocket Spring Mattress - Double', 'Double', 12900, 11500, '2026-09-30', '2026-10-30', 8, true, '/images/products/MAT-011-DOU-1.svg,/images/products/MAT-011-DOU-2.svg,/images/products/MAT-011-DOU-3.svg', '2026-05-15T01:00:00.000Z'),
  (24, 11, 'MAT-011-QUE', 'Dream Pocket Spring Mattress - Queen', 'Queen', 15900, 13900, '2026-09-30', '2026-10-30', 2, true, '/images/products/MAT-011-QUE-1.svg,/images/products/MAT-011-QUE-2.svg,/images/products/MAT-011-QUE-3.svg', '2026-05-15T01:00:00.000Z'),
  (25, 12, 'TOP-012-SIN', 'Ulap Foam Topper - Single', 'Single', 2800, null, null, null, 30, true, '/images/products/TOP-012-SIN-1.svg,/images/products/TOP-012-SIN-2.svg,/images/products/TOP-012-SIN-3.svg', '2026-05-20T01:00:00.000Z'),
  (26, 12, 'TOP-012-QUE', 'Ulap Foam Topper - Queen', 'Queen', 3900, null, null, null, 0, true, '/images/products/TOP-012-QUE-1.svg,/images/products/TOP-012-QUE-2.svg,/images/products/TOP-012-QUE-3.svg', '2026-05-20T01:00:00.000Z'),
  (27, 13, 'DCH-013-NAT', 'DC N-Collection Chair - Natural', 'Natural', 4250, null, null, null, 24, true, '/images/products/DCH-013-NAT-1.svg,/images/products/DCH-013-NAT-2.svg,/images/products/DCH-013-NAT-3.svg', '2026-05-25T01:00:00.000Z'),
  (28, 13, 'DCH-013-BRO', 'DC N-Collection Chair - Brown', 'Brown', 4250, 3750, '2026-09-30', '2026-10-30', 16, true, '/images/products/DCH-013-BRO-1.svg,/images/products/DCH-013-BRO-2.svg,/images/products/DCH-013-BRO-3.svg', '2026-05-25T01:00:00.000Z'),
  (29, 14, 'DTB-014-OAK', 'Salu-Salo Dining Table 4-Seater - Oak', 'Oak', 13500, null, null, null, 6, true, '/images/products/DTB-014-OAK-1.svg,/images/products/DTB-014-OAK-2.svg,/images/products/DTB-014-OAK-3.svg', '2026-05-30T01:00:00.000Z'),
  (30, 14, 'DTB-014-WAL', 'Salu-Salo Dining Table 4-Seater - Walnut', 'Walnut', 13900, null, null, null, 3, true, '/images/products/DTB-014-WAL-1.svg,/images/products/DTB-014-WAL-2.svg,/images/products/DTB-014-WAL-3.svg', '2026-05-30T01:00:00.000Z'),
  (31, 15, 'CTR-015-BRO', 'Lifting Counter Chair - Brown', 'Brown', 3750, null, null, null, 11, true, '/images/products/CTR-015-BRO-1.svg,/images/products/CTR-015-BRO-2.svg,/images/products/CTR-015-BRO-3.svg', '2026-06-04T01:00:00.000Z'),
  (32, 15, 'CTR-015-BLA', 'Lifting Counter Chair - Black', 'Black', 3750, 3290, '2026-08-03', '2026-09-02', 13, true, '/images/products/CTR-015-BLA-1.svg,/images/products/CTR-015-BLA-2.svg,/images/products/CTR-015-BLA-3.svg', '2026-06-04T01:00:00.000Z'),
  (33, 16, 'KTR-016-DARBRO', 'Luto Kitchen Rack 3-Tier - Dark Brown', 'Dark Brown', 7900, null, null, null, 5, true, '/images/products/KTR-016-DARBRO-1.svg,/images/products/KTR-016-DARBRO-2.svg,/images/products/KTR-016-DARBRO-3.svg', '2026-06-09T01:00:00.000Z'),
  (34, 16, 'KTR-016-WHI', 'Luto Kitchen Rack 3-Tier - White', 'White', 7900, 6900, '2026-09-30', '2026-10-30', 9, true, '/images/products/KTR-016-WHI-1.svg,/images/products/KTR-016-WHI-2.svg,/images/products/KTR-016-WHI-3.svg', '2026-06-09T01:00:00.000Z'),
  (35, 17, 'OFC-017-BLA', 'Ergo-Flex Mesh Office Chair - Black', 'Black', 8500, 7200, '2026-09-30', '2026-10-30', 10, true, '/images/products/OFC-017-BLA-1.svg,/images/products/OFC-017-BLA-2.svg,/images/products/OFC-017-BLA-3.svg', '2026-06-14T01:00:00.000Z'),
  (36, 17, 'OFC-017-GRA', 'Ergo-Flex Mesh Office Chair - Gray', 'Gray', 8500, null, null, null, 3, true, '/images/products/OFC-017-GRA-1.svg,/images/products/OFC-017-GRA-2.svg,/images/products/OFC-017-GRA-3.svg', '2026-06-14T01:00:00.000Z'),
  (37, 18, 'DSK-018-OAK', 'Aral Study Desk 120 - Oak', 'Oak', 6900, null, null, null, 12, true, '/images/products/DSK-018-OAK-1.svg,/images/products/DSK-018-OAK-2.svg,/images/products/DSK-018-OAK-3.svg', '2026-06-19T01:00:00.000Z'),
  (38, 18, 'DSK-018-WHI', 'Aral Study Desk 120 - White', 'White', 6900, null, null, null, 8, true, '/images/products/DSK-018-WHI-1.svg,/images/products/DSK-018-WHI-2.svg,/images/products/DSK-018-WHI-3.svg', '2026-06-19T01:00:00.000Z'),
  (39, 19, 'CHS-019-BLA', 'Chest PST2 3D - Black', 'Black', 2450, null, null, null, 22, true, '/images/products/CHS-019-BLA-1.svg,/images/products/CHS-019-BLA-2.svg,/images/products/CHS-019-BLA-3.svg', '2026-06-24T01:00:00.000Z'),
  (40, 19, 'CHS-019-GRA', 'Chest PST2 3D - Gray', 'Gray', 2450, 1990, '2026-09-30', '2026-10-30', 2, true, '/images/products/CHS-019-GRA-1.svg,/images/products/CHS-019-GRA-2.svg,/images/products/CHS-019-GRA-3.svg', '2026-06-24T01:00:00.000Z'),
  (41, 20, 'CAB-020-WAL', 'Tago Shoe Cabinet - Walnut', 'Walnut', 5600, null, null, null, 4, true, '/images/products/CAB-020-WAL-1.svg,/images/products/CAB-020-WAL-2.svg,/images/products/CAB-020-WAL-3.svg', '2026-06-29T01:00:00.000Z'),
  (42, 20, 'CAB-020-WHI', 'Tago Shoe Cabinet - White', 'White', 5600, null, null, null, 0, true, '/images/products/CAB-020-WHI-1.svg,/images/products/CAB-020-WHI-2.svg,/images/products/CAB-020-WHI-3.svg', '2026-06-29T01:00:00.000Z');

-- wishlist_col
insert into wishlist_col (wishlist_coll_id, user_id, created_at) values
  (1, '00000000-0000-4000-8000-000000000001', '2026-09-12T01:00:00.000Z');

-- wishlist_item
insert into wishlist_item (wishlist_item_id, wishlist_coll_id, prod_var_id, created_at) values
  (1, 1, 5, '2026-09-12T01:00:00.000Z'),
  (2, 1, 20, '2026-09-27T01:00:00.000Z'),
  (3, 1, 35, '2026-10-08T01:00:00.000Z');

-- cart
insert into cart (cart_id, user_id, created_at) values
  (1, '00000000-0000-4000-8000-000000000001', '2026-09-22T01:00:00.000Z');

-- cart_item
insert into cart_item (cart_item_id, cart_id, prod_var_id, quantity) values
  (1, 1, 19, 1),
  (2, 1, 25, 2);

-- order
insert into "order" (order_id, order_num, user_id, order_stat, subtotal, disc_amt, total_amt, payment_method, shipping_add, placed_at) values
  (1, 'ORD-1001', '00000000-0000-4000-8000-000000000002', 'Delivered', 21490, 0, 21490, 'GCash', 'Unit 5B Lumiere Residences, Shaw Blvd., Pasig, 1600, Philippines', '2026-09-29T02:00:00.000Z'),
  (2, 'ORD-1002', '00000000-0000-4000-8000-000000000003', 'Delivered', 30500, 0, 30500, 'COD', '45 Katipunan Ave., Loyola Heights, Quezon City, 1100, Philippines', '2026-09-30T06:17:00.000Z'),
  (3, 'ORD-1003', '00000000-0000-4000-8000-000000000001', 'Delivered', 19390, 0, 19390, 'GCash', '12 Sampaguita St., Brgy. San Antonio, Pasig, 1600, Philippines', '2026-10-01T11:34:00.000Z'),
  (4, 'ORD-1004', '00000000-0000-4000-8000-000000000004', 'Cancelled', 42000, 4200, 37800, 'COD', '88 Jupiter St., Bel-Air, Makati, 1200, Philippines', '2026-10-02T03:51:00.000Z'),
  (5, 'ORD-1005', '00000000-0000-4000-8000-000000000005', 'Delivered', 11700, 0, 11700, 'COD', 'Blk 7 Lot 3 Mabuhay Homes, Brgy. Bagumbong, Caloocan, 1400, Philippines', '2026-10-03T08:08:00.000Z'),
  (6, 'ORD-1006', '00000000-0000-4000-8000-000000000006', 'Delivered', 15400, 1300, 14100, 'GCash', '21st Floor Uptown Parksuites, BGC, Taguig, 1630, Philippines', '2026-10-04T01:25:00.000Z'),
  (7, 'ORD-1007', '00000000-0000-4000-8000-000000000007', 'Delivered', 16600, 900, 15700, 'GCash', '1023 Taft Ave., Malate, Manila, 1000, Philippines', '2026-10-06T05:42:00.000Z'),
  (8, 'ORD-1008', '00000000-0000-4000-8000-000000000001', 'Delivered', 8500, 1000, 7500, 'COD', '12 Sampaguita St., Brgy. San Antonio, Pasig, 1600, Philippines', '2026-10-06T12:59:00.000Z'),
  (9, 'ORD-1009', '00000000-0000-4000-8000-000000000008', 'Shipped', 27900, 0, 27900, 'GCash', '9 Banawa Heights, Brgy. Guadalupe, Cebu City, 6000, Philippines', '2026-10-07T02:16:00.000Z'),
  (10, 'ORD-1010', '00000000-0000-4000-8000-000000000009', 'Cancelled', 11200, 0, 11200, 'GCash', '33 Dr. A. Santos Ave., Brgy. San Dionisio, Parañaque, 1700, Philippines', '2026-10-07T07:33:00.000Z'),
  (11, 'ORD-1011', '00000000-0000-4000-8000-000000000010', 'Shipped', 17800, 1400, 16400, 'COD', '14 Mabini St., Poblacion, Davao City, 8000, Philippines', '2026-10-08T04:50:00.000Z'),
  (12, 'ORD-1012', '00000000-0000-4000-8000-000000000002', 'Shipped', 10730, 1000, 9730, 'GCash', 'Unit 5B Lumiere Residences, Shaw Blvd., Pasig, 1600, Philippines', '2026-10-09T01:07:00.000Z'),
  (13, 'ORD-1013', '00000000-0000-4000-8000-000000000003', 'Shipped', 26400, 1600, 24800, 'COD', '45 Katipunan Ave., Loyola Heights, Quezon City, 1100, Philippines', '2026-10-09T10:24:00.000Z'),
  (14, 'ORD-1014', '00000000-0000-4000-8000-000000000001', 'Shipped', 10950, 460, 10490, 'GCash', '12 Sampaguita St., Brgy. San Antonio, Pasig, 1600, Philippines', '2026-10-10T03:41:00.000Z'),
  (15, 'ORD-1015', '00000000-0000-4000-8000-000000000004', 'Pending', 16500, 1600, 14900, 'COD', '88 Jupiter St., Bel-Air, Makati, 1200, Philippines', '2026-10-10T09:58:00.000Z'),
  (16, 'ORD-1016', '00000000-0000-4000-8000-000000000005', 'Pending', 23700, 0, 23700, 'GCash', 'Blk 7 Lot 3 Mabuhay Homes, Brgy. Bagumbong, Caloocan, 1400, Philippines', '2026-10-11T02:15:00.000Z'),
  (17, 'ORD-1017', '00000000-0000-4000-8000-000000000006', 'Cancelled', 21500, 0, 21500, 'COD', '21st Floor Uptown Parksuites, BGC, Taguig, 1630, Philippines', '2026-10-11T13:32:00.000Z'),
  (18, 'ORD-1018', '00000000-0000-4000-8000-000000000007', 'Pending', 42000, 4200, 37800, 'GCash', '1023 Taft Ave., Malate, Manila, 1000, Philippines', '2026-10-12T01:49:00.000Z'),
  (19, 'ORD-1019', '00000000-0000-4000-8000-000000000008', 'Pending', 18890, 2500, 16390, 'COD', '9 Banawa Heights, Brgy. Guadalupe, Cebu City, 6000, Philippines', '2026-10-12T03:06:00.000Z'),
  (20, 'ORD-1020', '00000000-0000-4000-8000-000000000001', 'Pending', 19100, 1000, 18100, 'COD', '12 Sampaguita St., Brgy. San Antonio, Pasig, 1600, Philippines', '2026-10-12T05:23:00.000Z');

-- order_item
insert into order_item (order_item_id, order_id, prod_var_id, item_name, item_price, quantity, sub_total) values
  (1, 1, 1, '2P Sofa LB01 - Brown', 18500, 1, 18500),
  (2, 1, 14, 'Loft C-Frame Side Table - Walnut', 2990, 1, 2990),
  (3, 2, 27, 'DC N-Collection Chair - Natural', 4250, 4, 17000),
  (4, 2, 29, 'Salu-Salo Dining Table 4-Seater - Oak', 13500, 1, 13500),
  (5, 3, 8, 'NS-001 Bedframe with Drawers - Natural', 15900, 1, 15900),
  (6, 3, 12, 'Tala Bedside Table - Oak', 3490, 1, 3490),
  (7, 4, 6, 'L-Shape Sofa Kalma - Gray', 37800, 1, 37800),
  (8, 5, 22, 'Dream Pocket Spring Mattress - Single', 8900, 1, 8900),
  (9, 5, 25, 'Ulap Foam Topper - Single', 2800, 1, 2800),
  (10, 6, 35, 'Ergo-Flex Mesh Office Chair - Black', 7200, 1, 7200),
  (11, 6, 37, 'Aral Study Desk 120 - Oak', 6900, 1, 6900),
  (12, 7, 18, 'DC Sazanami 2 - Brown', 8900, 1, 8900),
  (13, 7, 16, 'Mabini Coffee Table - Walnut', 6800, 1, 6800),
  (14, 8, 28, 'DC N-Collection Chair - Brown', 3750, 2, 7500),
  (15, 9, 4, '3P Sofa Nordic Linen - Beige', 27900, 1, 27900),
  (16, 10, 20, 'Lowline TV Board 150 - Walnut', 11200, 1, 11200),
  (17, 11, 23, 'Dream Pocket Spring Mattress - Double', 11500, 1, 11500),
  (18, 11, 39, 'Chest PST2 3D - Black', 2450, 2, 4900),
  (19, 12, 31, 'Lifting Counter Chair - Brown', 3750, 1, 3750),
  (20, 12, 13, 'Tala Bedside Table - White', 2990, 2, 5980),
  (21, 13, 33, 'Luto Kitchen Rack 3-Tier - Dark Brown', 7900, 1, 7900),
  (22, 13, 2, '2P Sofa LB01 - Black', 16900, 1, 16900),
  (23, 14, 36, 'Ergo-Flex Mesh Office Chair - Gray', 8500, 1, 8500),
  (24, 14, 40, 'Chest PST2 3D - Gray', 1990, 1, 1990),
  (25, 15, 9, 'NS-001 Bedframe with Drawers - Walnut', 14900, 1, 14900),
  (26, 16, 19, 'DC Sazanami 2 - Gray', 9800, 1, 9800),
  (27, 16, 30, 'Salu-Salo Dining Table 4-Seater - Walnut', 13900, 1, 13900),
  (28, 17, 10, 'Haru Platform Bed Queen - Oak', 21500, 1, 21500),
  (29, 18, 6, 'L-Shape Sofa Kalma - Gray', 37800, 1, 37800),
  (30, 19, 24, 'Dream Pocket Spring Mattress - Queen', 13900, 1, 13900),
  (31, 19, 15, 'Loft C-Frame Side Table - Oak', 2490, 1, 2490),
  (32, 20, 21, 'Lowline TV Board 150 - White', 11200, 1, 11200),
  (33, 20, 34, 'Luto Kitchen Rack 3-Tier - White', 6900, 1, 6900);

-- review
insert into review (review_id, user_id, prod_var_id, rating, content) values
  (1, '00000000-0000-4000-8000-000000000002', 1, 5, 'Sobrang ganda ng sofa! Swak na swak sa condo namin. Sulit sa presyo.'),
  (2, '00000000-0000-4000-8000-000000000002', 14, 4, 'Nice side table, kasya sa ilalim ng sofa. Medyo matagal lang ang delivery.'),
  (3, '00000000-0000-4000-8000-000000000003', 27, 5, 'Bought four for our dining area. Matibay and easy to clean.'),
  (4, '00000000-0000-4000-8000-000000000003', 29, 4, 'Solid dining table. Rounded edges are great kasi may toddler kami.'),
  (5, '00000000-0000-4000-8000-000000000001', 8, 5, 'Love the drawers under the bed, ang laking tulong sa storage!'),
  (6, '00000000-0000-4000-8000-000000000001', 12, 5, 'Perfect size for my bedside. Fast delivery too.'),
  (7, '00000000-0000-4000-8000-000000000005', 22, 3, 'Okay naman, medyo firm for me. Maganda yung cover though.'),
  (8, '00000000-0000-4000-8000-000000000005', 25, 5, 'Napakasarap matulog! Parang hotel ang feel.'),
  (9, '00000000-0000-4000-8000-000000000006', 35, 5, 'Best WFH purchase this year. Wala nang sakit sa likod.'),
  (10, '00000000-0000-4000-8000-000000000006', 37, 4, 'Solid desk. Wish it came with a monitor shelf.'),
  (11, '00000000-0000-4000-8000-000000000007', 18, 5, 'Ang cozy ng armchair, dito na ako palaging nagbabasa.'),
  (12, '00000000-0000-4000-8000-000000000007', 16, 2, 'Nice table but may gasgas pagdating. Customer service replaced it naman.'),
  (13, '00000000-0000-4000-8000-000000000001', 28, 4, 'Cute dining chairs, light lang kaya madaling ilipat.'),
  (14, '00000000-0000-4000-8000-000000000008', 4, 5, 'Very elegant! Matches our living room perfectly.'),
  (15, '00000000-0000-4000-8000-000000000010', 23, 4, 'Comfy mattress for the price. Walang ingay yung springs.'),
  (16, '00000000-0000-4000-8000-000000000002', 31, 5, 'Mabilis dumating and maayos ang pagkaka-pack. Recommended!'),
  (17, '00000000-0000-4000-8000-000000000003', 2, 1, 'visit my shop for cheap sofas!!! pm me'),
  (18, '00000000-0000-4000-8000-000000000009', 9, 4, 'Maganda ang kulay ng walnut, mukhang mamahalin.');

-- move the id counters past the seeded rows
select setval(pg_get_serial_sequence('user_role', 'user_role_id'), (select max(user_role_id) from user_role));
select setval(pg_get_serial_sequence('country', 'country_id'), (select max(country_id) from country));
select setval(pg_get_serial_sequence('city', 'city_id'), (select max(city_id) from city));
select setval(pg_get_serial_sequence('item_categ', 'item_categ_id'), (select max(item_categ_id) from item_categ));
select setval(pg_get_serial_sequence('product', 'product_id'), (select max(product_id) from product));
select setval(pg_get_serial_sequence('prod_var', 'prod_var_id'), (select max(prod_var_id) from prod_var));
select setval(pg_get_serial_sequence('wishlist_col', 'wishlist_coll_id'), (select max(wishlist_coll_id) from wishlist_col));
select setval(pg_get_serial_sequence('wishlist_item', 'wishlist_item_id'), (select max(wishlist_item_id) from wishlist_item));
select setval(pg_get_serial_sequence('cart', 'cart_id'), (select max(cart_id) from cart));
select setval(pg_get_serial_sequence('cart_item', 'cart_item_id'), (select max(cart_item_id) from cart_item));
select setval(pg_get_serial_sequence('"order"', 'order_id'), (select max(order_id) from "order"));
select setval(pg_get_serial_sequence('order_item', 'order_item_id'), (select max(order_item_id) from order_item));
select setval(pg_get_serial_sequence('review', 'review_id'), (select max(review_id) from review));

commit;
