"""
Post Schemas - Pydantic models for post data validation and serialization
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class Post(BaseModel):
    """Post model"""
    post_id: str
    user_id: str
    content: str
    media_url: Optional[str] = None  # base64
    media_type: Optional[str] = None  # image/video/audio
    likes_count: int = 0
    dislikes_count: int = 0
    shares_count: int = 0
    comments_count: int = 0
    repost_count: int = 0
    reaction_counts: Optional[dict] = {}  # {reaction_type: count}
    tagged_users: List[str] = []  # List of user_ids
    location: Optional[str] = None
    is_repost: bool = False
    original_post_id: Optional[str] = None  # If this is a repost, reference to original
    repost_comment: Optional[str] = None  # User's commentary on the repost
    # Poll data (optional)
    has_poll: bool = False
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None
    poll_votes: Optional[dict] = None  # {option_index: vote_count}
    poll_expires_at: Optional[datetime] = None
    created_at: datetime


class Story(BaseModel):
    """Story model"""
    story_id: str
    user_id: str
    media_url: str  # base64 image or video
    media_type: str  # image/video
    caption: Optional[str] = None
    views_count: int = 0
    reactions_count: int = 0
    replies_count: int = 0
    is_highlighted: bool = False
    highlight_title: Optional[str] = None
    expires_at: datetime
    created_at: datetime


class Poll(BaseModel):
    """Poll model"""
    poll_id: str
    post_id: str
    question: str
    options: List[str]
    votes: dict = {}  # {option_index: [user_ids]}
    duration_hours: int = 24  # Poll duration
    expires_at: datetime
    created_at: datetime


class Comment(BaseModel):
    """Comment model"""
    comment_id: str
    post_id: str
    user_id: str
    content: str
    parent_comment_id: Optional[str] = None  # For threaded replies
    likes_count: int = 0
    replies_count: int = 0
    tagged_users: List[str] = []  # List of user_ids mentioned
    created_at: datetime


class CommentCreate(BaseModel):
    """Schema for creating a comment"""
    content: str
    parent_comment_id: Optional[str] = None
