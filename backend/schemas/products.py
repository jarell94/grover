"""
Product Schemas - Pydantic models for product/marketplace data validation and serialization
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Product(BaseModel):
    """Product model"""
    product_id: str
    user_id: str
    name: str
    description: str
    price: float
    image_url: Optional[str] = None  # base64
    created_at: datetime


class Order(BaseModel):
    """Order model"""
    order_id: str
    buyer_id: str
    seller_id: str
    product_id: str
    amount: float
    status: str  # pending/completed/cancelled
    created_at: datetime


class DiscountCodeCreate(BaseModel):
    """Schema for creating a discount code"""
    code: str
    discount_percent: float
