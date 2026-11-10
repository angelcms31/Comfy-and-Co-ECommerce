"""Suppliers (one per category) and item issue reports (defective items), for the admin Suppliers page."""

from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg import errors

from .. import audit
from ..db import Db
from ..deps import require_admin
from ..schemas import CategorySupplierIn, DefectIn, DefectStatusIn, PurchaseOrderIn, PurchaseOrderPatch, ReceiveIn, SupplierIn
from .admin import images_text

router = APIRouter(prefix="/admin", tags=["defects"], dependencies=[Depends(require_admin)])

OPEN_STATUSES = ("Reported", "Returned to supplier")
# Reported -> Returned to supplier -> Replaced / Credited. Reported -> Credited when the supplier credits without a return.
STATUS_NEXT = {
    "Reported": {"Returned to supplier", "Credited"},
    "Returned to supplier": {"Replaced", "Credited"},
    "Replaced": set(),
    "Credited": set(),
}


# ---------- suppliers ----------

SUPPLIER_SELECT = """
    select s.*,
      coalesce((select array_agg(c.item_category order by c.item_category) from item_categ c where c.supplier_id = s.supplier_id), '{}') as categories,
      (select count(*) from defect_report d where d.supplier_id = s.supplier_id) as report_count,
      (select count(*) from defect_report d where d.supplier_id = s.supplier_id and d.status = any(%s)) as open_count,
      (select coalesce(sum(d.quantity), 0) from defect_report d where d.supplier_id = s.supplier_id) as defective_units,
      (select count(*) from purchase_order po where po.supplier_id = s.supplier_id and po.status in ('Ordered', 'Partly received')) as open_po_count,
      -- units sold from the categories this supplier has now, for the defect rate
      (select coalesce(sum(oi.quantity), 0)
         from order_item oi join "order" o on o.order_id = oi.order_id
         join prod_var v on v.prod_var_id = oi.prod_var_id
         join product p on p.product_id = v.product_id
         join item_categ c on c.item_categ_id = p.item_categ_id
        where c.supplier_id = s.supplier_id and o.order_stat not in ('Cancelled', 'Returned')) as units_sold
    from supplier s
"""


def supplier_or_404(db, supplier_id: int) -> dict:
    row = db.execute(f"{SUPPLIER_SELECT} where s.supplier_id = %s", (list(OPEN_STATUSES), supplier_id)).fetchone()
    if not row:
        raise HTTPException(404, "Supplier not found")
    return row


@router.get("/suppliers")
def list_suppliers(db: Db):
    suppliers = db.execute(f"{SUPPLIER_SELECT} order by s.is_active desc, s.supplier_name", (list(OPEN_STATUSES),)).fetchall()
    categories = db.execute(
        """
        select c.item_categ_id, c.item_category, c.supplier_id,
          (select count(*) from product p where p.item_categ_id = c.item_categ_id) as product_count
        from item_categ c order by c.item_category
        """
    ).fetchall()
    return {"suppliers": suppliers, "categories": categories}


def save_supplier(db, supplier_id: int | None, body: SupplierIn) -> int:
    values = (body.supplier_name.strip(), body.contact_person, body.phone, body.email, body.address, body.is_active)
    try:
        if supplier_id is None:
            return db.execute(
                """
                insert into supplier (supplier_name, contact_person, phone, email, address, is_active)
                values (%s, %s, %s, %s, %s, %s) returning supplier_id
                """,
                values,
            ).fetchone()["supplier_id"]
        db.execute(
            """
            update supplier set supplier_name = %s, contact_person = %s, phone = %s, email = %s, address = %s, is_active = %s
            where supplier_id = %s
            """,
            (*values, supplier_id),
        )
        return supplier_id
    except errors.UniqueViolation:
        raise HTTPException(400, "There's already a supplier with this name")


@router.post("/suppliers")
def add_supplier(db: Db, request: Request, body: SupplierIn, user=Depends(require_admin)):
    supplier_id = save_supplier(db, None, body)
    audit.log(db, request, user, f"Added supplier: {body.supplier_name.strip()}")
    return supplier_or_404(db, supplier_id)


@router.put("/suppliers/{supplier_id}")
def edit_supplier(db: Db, request: Request, supplier_id: int, body: SupplierIn, user=Depends(require_admin)):
    supplier_or_404(db, supplier_id)
    save_supplier(db, supplier_id, body)
    audit.log(db, request, user, f"Edited supplier: {body.supplier_name.strip()}")
    return supplier_or_404(db, supplier_id)


