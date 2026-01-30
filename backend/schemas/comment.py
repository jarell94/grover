"""
Comment-related Pydantic schemas for data validation and serialization.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CommentBase(BaseModel):
    """Base comment schema with common fields."""
    content: str = Field(..., max_length=2000)
    tagged_users: List[str] = []


class CommentCreate(CommentBase):
    """Schema for creating a new comment."""
    parent_comment_id: Optional[str] = None


class Comment(CommentBase):
    """Complete comment schema."""
    comment_id: str
    post_id: str
    user_id: str
    parent_comment_id: Optional[str] = None
    likes_count: int = 0
    replies_count: int = 0
    created_at: datetime
    
    class Config:
        from_attributes = True


class CommentUpdate(BaseModel):
    """Schema for updating a comment."""
    content: Optional[str] = Field(None, max_length=2000)
