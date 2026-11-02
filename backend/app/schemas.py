from datetime import date
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    mobile_no: str | None = None
    birthdate: date | None = None


class EmailIn(BaseModel):
    email: str


class VerifyCodeIn(BaseModel):
    email: str
    code: str


class ResetPasswordIn(BaseModel):
    reset_token: str
    new_password: str = Field(min_length=8)


class ProfilePatch(BaseModel):
    full_name: str | None = None
    birthdate: date | None = None
    mobile_no: str | None = None
    st_add: str | None = None
    postal: str | None = None
    city_id: int | None = None


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


class CancelOrderIn(BaseModel):
    reason: str = Field(min_length=1, max_length=200)


class OrderStatusIn(BaseModel):
    order_stat: Literal["Pending", "Shipped", "Delivered", "Cancelled"]



class RefundIn(BaseModel):
    reason: str = Field(min_length=1, max_length=100)
    details: str | None = Field(default=None, max_length=1000)


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


# ---------- admins (Super Admin only) ----------

AdminRole = Literal["admin", "super_admin"]


class AdminIn(BaseModel):
    full_name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    role: AdminRole = "admin"


class AdminRoleIn(BaseModel):
    role: AdminRole


class PasswordIn(BaseModel):
    password: str = Field(min_length=8)


# ---------- settings ----------

class StoreSettingsIn(BaseModel):
    name: str = Field(min_length=1)
    support_email: EmailStr
    phone: str = Field(min_length=1)
    address: str = Field(min_length=1)
    hours: str = Field(min_length=1)


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
