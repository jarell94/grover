"""
Notification Schemas - Pydantic models for notification data validation and serialization
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Notification(BaseModel):
    """Notification model"""
    notification_id: str
    user_id: str
    type: str  # like/follow/purchase
    content: str
    read: bool = False
    created_at: datetime


class PushTokenData(BaseModel):
    """Schema for push notification token"""
    token: str
    platform: str  # ios/android/web
