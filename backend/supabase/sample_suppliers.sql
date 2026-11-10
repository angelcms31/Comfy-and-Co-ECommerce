-- Sample suppliers, one per category, so the Suppliers & Defects page has something to work with.
-- The names are placeholders: rename them and add contact details in Admin > Suppliers & Defects > Suppliers.
-- Needs migrations/009_suppliers_defects.sql first. Safe to run more than once, and it never replaces a supplier
-- that a category already has.

insert into supplier (supplier_name) values
  ('Northwood Furniture Supply'),
  ('Casa Linaw Upholstery'),
  ('Workwell Office Furnishings'),
  ('Tidyspace Cabinet Works'),
  ('Hapag Home & Dining Co.')
on conflict (supplier_name) do nothing;

update item_categ c set supplier_id = s.supplier_id
from (values
  ('Bedroom', 'Northwood Furniture Supply'),
  ('Living Room', 'Casa Linaw Upholstery'),
  ('Home Office', 'Workwell Office Furnishings'),
  ('Room Storage', 'Tidyspace Cabinet Works'),
  ('Kitchen Dining', 'Hapag Home & Dining Co.')
) as pick (category, supplier)
join supplier s on s.supplier_name = pick.supplier
where c.item_category = pick.category and c.supplier_id is null;
