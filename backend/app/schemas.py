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


class OrderStatusIn(BaseModel):
    order_stat: Literal["Pending", "Shipped", "Delivered", "Cancelled"]


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


class ReviewHiddenIn(BaseModel):
    is_hidden: bool