@router.put("/categories/{item_categ_id}/supplier")
def set_category_supplier(db: Db, request: Request, item_categ_id: int, body: CategorySupplierIn, user=Depends(require_admin)):
    category = db.execute("select item_category from item_categ where item_categ_id = %s", (item_categ_id,)).fetchone()
    if not category:
        raise HTTPException(404, "Category not found")
    name = "no supplier"
    if body.supplier_id is not None:
        supplier = db.execute("select supplier_name, is_active from supplier where supplier_id = %s", (body.supplier_id,)).fetchone()
        if not supplier:
            raise HTTPException(404, "Supplier not found")
        if not supplier["is_active"]:
            raise HTTPException(400, "This supplier is inactive. Set it active first")
        name = supplier["supplier_name"]
    db.execute("update item_categ set supplier_id = %s where item_categ_id = %s", (body.supplier_id, item_categ_id))
    audit.log(db, request, user, f"Set supplier of {category['item_category']} to {name}")
    return list_suppliers(db)


# ---------- defect reports ----------

DEFECT_SELECT = """
    select d.*, o.order_num, u.full_name as reported_by_name
    from defect_report d
    left join "order" o on o.order_id = d.order_id
    left join "user" u on u.user_id = d.reported_by
"""


def defect_or_404(db, defect_id: int) -> dict:
    row = db.execute(f"{DEFECT_SELECT} where d.defect_id = %s", (defect_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Item issue not found")
    return row


@router.get("/defects")
def list_defects(db: Db):
    # open ones first, then newest; filters and search are done on the page
    return db.execute(f"{DEFECT_SELECT} order by (d.status = any(%s)) desc, d.created_at desc limit 500", (list(OPEN_STATUSES),)).fetchall()


@router.get("/defects/order/{order_id}")
def defect_from_order(db: Db, order_id: int):
    # "Report issue to supplier" on a refund: the order's items and the customer's photos to start the report with
    order = db.execute(
        """
        select o.order_id, o.order_num, u.full_name as customer_name, r.reason, r.details, r.photos
        from "order" o join "user" u on u.user_id = o.user_id
        left join refund r on r.order_id = o.order_id
        where o.order_id = %s
        """,
        (order_id,),
    ).fetchone()
    if not order:
        raise HTTPException(404, "Order not found")
    order["items"] = db.execute(
        "select prod_var_id, item_name, quantity from order_item where order_id = %s and prod_var_id is not null order by order_item_id",
        (order_id,),
    ).fetchall()
    return order


@router.post("/defects")
def report_defect(db: Db, request: Request, body: DefectIn, user=Depends(require_admin)):
    variant = db.execute(
        """
        select v.prod_var_id, v.sku, v.stocks, v.prod_attr, p.product_name, s.supplier_id, s.supplier_name
        from prod_var v
        join product p on p.product_id = v.product_id
        join item_categ c on c.item_categ_id = p.item_categ_id
        left join supplier s on s.supplier_id = c.supplier_id
        where v.prod_var_id = %s
        for update of v
        """,
        (body.prod_var_id,),
    ).fetchone()
    if not variant:
        raise HTTPException(404, "Product not found")

    order_id = None
    if body.source == "customer_return":
        if not body.order_id:
            raise HTTPException(400, "Pick the customer's order")
        in_order = db.execute(
            "select 1 from order_item where order_id = %s and prod_var_id = %s", (body.order_id, body.prod_var_id)
        ).fetchone()
        if not in_order:
            raise HTTPException(400, "This item isn't in that order")
        order_id = body.order_id

    if body.source == "storage":
        # found in the stockroom: these units can't be sold anymore
        if variant["stocks"] < body.quantity:
            raise HTTPException(400, f"Only {variant['stocks']} in stock, so {body.quantity} can't be taken out")
        db.execute("update prod_var set stocks = stocks - %s where prod_var_id = %s", (body.quantity, body.prod_var_id))

    item_name = f"{variant['product_name']} ({variant['prod_attr']})" if variant["prod_attr"] else variant["product_name"]
    defect_id = db.execute(
        """
        insert into defect_report
          (prod_var_id, item_name, sku, supplier_id, supplier_name, quantity, defect_type, source, order_id, notes, photos, reported_by)
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        returning defect_id
        """,
        (
            body.prod_var_id,
            item_name,
            variant["sku"],
            variant["supplier_id"],
            variant["supplier_name"],
            body.quantity,
            body.defect_type.strip(),
            body.source,
            order_id,
            (body.notes or "").strip() or None,
            images_text(body.photos),
            user["user_id"],
        ),
    ).fetchone()["defect_id"]
    supplier = variant["supplier_name"] or "no supplier set"
    audit.log(db, request, user, f"Reported item issue #ISS-{defect_id}: {body.quantity} × {item_name} ({supplier})")
    return defect_or_404(db, defect_id)


@router.patch("/defects/{defect_id}")
def update_defect(db: Db, request: Request, defect_id: int, body: DefectStatusIn, user=Depends(require_admin)):
    defect = db.execute("select * from defect_report where defect_id = %s for update", (defect_id,)).fetchone()
    if not defect:
        raise HTTPException(404, "Item issue not found")

    if body.status != defect["status"]:
        if body.status not in STATUS_NEXT[defect["status"]]:
            if not STATUS_NEXT[defect["status"]]:
                raise HTTPException(400, f"This report is already {defect['status'].lower()}")
            raise HTTPException(400, f"A report can't go from {defect['status']} to {body.status}")
        if body.status == "Replaced" and defect["prod_var_id"]:
            # the supplier's replacement units arrived, they can be sold
            db.execute("update prod_var set stocks = stocks + %s where prod_var_id = %s", (defect["quantity"], defect["prod_var_id"]))
        db.execute("update defect_report set status = %s, updated_at = now() where defect_id = %s", (body.status, defect_id))
        audit.log(db, request, user, f"Changed item issue #ISS-{defect_id} to {body.status}")

    if body.notes is not None and body.notes.strip() != (defect["notes"] or ""):
        db.execute("update defect_report set notes = %s, updated_at = now() where defect_id = %s", (body.notes.strip() or None, defect_id))
    return defect_or_404(db, defect_id)


# ---------- restock orders ----------

PO_OPEN = ("Ordered", "Partly received")
PO_SELECT = """
    select po.*, u.full_name as created_by_name,
      coalesce((select json_agg(json_build_object(
          'po_item_id', i.po_item_id, 'prod_var_id', i.prod_var_id, 'item_name', i.item_name, 'sku', i.sku,
          'quantity', i.quantity, 'unit_cost', i.unit_cost, 'received_qty', i.received_qty, 'damaged_qty', i.damaged_qty)
          order by i.po_item_id)
        from purchase_order_item i where i.po_id = po.po_id), '[]') as items
    from purchase_order po
    left join "user" u on u.user_id = po.created_by
"""


def po_or_404(db, po_id: int) -> dict:
    row = db.execute(f"{PO_SELECT} where po.po_id = %s", (po_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Restock order not found")
    return row


@router.get("/purchase-orders")
def list_purchase_orders(db: Db):
    # open ones first, then newest
    return db.execute(f"{PO_SELECT} order by (po.status = any(%s)) desc, po.created_at desc limit 300", (list(PO_OPEN),)).fetchall()


@router.post("/purchase-orders")
def create_purchase_order(db: Db, request: Request, body: PurchaseOrderIn, user=Depends(require_admin)):
    supplier = db.execute("select supplier_name, is_active from supplier where supplier_id = %s", (body.supplier_id,)).fetchone()
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    if not supplier["is_active"]:
        raise HTTPException(400, "This supplier is inactive. Set it active first")

    ids = [i.prod_var_id for i in body.items]
    variants = {
        v["prod_var_id"]: v
        for v in db.execute(
            """
            select v.prod_var_id, v.sku, v.prod_attr, p.product_name, c.supplier_id
            from prod_var v
            join product p on p.product_id = v.product_id
            join item_categ c on c.item_categ_id = p.item_categ_id
            where v.prod_var_id = any(%s)
            """,
            (ids,),
        ).fetchall()
    }
    for item in body.items:
        v = variants.get(item.prod_var_id)
        if not v:
            raise HTTPException(404, "One of the items no longer exists")
        if v["supplier_id"] != body.supplier_id:
            raise HTTPException(400, f"{v['product_name']} isn't supplied by {supplier['supplier_name']}")

    po_id = db.execute(
        """
        insert into purchase_order (supplier_id, supplier_name, expected_date, notes, created_by)
        values (%s, %s, %s, %s, %s) returning po_id
        """,
        (body.supplier_id, supplier["supplier_name"], body.expected_date, (body.notes or "").strip() or None, user["user_id"]),
    ).fetchone()["po_id"]
    for item in body.items:
        v = variants[item.prod_var_id]
        name = f"{v['product_name']} ({v['prod_attr']})" if v["prod_attr"] else v["product_name"]
        db.execute(
            "insert into purchase_order_item (po_id, prod_var_id, item_name, sku, quantity, unit_cost) values (%s, %s, %s, %s, %s, %s)",
            (po_id, item.prod_var_id, name, v["sku"], item.quantity, item.unit_cost),
        )
    units = sum(i.quantity for i in body.items)
    audit.log(db, request, user, f"Created restock order #PO-{po_id} to {supplier['supplier_name']}: {len(body.items)} items, {units} units")
    return po_or_404(db, po_id)


@router.post("/purchase-orders/{po_id}/receive")
def receive_purchase_order(db: Db, request: Request, po_id: int, body: ReceiveIn, user=Depends(require_admin)):
    po = db.execute("select * from purchase_order where po_id = %s for update", (po_id,)).fetchone()
    if not po:
        raise HTTPException(404, "Restock order not found")
    if po["status"] not in PO_OPEN:
        raise HTTPException(400, f"This restock order is already {po['status'].lower()}")
    items = {
        i["po_item_id"]: i
        for i in db.execute("select * from purchase_order_item where po_id = %s for update", (po_id,)).fetchall()
    }

    added = damaged = 0
    note = (body.notes or "").strip()
    for r in body.items:
        item = items.get(r.po_item_id)
        if not item:
            raise HTTPException(400, "One of the items isn't in this restock order")
        if r.good + r.damaged == 0:
            continue
        remaining = item["quantity"] - item["received_qty"] - item["damaged_qty"]
        if r.good + r.damaged > remaining:
            raise HTTPException(400, f"Only {remaining} of {item['item_name']} still to come")
        if r.good and not item["prod_var_id"]:
            raise HTTPException(400, f"{item['item_name']} was removed from the catalog, so it can't be added to stock")
        db.execute(
            "update purchase_order_item set received_qty = received_qty + %s, damaged_qty = damaged_qty + %s where po_item_id = %s",
            (r.good, r.damaged, r.po_item_id),
        )
        if r.good:
            # good units can be sold now
            db.execute("update prod_var set stocks = stocks + %s where prod_var_id = %s", (r.good, item["prod_var_id"]))
        if r.damaged:
            # damaged on arrival: an item issue for the supplier, never stocked
            defect_id = db.execute(
                """
                insert into defect_report
                  (prod_var_id, item_name, sku, supplier_id, supplier_name, quantity, defect_type, source, notes, reported_by, po_id)
                values (%s, %s, %s, %s, %s, %s, %s, 'receiving', %s, %s, %s)
                returning defect_id
                """,
                (
                    item["prod_var_id"],
                    item["item_name"],
                    item["sku"],
                    po["supplier_id"],
                    po["supplier_name"],
                    r.damaged,
                    (r.defect_type or "").strip() or "Damaged on delivery",
                    " – ".join(filter(None, [f"From restock order #PO-{po_id}", note])),
                    user["user_id"],
                    po_id,
                ),
            ).fetchone()["defect_id"]
            audit.log(db, request, user, f"Reported item issue #ISS-{defect_id}: {r.damaged} × {item['item_name']} ({po['supplier_name']}), from restock order #PO-{po_id}")
        added += r.good
        damaged += r.damaged
    if added + damaged == 0:
        raise HTTPException(400, "Enter how many units arrived")

    left = db.execute(
        "select coalesce(sum(quantity - received_qty - damaged_qty), 0) as n from purchase_order_item where po_id = %s", (po_id,)
    ).fetchone()["n"]
    status = "Received" if left == 0 else "Partly received"
    db.execute("update purchase_order set status = %s, updated_at = now() where po_id = %s", (status, po_id))
    if status == "Received":
        db.execute("update purchase_order set received_at = now() where po_id = %s", (po_id,))
    if note:
        # the delivery note is kept on the order, under whatever was written before
        db.execute(
            "update purchase_order set notes = concat_ws(E'\\n', notes, %s::text) where po_id = %s",
            (f"Received {added + damaged} units: {note}", po_id),
        )
    audit.log(db, request, user, f"Received restock order #PO-{po_id} ({po['supplier_name']}): {added} added to stock, {damaged} damaged")
    return po_or_404(db, po_id)


@router.patch("/purchase-orders/{po_id}")
def update_purchase_order(db: Db, request: Request, po_id: int, body: PurchaseOrderPatch, user=Depends(require_admin)):
    po = db.execute("select * from purchase_order where po_id = %s for update", (po_id,)).fetchone()
    if not po:
        raise HTTPException(404, "Restock order not found")
    if body.status == "Cancelled":
        if po["status"] not in PO_OPEN:
            raise HTTPException(400, f"This restock order is already {po['status'].lower()}")
        db.execute("update purchase_order set status = 'Cancelled', updated_at = now() where po_id = %s", (po_id,))
        audit.log(db, request, user, f"Cancelled restock order #PO-{po_id} ({po['supplier_name']})")
    if "expected_date" in body.model_fields_set:
        db.execute("update purchase_order set expected_date = %s, updated_at = now() where po_id = %s", (body.expected_date, po_id))
    if body.notes is not None:
        db.execute("update purchase_order set notes = %s, updated_at = now() where po_id = %s", (body.notes.strip() or None, po_id))
    return po_or_404(db, po_id)
