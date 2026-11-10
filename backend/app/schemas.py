import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .emails import check_email

# emails and passwords people type in are kept to 30 characters (frontend: MAX_EMAIL / MAX_PASSWORD in lib/constants.ts)
MAX_EMAIL = 30
MAX_PASSWORD = 30


class LoginIn(BaseModel):
    email: str
    password: str


# full names: letters from any language, spaces, and . ' - (frontend/src/lib/names.ts has the same rule)
NAME = re.compile(r"^[^\W\d_](?:[^\W\d_]|[ .'’-])*$")


def check_name(value: str | None) -> str | None:
    if value is not None and not NAME.match(value.strip()):
        raise ValueError("Use letters, spaces and . ' - only")
    return value


# PH mobile numbers: exactly 11 digits starting with 09 (frontend/src/lib/mobile.ts has the same rule)
MOBILE = re.compile(r"^09\d{9}$")


def check_mobile(value: str | None) -> str:
    # runs only when the field is sent, so leaving it out of a profile update is fine, but it can't be cleared
    if value is None or not MOBILE.match(value.strip()):
        raise ValueError("Enter an 11-digit mobile number like 09171234567")
    return value.strip()


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=1)
    email: str = Field(max_length=MAX_EMAIL)
    password: str = Field(min_length=8, max_length=MAX_PASSWORD)
    mobile_no: str
    birthdate: date | None = None

    _name = field_validator("full_name")(check_name)
    _mobile = field_validator("mobile_no")(check_mobile)
    _email = field_validator("email")(check_email)


class EmailIn(BaseModel):
    email: str


class VerifyCodeIn(BaseModel):
    email: str
    code: str


class ResetPasswordIn(BaseModel):
    reset_token: str
    new_password: str = Field(min_length=8, max_length=MAX_PASSWORD)


class ProfilePatch(BaseModel):
    full_name: str | None = None
    birthdate: date | None = None
    mobile_no: str | None = None
    st_add: str | None = None
    postal: str | None = None
    city_id: int | None = None

    _name = field_validator("full_name")(check_name)
    _mobile = field_validator("mobile_no")(check_mobile)


class CartItemIn(BaseModel):
    prod_var_id: int
    quantity: int = Field(gt=0)


class QuantityIn(BaseModel):
    quantity: int = Field(gt=0)


class MergeIn(BaseModel):
    items: list[CartItemIn]


class WishlistIn(BaseModel):
    prod_var_id: int


class Customer(BaseModel):
    full_name: str = Field(min_length=1)
    mobile_no: str = Field(min_length=1)
    st_add: str = Field(min_length=1)
    postal: str = Field(min_length=1)
    city_id: int


class PlaceOrderIn(BaseModel):
    lines: list[CartItemIn] = Field(min_length=1)
    payment_method: Literal["GCash", "COD"]
    customer: Customer
    note: str | None = None
    # no columns for these yet (SCHEMA_GAPS #18), they're written into shipping_add
    fulfillment: Literal["delivery", "pickup"] = "delivery"
    courier: str | None = None


MAX_MESSAGE_WORDS = 200  # Contact Us (frontend: MAX_MESSAGE_WORDS in lib/constants.ts)


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=MAX_EMAIL)
    subject: Literal["order", "refund", "product", "other"]
    message: str = Field(min_length=1, max_length=5000)

    @field_validator("message")
    @classmethod
    def word_limit(cls, v: str) -> str:
        if len(v.split()) > MAX_MESSAGE_WORDS:
            raise ValueError(f"Keep your message to {MAX_MESSAGE_WORDS} words or less")
        return v

    _email = field_validator("email")(check_email)


class GcashPaymentIn(BaseModel):
    reference: str = Field(pattern=r"^\d{13}$")


class GcashDecisionIn(BaseModel):
    decision: Literal["confirm", "reject"]


class CancelOrderIn(BaseModel):
    reason: str = Field(min_length=1, max_length=200)


class OrderStatusIn(BaseModel):
    order_stat: Literal["Pending", "Shipped", "Delivered", "Cancelled"]



class RefundIn(BaseModel):
    reason: str = Field(min_length=1, max_length=100)
    details: str | None = Field(default=None, max_length=1000)
    photos: list[str] = Field(default_factory=list, max_length=3)
    is_anonymous: bool = False


class RefundStatusIn(BaseModel):
    refund_stat: Literal["Requested", "Approved", "Rejected", "Refunded"]


class VariantIn(BaseModel):
    prod_var_id: int | None = None
    sku: str = Field(min_length=1)
    prod_var_name: str = Field(min_length=1)
    prod_attr: str | None = None
    b_price: float = Field(ge=0)
    pr_price: float | None = Field(default=None, ge=0)
    pr_start: date | None = None
    pr_end: date | None = None
    stocks: int = Field(ge=0)
    is_avail: bool = True
    images: str | list[str] | None = None


