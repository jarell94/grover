"""
Posts Router - Post management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging

from core.database import db
from core.dependencies import require_auth
from core.security import validate_id
from schemas.users import User
from schemas.posts import PostCreate, PostUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("")
async def get_posts(
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get all posts"""
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    posts = await db.posts.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return posts


@router.get("/{post_id}")
async def get_post_by_id(post_id: str, current_user: User = Depends(require_auth)):
    """Get post by ID"""
    validate_id(post_id, "post_id")
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.post("")
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(require_auth)
):
    """Create a new post"""
    import uuid
    from datetime import datetime, timezone
    
    post_id = str(uuid.uuid4())
    post_dict = {
        "post_id": post_id,
        "user_id": current_user.user_id,
        "content": post_data.content,
        "media_url": post_data.media_url,
        "media_type": post_data.media_type,
        "location": post_data.location,
        "tagged_users": post_data.tagged_users,
        "likes_count": 0,
        "dislikes_count": 0,
        "shares_count": 0,
        "comments_count": 0,
        "repost_count": 0,
        "reaction_counts": {},
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.posts.insert_one(post_dict)
    return post_dict


@router.put("/{post_id}")
async def update_post(
    post_id: str,
    post_data: PostUpdate,
    current_user: User = Depends(require_auth)
):
    """Update a post"""
    validate_id(post_id, "post_id")
    
    # Check if post exists and belongs to user
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build update dict from provided fields
    update_dict = {}
    if post_data.content is not None:
        update_dict["content"] = post_data.content
    if post_data.location is not None:
        update_dict["location"] = post_data.location
    if post_data.tagged_users is not None:
        update_dict["tagged_users"] = post_data.tagged_users
    
    if update_dict:
        await db.posts.update_one(
            {"post_id": post_id},
            {"$set": update_dict}
        )
    
    return {"message": "Post updated"}


@router.delete("/{post_id}")
async def delete_post(post_id: str, current_user: User = Depends(require_auth)):
    """Delete a post"""
    validate_id(post_id, "post_id")
    
    # Check if post exists and belongs to user
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.posts.delete_one({"post_id": post_id})
    return {"message": "Post deleted"}
