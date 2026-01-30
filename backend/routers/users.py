"""
Users Router - User management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging

from core.database import db
from core.dependencies import require_auth
from core.security import validate_id, sanitize_string
from core.config import MAX_NAME_LENGTH, MAX_BIO_LENGTH
from schemas.users import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: User = Depends(require_auth)):
    """Get user by ID"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}/stats")
async def get_user_stats(user_id: str, current_user: User = Depends(require_auth)):
    """Get user statistics"""
    posts_count = await db.posts.count_documents({"user_id": user_id})
    followers_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})
    
    return {
        "posts": posts_count,
        "followers": followers_count,
        "following": following_count
    }


@router.get("/{user_id}/posts")
async def get_user_posts(
    user_id: str,
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get posts by a specific user"""
    validate_id(user_id, "user_id")
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    posts = await db.posts.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return posts


@router.get("/{user_id}/media")
async def get_user_media(
    user_id: str,
    type: str = "image",
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get media posts by a specific user filtered by type"""
    validate_id(user_id, "user_id")
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    # Map type to media_type
    media_type = type  # "image", "video", "audio"
    
    posts = await db.posts.find(
        {"user_id": user_id, "media_type": media_type},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return posts


@router.put("/me")
async def update_profile(
    name: Optional[str] = None, 
    bio: Optional[str] = None, 
    is_private: Optional[bool] = None,
    website: Optional[str] = None,
    twitter: Optional[str] = None,
    instagram: Optional[str] = None,
    linkedin: Optional[str] = None,
    paypal_email: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """Update user profile"""
    update_data = {}
    
    # Security: Sanitize and validate all inputs
    if name is not None:
        update_data["name"] = sanitize_string(name, MAX_NAME_LENGTH, "name")
    if bio is not None:
        update_data["bio"] = sanitize_string(bio, MAX_BIO_LENGTH, "bio")
    if is_private is not None:
        update_data["is_private"] = bool(is_private)
    if website is not None:
        website = sanitize_string(website, 200, "website")
        # Basic URL validation
        if website and not website.startswith(('http://', 'https://')):
            website = 'https://' + website
        update_data["website"] = website
    if twitter is not None:
        update_data["twitter"] = sanitize_string(twitter, 50, "twitter")
    if instagram is not None:
        update_data["instagram"] = sanitize_string(instagram, 50, "instagram")
    if linkedin is not None:
        update_data["linkedin"] = sanitize_string(linkedin, 100, "linkedin")
    if paypal_email is not None:
        paypal_email = sanitize_string(paypal_email, 100, "paypal_email")
        # Basic email validation
        if paypal_email and '@' not in paypal_email:
            raise HTTPException(status_code=400, detail="Invalid PayPal email")
        update_data["paypal_email"] = paypal_email
    
    if update_data:
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": update_data}
        )
    
    return {"message": "Profile updated"}


@router.put("/me/notification-settings")
async def update_notification_settings(
    notify_followers: Optional[bool] = None,
    notify_likes: Optional[bool] = None,
    notify_comments: Optional[bool] = None,
    notify_messages: Optional[bool] = None,
    notify_sales: Optional[bool] = None,
    notify_mentions: Optional[bool] = None,
    notify_reposts: Optional[bool] = None,
    current_user: User = Depends(require_auth)
):
    """Update user notification settings"""
    update_data = {}
    
    if notify_followers is not None:
        update_data["notify_followers"] = bool(notify_followers)
    if notify_likes is not None:
        update_data["notify_likes"] = bool(notify_likes)
    if notify_comments is not None:
        update_data["notify_comments"] = bool(notify_comments)
    if notify_messages is not None:
        update_data["notify_messages"] = bool(notify_messages)
    if notify_sales is not None:
        update_data["notify_sales"] = bool(notify_sales)
    if notify_mentions is not None:
        update_data["notify_mentions"] = bool(notify_mentions)
    if notify_reposts is not None:
        update_data["notify_reposts"] = bool(notify_reposts)
    
    if update_data:
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": update_data}
        )
    
    return {"message": "Notification settings updated"}


@router.get("/me/notification-settings")
async def get_notification_settings(current_user: User = Depends(require_auth)):
    """Get user notification settings"""
    return {
        "notify_followers": current_user.notify_followers,
        "notify_likes": current_user.notify_likes,
        "notify_comments": current_user.notify_comments,
        "notify_messages": current_user.notify_messages,
        "notify_sales": current_user.notify_sales,
        "notify_mentions": current_user.notify_mentions,
        "notify_reposts": current_user.notify_reposts
    }