class ProductIn(BaseModel):
    item_categ_id: int
    product_name: str = Field(min_length=1)
    prod_desc: str | None = None
    is_avail: bool = True
    variants: list[VariantIn] = Field(min_length=1)


class ArchiveIn(BaseModel):
    archived: bool


# ---------- reviews ----------

class ReviewIn(BaseModel):
    prod_var_id: int
    rating: int = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=2000)
    photos: list[str] = Field(default_factory=list, max_length=3)


class ReviewFlagsIn(BaseModel):
    is_hidden: bool | None = None
    is_featured: bool | None = None


class ReviewReplyIn(BaseModel):
    reply: str = Field(min_length=1, max_length=1000)


# ---------- suppliers and defects ----------

class SupplierIn(BaseModel):
    supplier_name: str = Field(min_length=1, max_length=120)
    contact_person: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=300)
    is_active: bool = True

    @field_validator("contact_person", "phone", "address", "email", mode="before")
    @classmethod
    def blank_is_none(cls, v):
        return v.strip() or None if isinstance(v, str) else v

    _email = field_validator("email")(check_email)


class CategorySupplierIn(BaseModel):
    supplier_id: int | None


DefectStatus = Literal["Reported", "Returned to supplier", "Replaced", "Credited"]


class DefectIn(BaseModel):
    prod_var_id: int
    quantity: int = Field(gt=0, le=1000)
    defect_type: str = Field(min_length=1, max_length=80)
    source: Literal["receiving", "storage", "customer_return"]
    order_id: int | None = None
    notes: str | None = Field(default=None, max_length=1000)
    photos: list[str] = Field(default_factory=list, max_length=5)


class DefectStatusIn(BaseModel):
    status: DefectStatus
    notes: str | None = Field(default=None, max_length=1000)


# ---------- restock orders ----------

class PurchaseItemIn(BaseModel):
    prod_var_id: int
    quantity: int = Field(gt=0, le=10000)
    unit_cost: float | None = Field(default=None, ge=0, le=10_000_000)


class PurchaseOrderIn(BaseModel):
    supplier_id: int
    expected_date: date | None = None
    notes: str | None = Field(default=None, max_length=1000)
    items: list[PurchaseItemIn] = Field(min_length=1, max_length=100)

    @field_validator("items")
    @classmethod
    def no_repeats(cls, items: list[PurchaseItemIn]) -> list[PurchaseItemIn]:
        ids = [i.prod_var_id for i in items]
        if len(ids) != len(set(ids)):
            raise ValueError("The same item is listed twice")
        return items


class ReceiveItemIn(BaseModel):
    po_item_id: int
    good: int = Field(ge=0, le=10000)      # units in good condition, added to stock
    damaged: int = Field(ge=0, le=10000)   # units reported as item issues
    defect_type: str | None = Field(default=None, max_length=80)


class ReceiveIn(BaseModel):
    items: list[ReceiveItemIn] = Field(min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=1000)


class PurchaseOrderPatch(BaseModel):
    status: Literal["Cancelled"] | None = None
    expected_date: date | None = None
    notes: str | None = Field(default=None, max_length=1000)


# ---------- chat ----------

class ChatIn(BaseModel):
    body: str = Field(min_length=1, max_length=1000)

    @field_validator("body")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Type a message first")
        return v


class ChatResolveIn(BaseModel):
    resolved: bool


# ---------- admins (Super Admin only) ----------

AdminRole = Literal["admin", "super_admin"]


class AdminIn(BaseModel):
    full_name: str = Field(min_length=1)
    email: str = Field(max_length=MAX_EMAIL)
    password: str = Field(min_length=8, max_length=MAX_PASSWORD)
    role: AdminRole = "admin"

    _name = field_validator("full_name")(check_name)

    _email = field_validator("email")(check_email)


class AdminRoleIn(BaseModel):
    role: AdminRole


class PasswordIn(BaseModel):
    password: str = Field(min_length=8, max_length=MAX_PASSWORD)


# ---------- settings ----------

class StoreSettingsIn(BaseModel):
    name: str = Field(min_length=1)
    support_email: str = Field(max_length=100)
    phone: str = Field(min_length=1)
    address: str = Field(min_length=1)
    hours: str = Field(min_length=1)

    _email = field_validator("support_email")(check_email)


class PolicySettingsIn(BaseModel):
    cancellation_window: str
    return_policy: str
    refund_method: str
    free_shipping_threshold: float = Field(ge=0)


class RegionalSettingsIn(BaseModel):
    currency: str
    vat_percent: float = Field(ge=0, le=100)
    timezone: str


class SecuritySettingsIn(BaseModel):
    require_2fa: bool
    inactivity_minutes: int = Field(ge=5, le=480)
