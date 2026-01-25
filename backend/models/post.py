# Post-related Pydantic models

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict
from datetime import datetime

class Post(BaseModel):
    """Post model"""
    post_id: str
    user_id: str
    content: str
    media_url: Optional[str] = None  # base64 or cloud URL
    media_type: Optional[str] = None  # image/video/audio
    likes_count: int = 0
    dislikes_count: int = 0
    shares_count: int = 0
    comments_count: int = 0
    repost_count: int = 0
    reaction_counts: Optional[Dict[str, int]] = {}  # {reaction_type: count}
    tagged_users: List[str] = []  # List of user_ids
    location: Optional[str] = None
    is_repost: bool = False
    original_post_id: Optional[str] = None  # If this is a repost, reference to original
    repost_comment: Optional[str] = None  # User's commentary on the repost
    
    # Poll data (optional)
    has_poll: bool = False
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None
    poll_votes: Optional[Dict[str, int]] = None  # {option_index: vote_count}
    poll_expires_at: Optional[datetime] = None
    
    # Collections
    in_collection_count: int = 0
    
    # Paywall/Monetization
    is_exclusive: bool = False  # Is this content paywalled?
    access_price: Optional[float] = None  # Price to access (None = free)
    access_type: str = "free"  # free, pay-per-view, subscription, one-time
    free_preview_duration_minutes: Optional[int] = None  # Minutes visible before paywall
    purchase_count: int = 0  # Number of users who purchased access
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class PostCreate(BaseModel):
    """Create post request"""
    content: str = Field(..., min_length=1, max_length=5000)
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    tagged_users: List[str] = []
    location: Optional[str] = None
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None
    poll_duration_hours: Optional[int] = 24
    
    # Paywall options
    is_exclusive: bool = False
    access_price: Optional[float] = None
    free_preview_duration_minutes: Optional[int] = None

class PostUpdate(BaseModel):
    """Update post request"""
    content: Optional[str] = None
    location: Optional[str] = None
    is_exclusive: Optional[bool] = None
    access_price: Optional[float] = None
    free_preview_duration_minutes: Optional[int] = None

class PostResponse(BaseModel):
    """Post response with user info"""
    post_id: str
    user_id: str
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    likes_count: int = 0
    dislikes_count: int = 0
    shares_count: int = 0
    comments_count: int = 0
    repost_count: int = 0
    is_liked: bool = False
    is_disliked: bool = False
    is_reposted: bool = False
    is_saved: bool = False
    created_at: datetime
    user_name: str
    user_picture: Optional[str] = None
    
    class Config:
        from_attributes = True

class Poll(BaseModel):
    """Poll model"""
    poll_id: str
    post_id: str
    question: str
    options: List[str]
    votes: Dict[int, int] = {}  # {option_index: vote_count}
    duration_hours: int = 24
    expires_at: datetime
    user_votes: Dict[str, int] = {}  # {user_id: option_index}
    created_at: datetime
    
    class Config:
        from_attributes = True

class PollVote(BaseModel):
    """Vote on poll"""
    post_id: str
    option_index: int

class Comment(BaseModel):
    """Comment model"""
    comment_id: str
    post_id: str
    user_id: str
    content: str
    parent_comment_id: Optional[str] = None  # For threaded replies
    likes_count: int = 0
    replies_count: int = 0
    tagged_users: List[str] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    """Create comment request"""
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: Optional[str] = None
    tagged_users: List[str] = []
    
    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        if not v or not v.strip():
            raise ValueError('Comment cannot be empty')
        return v.strip()

class CommentResponse(BaseModel):
    """Comment response with user info"""
    comment_id: str
    post_id: str
    user_id: str
    content: str
    parent_comment_id: Optional[str] = None
    likes_count: int = 0
    replies_count: int = 0
    is_liked: bool = False
    created_at: datetime
    user_name: str
    user_picture: Optional[str] = None
    
    class Config:
        from_attributes = True

class Reaction(BaseModel):
    """Post or comment reaction"""
    reaction_id: str
    target_id: str  # post_id or comment_id
    target_type: str  # post or comment
    user_id: str
    reaction_type: str  # like, love, haha, wow, sad, angry, heart, etc.
    created_at: datetime

class Collection(BaseModel):
    """Collections/lists of posts"""
    collection_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    is_public: bool = False
    posts: List[str] = []  # list of post_ids
    followers_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class CollectionCreate(BaseModel):
    """Create collection request"""
    title: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_public: bool = False
    posts: List[str] = []
