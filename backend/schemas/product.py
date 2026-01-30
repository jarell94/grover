"""
Product and Order-related Pydantic schemas for data validation and serialization.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ProductBase(BaseModel):
    """Base product schema with common fields."""
    name: str = Field(..., max_length=200)
    description: str = Field(..., max_length=2000)
    price: float = Field(..., gt=0)
    image_url: Optional[str] = None


class ProductCreate(ProductBase):
    """Schema for creating a new product."""
    pass


class Product(ProductBase):
    """Complete product schema."""
    product_id: str
    user_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ProductUpdate(BaseModel):
    """Schema for updating a product."""
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    price: Optional[float] = Field(None, gt=0)
    image_url: Optional[str] = None


class OrderBase(BaseModel):
    """Base order schema with common fields."""
    product_id: str
    amount: float


class OrderCreate(OrderBase):
    """Schema for creating a new order."""
    pass


class Order(OrderBase):
    """Complete order schema."""
    order_id: str
    buyer_id: str
    seller_id: str
    status: str  # pending/completed/cancelled
    created_at: datetime
    
    class Config:
        from_attributes = True


class DiscountCodeCreate(BaseModel):
    """Schema for creating a discount code."""
    code: str
    discount_percent: float = Field(..., ge=0, le=100)
    expires_at: Optional[datetime] = None
