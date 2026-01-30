"""
User Schemas - Pydantic models for user data validation and serialization
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class User(BaseModel):
    """User model"""
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = ""
    is_premium: bool = False
    is_private: bool = False
    website: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
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
