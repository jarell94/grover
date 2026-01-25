# User-related Pydantic models

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

class User(BaseModel):
    """User profile model"""
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
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    
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

class UserProfile(BaseModel):
    """Public user profile response"""
    user_id: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = None
    website: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    is_premium: bool = False
    is_private: bool = False
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    is_following: bool = False
    is_blocked: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    """Update user profile"""
    name: Optional[str] = None
    bio: Optional[str] = None
    website: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    picture: Optional[str] = None
    is_private: Optional[bool] = None
    
    @field_validator('name')
    @classmethod
    def name_not_empty(cls, v):
        if v is not None and not v.strip():
            raise ValueError('Name cannot be empty')
        return v

class UserStats(BaseModel):
    """User statistics"""
    user_id: str
    posts_count: int = 0
    followers_count: int = 0
    following_count: int = 0
    likes_count: int = 0
    total_earnings: float = 0.0
    total_spent: float = 0.0
    streams_count: int = 0
    avg_engagement_rate: float = 0.0

class NotificationSettings(BaseModel):
    """User notification preferences"""
    user_id: str
    notify_followers: bool = True
    notify_likes: bool = True
    notify_comments: bool = True
    notify_messages: bool = True
    notify_sales: bool = True
    notify_mentions: bool = True
    notify_reposts: bool = True
    notify_super_chat: bool = True
    notify_tips: bool = True
    notify_stream_online: bool = True
    email_enabled: bool = False
    push_enabled: bool = True
    mute_keywords: List[str] = []

class FollowRelationship(BaseModel):
    """Follow/unfollow relationship"""
    follower_id: str
    following_id: str
    created_at: datetime

class BlockRelationship(BaseModel):
    """Block/unblock relationship"""
    blocker_id: str
    blocked_id: str
    created_at: datetime

class Subscription(BaseModel):
    """Premium subscription"""
    subscription_id: str
    user_id: str
    plan: str  # free, pro, premium
    status: str  # active, cancelled, expired
    amount: float = 0.0
    billing_cycle: str = "monthly"  # monthly, annual
    start_date: datetime
    end_date: Optional[datetime] = None
    auto_renew: bool = True
    created_at: datetime
    updated_at: datetime

class PaywallSettings(BaseModel):
    """User paywall and monetization settings"""
    user_id: str
    paywalls_enabled: bool = False  # Allow user to enable/disable paywalls
    paywall_type: str = "free"  # free, freemium, paid, subscription
    subscription_required_for_content: bool = False
    paywall_message: Optional[str] = None
    exclusive_content_enabled: bool = False
    tips_enabled: bool = True
    super_chat_enabled: bool = True
    product_sales_enabled: bool = False
    affiliate_links_enabled: bool = False
    sponsored_content_enabled: bool = False
    donation_enabled: bool = False
    newsletter_paid_enabled: bool = False
    
    # Pricing for paywalled content
    monthly_subscription_price: Optional[float] = None
    one_time_purchase_price: Optional[float] = None
    pay_per_view_price: Optional[float] = None
    
    # Paywall content restrictions
    free_preview_duration_minutes: int = 1  # Minutes of video/content visible for free
    free_posts_per_day: Optional[int] = None  # None = unlimited
    
    # Monetary settings
    default_tip_amounts: List[float] = [1.0, 5.0, 10.0, 25.0]
    minimum_payout_threshold: float = 10.0  # Minimum balance to request payout
    payout_frequency: str = "monthly"  # weekly, bi-weekly, monthly
    
    # Advanced settings
    paywall_content_drm_enabled: bool = False  # Digital Rights Management
    download_allowed: bool = False  # Allow downloads of content
    share_allowed: bool = True  # Allow sharing paywalled content
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class PaywallUpdate(BaseModel):
    """Update paywall settings"""
    paywalls_enabled: Optional[bool] = None
    paywall_type: Optional[str] = None
    subscription_required_for_content: Optional[bool] = None
    paywall_message: Optional[str] = None
    exclusive_content_enabled: Optional[bool] = None
    tips_enabled: Optional[bool] = None
    super_chat_enabled: Optional[bool] = None
    product_sales_enabled: Optional[bool] = None
    affiliate_links_enabled: Optional[bool] = None
    sponsored_content_enabled: Optional[bool] = None
    donation_enabled: Optional[bool] = None
    newsletter_paid_enabled: Optional[bool] = None
    monthly_subscription_price: Optional[float] = None
    one_time_purchase_price: Optional[float] = None
    pay_per_view_price: Optional[float] = None
    free_preview_duration_minutes: Optional[int] = None
    free_posts_per_day: Optional[int] = None
    default_tip_amounts: Optional[List[float]] = None
    minimum_payout_threshold: Optional[float] = None
    payout_frequency: Optional[str] = None
    paywall_content_drm_enabled: Optional[bool] = None
    download_allowed: Optional[bool] = None
    share_allowed: Optional[bool] = None

class MonetizationStats(BaseModel):
    """User monetization statistics"""
    user_id: str
    total_earnings: float = 0.0
    total_payouts: float = 0.0
    pending_payout: float = 0.0
    total_tips_received: int = 0
    total_super_chats_received: int = 0
    total_paid_subscriptions: int = 0
    total_posts_sold: int = 0
    total_products_sold: int = 0
    conversion_rate: float = 0.0  # % of visitors who pay
    average_tip_amount: float = 0.0
    last_payout_date: Optional[datetime] = None
    next_payout_date: Optional[datetime] = None
