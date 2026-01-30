"""
User-related Pydantic schemas for data validation and serialization.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    """Base user schema with common fields."""
    name: str = Field(..., max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    picture: Optional[str] = None
    website: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a new user."""
    email: EmailStr
    user_id: str


class User(UserBase):
    """Complete user schema."""
    user_id: str
    email: str
    is_premium: bool = False
    is_private: bool = False
    paypal_email: Optional[str] = None
    
    # Notification preferences
    notify_followers: bool = True
    notify_likes: bool = True
    notify_comments: bool = True
    notify_messages: bool = True
    notify_sales: bool = True
    notify_mentions: bool = True
    notify_reposts: bool = True
    
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserPublic(BaseModel):
    """Public user profile schema (excludes sensitive data)."""
    user_id: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = None
    is_premium: bool = False
    is_private: bool = False
    website: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    picture: Optional[str] = None
    is_private: Optional[bool] = None
    website: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    paypal_email: Optional[str] = None


class NotificationSettings(BaseModel):
    """User notification settings schema."""
    notify_followers: Optional[bool] = None
    notify_likes: Optional[bool] = None
    notify_comments: Optional[bool] = None
    notify_messages: Optional[bool] = None
    notify_sales: Optional[bool] = None
    notify_mentions: Optional[bool] = None
    notify_reposts: Optional[bool] = None
