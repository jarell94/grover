"""
Post-related Pydantic schemas for data validation and serialization.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


class PostBase(BaseModel):
    """Base post schema with common fields."""
    content: str = Field(..., max_length=10000)
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    tagged_users: List[str] = []
    location: Optional[str] = None


class PostCreate(PostBase):
    """Schema for creating a new post."""
    # Poll data (optional)
    has_poll: bool = False
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None
    poll_expires_at: Optional[datetime] = None


class Post(PostBase):
    """Complete post schema."""
    post_id: str
    user_id: str
    likes_count: int = 0
    dislikes_count: int = 0
    shares_count: int = 0
    comments_count: int = 0
    repost_count: int = 0
    reaction_counts: Optional[Dict] = {}
    
    # Repost fields
    is_repost: bool = False
    original_post_id: Optional[str] = None
    repost_comment: Optional[str] = None
    
    # Poll fields
    has_poll: bool = False
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None
    poll_votes: Optional[Dict] = None
    poll_expires_at: Optional[datetime] = None
    
    created_at: datetime
    
    class Config:
        from_attributes = True


class PostUpdate(BaseModel):
    """Schema for updating a post."""
    content: Optional[str] = Field(None, max_length=10000)
    location: Optional[str] = None


class RepostCreate(BaseModel):
    """Schema for creating a repost."""
    repost_comment: Optional[str] = Field(None, max_length=500)


class Reaction(BaseModel):
    """Schema for post reactions."""
    reaction_type: str  # like, love, laugh, sad, angry, etc.


class Poll(BaseModel):
    """Poll schema."""
    poll_id: str
    post_id: str
    question: str
    options: List[str]
    votes: Dict = {}  # {option_index: [user_ids]}
    duration_hours: int = 24
    expires_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class PollVote(BaseModel):
    """Schema for voting on a poll."""
    option_index: int
