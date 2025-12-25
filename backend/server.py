from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
import httpx
import base64
import uuid
import re
import time
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from io import BytesIO
from PIL import Image
from paypal_service import create_payment, execute_payment, get_payment_details
from paypal_payout_service import send_payout

# Media Service (Cloudinary)
from media_service import (
    upload_media, 
    delete_media, 
    get_media_service_status,
    get_optimized_url,
    CLOUDINARY_CONFIGURED
)

# Agora Token Builder
try:
    from agora_token_builder import RtcTokenBuilder
    # Role constants: 1 = Publisher (broadcaster), 2 = Subscriber (audience)
    Role_Publisher = 1
    Role_Subscriber = 2
    AGORA_AVAILABLE = True
except ImportError:
    AGORA_AVAILABLE = False
    print("Warning: agora_token_builder not installed. Live streaming will be limited.")

# ============ SECURITY CONSTANTS ============
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB (increased for video uploads to cloud)
MAX_INPUT_LENGTH = 10000  # Max characters for text input
MAX_BIO_LENGTH = 500
MAX_NAME_LENGTH = 100
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"]
ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"]
ALLOWED_MEDIA_TYPES = ALLOWED_IMAGE_TYPES + ALLOWED_VIDEO_TYPES + ALLOWED_AUDIO_TYPES

# ID validation pattern (alphanumeric with underscores)
ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,50}$')

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ============ SECURITY HELPER FUNCTIONS ============

def validate_id(id_value: str, id_type: str = "ID") -> str:
    """Validate ID format to prevent injection attacks"""
    if not id_value or not isinstance(id_value, str):
        raise HTTPException(status_code=400, detail=f"Invalid {id_type}")
    if len(id_value) > 50:
        raise HTTPException(status_code=400, detail=f"{id_type} too long")
    if not ID_PATTERN.match(id_value):
        raise HTTPException(status_code=400, detail=f"Invalid {id_type} format")
    return id_value

def sanitize_string(value: str, max_length: int = MAX_INPUT_LENGTH, field_name: str = "input") -> str:
    """Sanitize string input"""
    if not isinstance(value, str):
        return ""
    # Trim whitespace and limit length
    value = value.strip()[:max_length]
    # Remove potential script tags and dangerous characters
    value = re.sub(r'<script[^>]*>.*?</script>', '', value, flags=re.IGNORECASE | re.DOTALL)
    value = re.sub(r'javascript:', '', value, flags=re.IGNORECASE)
    return value

async def validate_file_upload(file: UploadFile, allowed_types: list = None, max_size: int = MAX_FILE_SIZE) -> bytes:
    """Validate file upload for size and type"""
    if allowed_types is None:
        allowed_types = ALLOWED_MEDIA_TYPES
    
    # Check content type
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Read and check size
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {max_size // (1024*1024)}MB"
        )
    
    return content

# CORS configuration from environment
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
# In development, allow all origins; in production, specify domains
if ALLOWED_ORIGINS == ["*"]:
    cors_origins = ["*"]
else:
    cors_origins = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]

# Socket.IO setup with configured CORS
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=cors_origins if cors_origins != ["*"] else '*',
    logger=True,
    ping_timeout=60,
    ping_interval=25
)

# Create FastAPI app
app = FastAPI(
    title="Grover API",
    description="Social Media Creator Platform API",
    version="1.0.0"
)
api_router = APIRouter(prefix="/api")

# Add GZip compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS - configurable via environment
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ HELPER FUNCTIONS ============

async def create_notification(user_id: str, notification_type: str, content: str, related_id: str = None):
    """Create a notification only if user has that type enabled"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return
    
    # Map notification types to user preferences
    pref_map = {
        "follow": "notify_followers",
        "like": "notify_likes",
        "comment": "notify_comments",
        "message": "notify_messages",
        "sale": "notify_sales",
        "mention": "notify_mentions",
        "repost": "notify_reposts",
        "share": "notify_reposts",  # Treat shares like reposts
    }
    
    pref_field = pref_map.get(notification_type, "notify_followers")
    
    # Check if user has this notification type enabled (default to True)
    if user.get(pref_field, True):
        notification_data = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": notification_type,
            "content": content,
            "read": False,
            "created_at": datetime.now(timezone.utc)
        }
        if related_id:
            notification_data["related_id"] = related_id
        
        await db.notifications.insert_one(notification_data)

# ============ MODELS ============

class User(BaseModel):
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

class Post(BaseModel):
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
    poll_id: str
    post_id: str
    question: str
    options: List[str]
    votes: dict = {}  # {option_index: [user_ids]}
    duration_hours: int = 24  # Poll duration
    expires_at: datetime
    created_at: datetime

class Comment(BaseModel):
    comment_id: str
    post_id: str
    user_id: str
    content: str
    parent_comment_id: Optional[str] = None  # For threaded replies
    likes_count: int = 0
    replies_count: int = 0
    tagged_users: List[str] = []  # List of user_ids mentioned
    created_at: datetime

class Product(BaseModel):
    product_id: str
    user_id: str
    name: str
    description: str
    price: float
    image_url: Optional[str] = None  # base64
    created_at: datetime

class Order(BaseModel):
    order_id: str
    buyer_id: str
    seller_id: str
    product_id: str
    amount: float
    status: str  # pending/completed/cancelled
    created_at: datetime

class Message(BaseModel):
    message_id: str
    conversation_id: str
    sender_id: str
    content: str
    read: bool = False
    created_at: datetime

class Notification(BaseModel):
    notification_id: str
    user_id: str
    type: str  # like/follow/purchase
    content: str
    read: bool = False
    created_at: datetime

# ============ AUTH HELPERS ============

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[User]:
    if not authorization:
        return None
    
    try:
        token = authorization.replace("Bearer ", "")
        session = await db.user_sessions.find_one(
            {"session_token": token},
            {"_id": 0}
        )
        
        if not session:
            return None
        
        # Check expiry
        expires_at = session["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            return None
        
        user_doc = await db.users.find_one(
            {"user_id": session["user_id"]},
            {"_id": 0}
        )
        
        if user_doc:
            return User(**user_doc)
        return None
    except Exception as e:
        logger.error(f"Auth error: {e}")
        return None

async def require_auth(current_user: Optional[User] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

# ============ AUTH ENDPOINTS ============

@api_router.get("/media/status")
async def get_media_status():
    """Get media upload service status"""
    return get_media_service_status()

@api_router.get("/auth/session")
async def create_session(session_id: str):
    """Exchange session_id for user data and create session"""
    # Validate session_id format
    if not session_id or len(session_id) > 500:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session ID")
            
            user_data = response.json()
            
            # Check if user exists
            existing_user = await db.users.find_one(
                {"email": user_data["email"]},
                {"_id": 0}
            )
            
            if not existing_user:
                # Create new user
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                await db.users.insert_one({
                    "user_id": user_id,
                    "email": user_data["email"],
                    "name": user_data["name"],
                    "picture": user_data["picture"],
                    "bio": "",
                    "is_premium": False,
                    "is_private": False,
                    "created_at": datetime.now(timezone.utc)
                })
            else:
                user_id = existing_user["user_id"]
            
            # Create or update session (avoid duplicate key error)
            session_token = user_data["session_token"]
            try:
                await db.user_sessions.update_one(
                    {"session_token": session_token},
                    {
                        "$set": {
                            "user_id": user_id,
                            "session_token": session_token,
                            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                            "updated_at": datetime.now(timezone.utc)
                        },
                        "$setOnInsert": {
                            "created_at": datetime.now(timezone.utc)
                        }
                    },
                    upsert=True
                )
            except Exception as session_error:
                # Handle race condition - if E11000 occurs, session already exists, which is fine
                if "E11000" in str(session_error) or "duplicate key" in str(session_error):
                    logger.warning(f"Session already exists for token (race condition handled): {session_token[:10]}...")
                else:
                    logger.error(f"Session error: {session_error}")
                    raise
            
            return {
                "user_id": user_id,
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data["picture"],
                "session_token": session_token
            }
    except Exception as e:
        logger.error(f"Session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(require_auth)):
    return current_user

@api_router.post("/auth/logout")
async def logout(current_user: User = Depends(require_auth), authorization: str = Header(None)):
    token = authorization.replace("Bearer ", "")
    await db.user_sessions.delete_one({"session_token": token})
    return {"message": "Logged out"}

# ============ USER ENDPOINTS ============

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: User = Depends(require_auth)):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.get("/users/{user_id}/stats")
async def get_user_stats(user_id: str, current_user: User = Depends(require_auth)):
    posts_count = await db.posts.count_documents({"user_id": user_id})
    followers_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})
    
    return {
        "posts": posts_count,
        "followers": followers_count,
        "following": following_count
    }

@api_router.get("/users/{user_id}/posts")
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

@api_router.get("/users/{user_id}/media")
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

@api_router.put("/users/me")
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

@api_router.put("/users/me/notification-settings")
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
    """Update notification preferences"""
    update_data = {}
    if notify_followers is not None:
        update_data["notify_followers"] = notify_followers
    if notify_likes is not None:
        update_data["notify_likes"] = notify_likes
    if notify_comments is not None:
        update_data["notify_comments"] = notify_comments
    if notify_messages is not None:
        update_data["notify_messages"] = notify_messages
    if notify_sales is not None:
        update_data["notify_sales"] = notify_sales
    if notify_mentions is not None:
        update_data["notify_mentions"] = notify_mentions
    if notify_reposts is not None:
        update_data["notify_reposts"] = notify_reposts
    
    if update_data:
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": update_data}
        )
    
    return {"message": "Notification settings updated", "settings": update_data}

@api_router.get("/users/me/notification-settings")
async def get_notification_settings(current_user: User = Depends(require_auth)):
    """Get current notification preferences"""
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    return {
        "notify_followers": user.get("notify_followers", True),
        "notify_likes": user.get("notify_likes", True),
        "notify_comments": user.get("notify_comments", True),
        "notify_messages": user.get("notify_messages", True),
        "notify_sales": user.get("notify_sales", True),
        "notify_mentions": user.get("notify_mentions", True),
        "notify_reposts": user.get("notify_reposts", True),
    }

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: User = Depends(require_auth)):
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    existing = await db.follows.find_one({
        "follower_id": current_user.user_id,
        "following_id": user_id
    })
    
    if existing:
        # Unfollow
        await db.follows.delete_one({
            "follower_id": current_user.user_id,
            "following_id": user_id
        })
        return {"message": "Unfollowed", "following": False}
    else:
        # Follow
        await db.follows.insert_one({
            "follower_id": current_user.user_id,
            "following_id": user_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Create notification
        await create_notification(
            user_id,
            "follow",
            f"{current_user.name} started following you"
        )
        
        return {"message": "Followed", "following": True}

# ============ POST ENDPOINTS ============

@api_router.get("/posts")
async def get_posts(
    limit: int = 20,
    skip: int = 0,
    user_id: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """Get all posts with pagination, optionally filtered by user_id"""
    # Security: Enforce pagination limits to prevent DoS
    limit = min(max(1, limit), 100)  # 1-100 range
    skip = max(0, skip)  # Non-negative
    
    query = {}
    if user_id:
        validate_id(user_id, "user_id")
        query["user_id"] = user_id
    
    posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return posts

@api_router.get("/posts/me")
async def get_my_posts(
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get current user's posts"""
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    posts = await db.posts.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return posts

@api_router.get("/posts/media")
async def get_posts_media(
    user_id: str,
    media_type: str = "image",
    limit: int = 18,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get media posts filtered by user_id and media_type"""
    validate_id(user_id, "user_id")
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    posts = await db.posts.find(
        {"user_id": user_id, "media_type": media_type},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return posts

@api_router.get("/posts/feed")
async def get_feed(
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get feed of posts from followed users with pagination"""
    # Security: Enforce pagination limits
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    # Get followed users (cached for performance)
    follows = await db.follows.find(
        {"follower_id": current_user.user_id},
        {"_id": 0, "following_id": 1}
    ).to_list(1000)
    
    followed_ids = [f["following_id"] for f in follows]
    followed_ids.append(current_user.user_id)  # Include own posts
    
    # Optimized query with pagination
    posts = await db.posts.find(
        {"user_id": {"$in": followed_ids}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Add user data to each post
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
        
        # If this is a repost, get original post data
        if post.get("is_repost") and post.get("original_post_id"):
            original_post = await db.posts.find_one(
                {"post_id": post["original_post_id"]},
                {"_id": 0}
            )
            if original_post:
                original_user = await db.users.find_one(
                    {"user_id": original_post["user_id"]},
                    {"_id": 0}
                )
                original_post["user"] = original_user
                post["original_post"] = original_post
        
        # Check if current user reacted
        user_reaction = await db.reactions.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["user_reaction"] = user_reaction["reaction_type"] if user_reaction else None
        
        # Keep backward compatibility
        post["liked"] = user_reaction and user_reaction["reaction_type"] == "like"
        
        # Check if current user disliked
        disliked = await db.dislikes.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["disliked"] = disliked is not None
        
        # Check if current user saved
        saved = await db.saved_posts.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["saved"] = saved is not None
        
        # Check if current user reposted this
        reposted = await db.posts.find_one({
            "user_id": current_user.user_id,
            "is_repost": True,
            "original_post_id": post["post_id"]
        })
        post["reposted"] = reposted is not None
    
    return posts

@api_router.get("/posts/explore")
async def get_explore(
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get explore posts with pagination"""
    # Security: Enforce pagination limits
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Add user data
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
        
        # If this is a repost, get original post data
        if post.get("is_repost") and post.get("original_post_id"):
            original_post = await db.posts.find_one(
                {"post_id": post["original_post_id"]},
                {"_id": 0}
            )
            if original_post:
                original_user = await db.users.find_one(
                    {"user_id": original_post["user_id"]},
                    {"_id": 0}
                )
                original_post["user"] = original_user
                post["original_post"] = original_post
        
        # Check if current user reacted
        user_reaction = await db.reactions.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["user_reaction"] = user_reaction["reaction_type"] if user_reaction else None
        
        # Keep backward compatibility
        post["liked"] = user_reaction and user_reaction["reaction_type"] == "like"
        
        # Check if current user disliked
        disliked = await db.dislikes.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["disliked"] = disliked is not None
        
        # Check if current user saved
        saved = await db.saved_posts.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["saved"] = saved is not None
        
        # Check if current user reposted this
        reposted = await db.posts.find_one({
            "user_id": current_user.user_id,
            "is_repost": True,
            "original_post_id": post["post_id"]
        })
        post["reposted"] = reposted is not None
    
    return posts

@api_router.get("/posts/{post_id}")
async def get_post_by_id(post_id: str, current_user: User = Depends(require_auth)):
    """Get a single post by ID"""
    validate_id(post_id, "post_id")
    
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Enrich with user info
    user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0, "password": 0})
    post["user"] = user
    
    # Check if current user liked/disliked/saved
    reaction = await db.reactions.find_one({"post_id": post_id, "user_id": current_user.user_id})
    post["liked"] = reaction is not None and reaction.get("type") == "like"
    post["disliked"] = reaction is not None and reaction.get("type") == "dislike"
    
    saved = await db.saved_posts.find_one({"post_id": post_id, "user_id": current_user.user_id})
    post["saved"] = saved is not None
    
    return post

@api_router.post("/posts")
async def create_post(
    content: Optional[str] = Form(""),  # Allow empty content for media-only posts
    media: Optional[UploadFile] = File(None),
    tagged_users: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    poll_question: Optional[str] = Form(None),
    poll_options: Optional[str] = Form(None),  # JSON string
    poll_duration_hours: Optional[int] = Form(24),
    current_user: User = Depends(require_auth)
):
    # Security: Sanitize and validate content
    content = sanitize_string(content or "", MAX_INPUT_LENGTH, "content")
    location = sanitize_string(location or "", 200, "location") if location else None
    poll_question = sanitize_string(poll_question or "", 500, "poll_question") if poll_question else None
    
    # Validate that at least some content exists
    if not content and not media and not poll_question:
        raise HTTPException(status_code=422, detail="Post must have content, media, or poll")
    
    media_url = None
    media_type = None
    thumbnail_url = None
    media_public_id = None
    
    if media:
        # Security: Validate file upload
        file_content = await validate_file_upload(media, ALLOWED_MEDIA_TYPES, MAX_FILE_SIZE)
        
        # Upload to Cloudinary (or base64 fallback)
        upload_result = await upload_media(
            file_data=file_content,
            filename=media.filename or "upload",
            content_type=media.content_type or "application/octet-stream",
            folder="grover/posts",
            generate_thumbnail=True
        )
        
        media_url = upload_result["url"]
        media_type = upload_result["media_type"]
        thumbnail_url = upload_result.get("thumbnail")
        media_public_id = upload_result.get("public_id")
    
    # Parse tagged users (comma-separated user_ids)
    tagged_user_list = []
    if tagged_users:
        tagged_user_list = [u.strip() for u in tagged_users.split(',') if u.strip()]
    
    # Parse poll data
    has_poll = False
    poll_options_list = None
    poll_expires_at = None
    if poll_question and poll_options:
        has_poll = True
        import json
        poll_options_list = json.loads(poll_options) if isinstance(poll_options, str) else poll_options
        poll_expires_at = datetime.now(timezone.utc) + timedelta(hours=poll_duration_hours)
    
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    post_data = {
        "post_id": post_id,
        "user_id": current_user.user_id,
        "content": content,
        "media_url": media_url,
        "media_type": media_type,
        "thumbnail_url": thumbnail_url,
        "media_public_id": media_public_id,
        "likes_count": 0,
        "dislikes_count": 0,
        "shares_count": 0,
        "comments_count": 0,
        "repost_count": 0,
        "reaction_counts": {},
        "tagged_users": tagged_user_list,
        "location": location,
        "has_poll": has_poll,
        "created_at": datetime.now(timezone.utc)
    }
    
    if has_poll:
        post_data["poll_question"] = poll_question
        post_data["poll_options"] = poll_options_list
        post_data["poll_votes"] = {str(i): 0 for i in range(len(poll_options_list))}
        post_data["poll_expires_at"] = poll_expires_at
    
    await db.posts.insert_one(post_data)
    
    # Create notifications for tagged users
    for tagged_user_id in tagged_user_list:
        if tagged_user_id != current_user.user_id:
            await create_notification(
                tagged_user_id,
                "mention",
                f"{current_user.name} tagged you in a post",
                post_id
            )
    
    return {"post_id": post_id, "message": "Post created"}

@api_router.post("/posts/{post_id}/react")
async def react_to_post(
    post_id: str,
    reaction_type: str,
    current_user: User = Depends(require_auth)
):
    """React to a post with various reactions: like, love, wow, sad, angry, or custom emoji"""
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Valid reaction types
    valid_reactions = ["like", "love", "wow", "sad", "angry", "care", "haha"]
    
    # Check if it's a valid reaction or custom emoji
    if reaction_type not in valid_reactions and len(reaction_type) > 10:
        raise HTTPException(status_code=400, detail="Invalid reaction type")
    
    # Check if user already reacted
    existing = await db.reactions.find_one({
        "user_id": current_user.user_id,
        "post_id": post_id
    })
    
    if existing:
        # If same reaction, remove it (toggle off)
        if existing["reaction_type"] == reaction_type:
            await db.reactions.delete_one({"user_id": current_user.user_id, "post_id": post_id})
            
            # Decrement reaction count
            reaction_counts = post.get("reaction_counts", {})
            reaction_counts[reaction_type] = max(0, reaction_counts.get(reaction_type, 1) - 1)
            await db.posts.update_one(
                {"post_id": post_id},
                {"$set": {"reaction_counts": reaction_counts}}
            )
            
            return {"reacted": False, "reaction_type": None, "reaction_counts": reaction_counts}
        else:
            # Change reaction
            old_type = existing["reaction_type"]
            await db.reactions.update_one(
                {"user_id": current_user.user_id, "post_id": post_id},
                {"$set": {"reaction_type": reaction_type, "created_at": datetime.now(timezone.utc)}}
            )
            
            # Update counts
            reaction_counts = post.get("reaction_counts", {})
            reaction_counts[old_type] = max(0, reaction_counts.get(old_type, 1) - 1)
            reaction_counts[reaction_type] = reaction_counts.get(reaction_type, 0) + 1
            await db.posts.update_one(
                {"post_id": post_id},
                {"$set": {"reaction_counts": reaction_counts}}
            )
            
            return {"reacted": True, "reaction_type": reaction_type, "reaction_counts": reaction_counts}
    else:
        # New reaction
        await db.reactions.insert_one({
            "user_id": current_user.user_id,
            "post_id": post_id,
            "reaction_type": reaction_type,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Update counts
        reaction_counts = post.get("reaction_counts", {})
        reaction_counts[reaction_type] = reaction_counts.get(reaction_type, 0) + 1
        await db.posts.update_one(
            {"post_id": post_id},
            {"$set": {"reaction_counts": reaction_counts}}
        )
        
        # Create notification
        if post["user_id"] != current_user.user_id:
            reaction_emoji = {
                "like": "👍",
                "love": "❤️",
                "wow": "😮",
                "sad": "😢",
                "angry": "😠",
                "care": "🤗",
                "haha": "😂"
            }.get(reaction_type, reaction_type)
            
            await create_notification(
                post["user_id"],
                "reaction",
                f"{current_user.name} reacted {reaction_emoji} to your post",
                post_id
            )
        
        return {"reacted": True, "reaction_type": reaction_type, "reaction_counts": reaction_counts}

@api_router.get("/posts/{post_id}/reactions")
async def get_post_reactions(post_id: str, current_user: User = Depends(require_auth)):
    """Get detailed reactions for a post"""
    reactions = await db.reactions.find({"post_id": post_id}, {"_id": 0}).to_list(1000)
    
    # Group by reaction type and add user data
    grouped = {}
    for reaction in reactions:
        r_type = reaction["reaction_type"]
        if r_type not in grouped:
            grouped[r_type] = []
        
        user = await db.users.find_one({"user_id": reaction["user_id"]}, {"_id": 0, "name": 1, "picture": 1})
        grouped[r_type].append({
            "user": user,
            "created_at": reaction["created_at"]
        })
    
    return grouped

# Keep old like endpoint for backward compatibility
@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: User = Depends(require_auth)):
    """Legacy like endpoint - redirects to react"""
    return await react_to_post(post_id, "like", current_user)

@api_router.post("/posts/{post_id}/dislike")
async def dislike_post(post_id: str, current_user: User = Depends(require_auth)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.dislikes.find_one({
        "user_id": current_user.user_id,
        "post_id": post_id
    })
    
    if existing:
        # Remove dislike
        await db.dislikes.delete_one({
            "user_id": current_user.user_id,
            "post_id": post_id
        })
        await db.posts.update_one(
            {"post_id": post_id},
            {"$inc": {"dislikes_count": -1}}
        )
        return {"message": "Dislike removed", "disliked": False}
    else:
        # Dislike (remove like if exists)
        await db.likes.delete_one({
            "user_id": current_user.user_id,
            "post_id": post_id
        })
        
        await db.dislikes.insert_one({
            "user_id": current_user.user_id,
            "post_id": post_id,
            "created_at": datetime.now(timezone.utc)
        })
        await db.posts.update_one(
            {"post_id": post_id},
            {"$inc": {"dislikes_count": 1}}
        )
        
        return {"message": "Disliked", "disliked": True}

@api_router.post("/posts/{post_id}/save")
async def save_post(post_id: str, current_user: User = Depends(require_auth)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.saved_posts.find_one({
        "user_id": current_user.user_id,
        "post_id": post_id
    })
    
    if existing:
        # Unsave
        await db.saved_posts.delete_one({
            "user_id": current_user.user_id,
            "post_id": post_id
        })
        return {"message": "Post unsaved", "saved": False}
    else:
        # Save
        await db.saved_posts.insert_one({
            "user_id": current_user.user_id,
            "post_id": post_id,
            "created_at": datetime.now(timezone.utc)
        })
        return {"message": "Post saved", "saved": True}

@api_router.post("/posts/{post_id}/share")
async def share_post(post_id: str, current_user: User = Depends(require_auth)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Increment share count
    await db.posts.update_one(
        {"post_id": post_id},
        {"$inc": {"shares_count": 1}}
    )
    
    # Create notification
    if post["user_id"] != current_user.user_id:
        await create_notification(
            post["user_id"],
            "share",
            f"{current_user.name} shared your post",
            post_id
        )
    
    return {"message": "Post shared", "shares_count": post.get("shares_count", 0) + 1}

@api_router.post("/posts/{post_id}/repost")
async def repost_post(
    post_id: str,
    repost_comment: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """Repost/retweet a post with optional commentary"""
    # Check if original post exists
    original_post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not original_post:
        raise HTTPException(status_code=404, detail="Original post not found")
    
    # Check if user already reposted this
    existing_repost = await db.posts.find_one({
        "user_id": current_user.user_id,
        "is_repost": True,
        "original_post_id": post_id
    })
    
    if existing_repost:
        raise HTTPException(status_code=400, detail="You have already reposted this")
    
    # Create repost
    repost_id = f"post_{uuid.uuid4().hex[:12]}"
    repost_data = {
        "post_id": repost_id,
        "user_id": current_user.user_id,
        "content": original_post["content"],
        "media_url": original_post.get("media_url"),
        "media_type": original_post.get("media_type"),
        "likes_count": 0,
        "dislikes_count": 0,
        "shares_count": 0,
        "comments_count": 0,
        "repost_count": 0,
        "reaction_counts": {},
        "tagged_users": original_post.get("tagged_users", []),
        "location": original_post.get("location"),
        "is_repost": True,
        "original_post_id": post_id,
        "repost_comment": repost_comment,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.posts.insert_one(repost_data)
    
    # Increment repost count on original post
    await db.posts.update_one(
        {"post_id": post_id},
        {"$inc": {"repost_count": 1}}
    )
    
    # Create notification for original author
    if original_post["user_id"] != current_user.user_id:
        await create_notification(
            original_post["user_id"],
            "repost",
            f"{current_user.name} reposted your post",
            repost_id
        )
    
    return {
        "message": "Post reposted successfully",
        "repost_id": repost_id,
        "repost_count": original_post.get("repost_count", 0) + 1
    }

@api_router.delete("/posts/{post_id}/unrepost")
async def unrepost_post(post_id: str, current_user: User = Depends(require_auth)):
    """Remove a repost"""
    # Find the repost
    repost = await db.posts.find_one({
        "user_id": current_user.user_id,
        "is_repost": True,
        "original_post_id": post_id
    })
    
    if not repost:
        raise HTTPException(status_code=404, detail="Repost not found")
    
    # Delete the repost
    await db.posts.delete_one({"post_id": repost["post_id"]})
    
    # Decrement repost count on original post
    await db.posts.update_one(
        {"post_id": post_id},
        {"$inc": {"repost_count": -1}}
    )
    
    return {"message": "Repost removed"}

@api_router.get("/posts/{post_id}/reposts")
async def get_post_reposts(post_id: str, current_user: User = Depends(require_auth)):
    """Get all reposts of a specific post"""
    reposts = await db.posts.find(
        {"is_repost": True, "original_post_id": post_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add user data for each repost
    for repost in reposts:
        user = await db.users.find_one({"user_id": repost["user_id"]}, {"_id": 0})
        repost["user"] = user
    
    return reposts

@api_router.get("/posts/saved")
async def get_saved_posts(current_user: User = Depends(require_auth)):
    saved = await db.saved_posts.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    post_ids = [s["post_id"] for s in saved]
    posts = await db.posts.find(
        {"post_id": {"$in": post_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Add user data and liked status
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
        
        # Check if current user reacted
        user_reaction = await db.reactions.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["user_reaction"] = user_reaction["reaction_type"] if user_reaction else None
        
        # Keep backward compatibility
        post["liked"] = user_reaction and user_reaction["reaction_type"] == "like"
        
        disliked = await db.dislikes.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["disliked"] = disliked is not None
        post["saved"] = True
    
    return posts

@api_router.get("/mentions")
async def get_mentions(current_user: User = Depends(require_auth)):
    """Get posts where the current user has been mentioned/tagged"""
    # Find posts where current user is in tagged_users array
    posts = await db.posts.find(
        {"tagged_users": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add user data and liked status for each post
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
        
        # Check if current user reacted/liked this post
        user_reaction = await db.reactions.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["user_reaction"] = user_reaction["reaction_type"] if user_reaction else None
        post["is_liked"] = user_reaction and user_reaction["reaction_type"] == "like"
        post["liked"] = post["is_liked"]  # backward compatibility
    
    return posts

@api_router.delete("/posts/{post_id}/like")
async def unlike_post(post_id: str, current_user: User = Depends(require_auth)):
    """Remove a like/reaction from a post"""
    validate_id(post_id, "post_id")
    
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Remove the reaction
    result = await db.reactions.delete_one({
        "post_id": post_id,
        "user_id": current_user.user_id
    })
    
    if result.deleted_count > 0:
        # Decrement the likes count
        await db.posts.update_one(
            {"post_id": post_id},
            {"$inc": {"likes_count": -1}}
        )
        return {"message": "Like removed", "liked": False}
    
    return {"message": "No like to remove", "liked": False}

@api_router.put("/posts/{post_id}")
async def update_post(
    post_id: str,
    content: str = None,
    current_user: User = Depends(require_auth)
):
    """Update a post"""
    validate_id(post_id, "post_id")
    
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    if content is not None:
        update_data["content"] = sanitize_string(content, 5000, "content")
    
    await db.posts.update_one({"post_id": post_id}, {"$set": update_data})
    return {"message": "Post updated"}

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: User = Depends(require_auth)):
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.posts.delete_one({"post_id": post_id})
    await db.likes.delete_many({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    
    return {"message": "Post deleted"}

# ============ COMMENT ENDPOINTS ============

@api_router.get("/posts/{post_id}/comments")
async def get_comments(post_id: str, current_user: User = Depends(require_auth)):
    """Get all comments for a post (only top-level, not replies)"""
    comments = await db.comments.find(
        {"post_id": post_id, "parent_comment_id": None},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Add user data and liked status
    for comment in comments:
        user = await db.users.find_one({"user_id": comment["user_id"]}, {"_id": 0})
        comment["user"] = user
        
        liked = await db.comment_likes.find_one({
            "user_id": current_user.user_id,
            "comment_id": comment["comment_id"]
        })
        comment["liked"] = liked is not None
    
    return comments

@api_router.get("/comments/{comment_id}/replies")
async def get_comment_replies(comment_id: str, current_user: User = Depends(require_auth)):
    """Get all replies to a comment"""
    replies = await db.comments.find(
        {"parent_comment_id": comment_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    # Add user data and liked status
    for reply in replies:
        user = await db.users.find_one({"user_id": reply["user_id"]}, {"_id": 0})
        reply["user"] = user
        
        liked = await db.comment_likes.find_one({
            "user_id": current_user.user_id,
            "comment_id": reply["comment_id"]
        })
        reply["liked"] = liked is not None
    
    return replies

class CommentCreate(BaseModel):
    content: str
    parent_comment_id: Optional[str] = None
    
    @validator('content')
    def validate_content(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Comment content cannot be empty')
        if len(v) > 2000:
            raise ValueError('Comment too long (max 2000 characters)')
        return v.strip()

@api_router.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    comment_data: CommentCreate,
    current_user: User = Depends(require_auth)
):
    """Create a comment or reply"""
    # Security: Validate post_id format
    validate_id(post_id, "post_id")
    
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Security: Sanitize content
    content = sanitize_string(comment_data.content, 2000, "content")
    parent_comment_id = comment_data.parent_comment_id
    if parent_comment_id:
        validate_id(parent_comment_id, "parent_comment_id")
    
    # Extract tagged users from content (@username)
    import re
    mentions = re.findall(r'@(\w+)', content)
    tagged_user_ids = []
    
    # Find user_ids for mentioned usernames (simplified - would need username field in real app)
    for mention in mentions:
        # In real app, would search by username
        pass
    
    comment_id = f"comment_{uuid.uuid4().hex[:12]}"
    comment_doc = {
        "comment_id": comment_id,
        "post_id": post_id,
        "user_id": current_user.user_id,
        "content": content,
        "parent_comment_id": parent_comment_id,
        "likes_count": 0,
        "replies_count": 0,
        "tagged_users": tagged_user_ids,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.comments.insert_one(comment_doc)
    
    # Update post comment count
    if not parent_comment_id:
        await db.posts.update_one(
            {"post_id": post_id},
            {"$inc": {"comments_count": 1}}
        )
    else:
        # Update parent comment reply count
        await db.comments.update_one(
            {"comment_id": parent_comment_id},
            {"$inc": {"replies_count": 1}}
        )
    
    # Create notification for post owner (if not commenting on own post)
    if post["user_id"] != current_user.user_id:
        await create_notification(
            post["user_id"],
            "comment",
            f"{current_user.name} commented on your post",
            comment_id
        )
    
    # If it's a reply, notify the parent comment owner
    if parent_comment_id:
        parent_comment = await db.comments.find_one({"comment_id": parent_comment_id})
        if parent_comment and parent_comment["user_id"] != current_user.user_id:
            await create_notification(
                parent_comment["user_id"],
                "comment",
                f"{current_user.name} replied to your comment",
                comment_id
            )
    
    return {"comment_id": comment_id, "message": "Comment created"}

@api_router.post("/comments/{comment_id}/like")
async def like_comment(comment_id: str, current_user: User = Depends(require_auth)):
    """Like or unlike a comment"""
    comment = await db.comments.find_one({"comment_id": comment_id}, {"_id": 0})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    existing = await db.comment_likes.find_one({
        "user_id": current_user.user_id,
        "comment_id": comment_id
    })
    
    if existing:
        # Unlike
        await db.comment_likes.delete_one({
            "user_id": current_user.user_id,
            "comment_id": comment_id
        })
        await db.comments.update_one(
            {"comment_id": comment_id},
            {"$inc": {"likes_count": -1}}
        )
        return {"message": "Comment unliked", "liked": False}
    else:
        # Like
        await db.comment_likes.insert_one({
            "user_id": current_user.user_id,
            "comment_id": comment_id,
            "created_at": datetime.now(timezone.utc)
        })
        await db.comments.update_one(
            {"comment_id": comment_id},
            {"$inc": {"likes_count": 1}}
        )
        
        # Create notification for comment owner
        if comment["user_id"] != current_user.user_id:
            await db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": comment["user_id"],
                "type": "comment_like",
                "content": f"{current_user.name} liked your comment",
                "read": False,
                "created_at": datetime.now(timezone.utc)
            })
        
        return {"message": "Comment liked", "liked": True}

@api_router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, current_user: User = Depends(require_auth)):
    """Delete a comment"""
    comment = await db.comments.find_one({"comment_id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete comment and all its replies
    await db.comments.delete_one({"comment_id": comment_id})
    await db.comments.delete_many({"parent_comment_id": comment_id})
    await db.comment_likes.delete_many({"comment_id": comment_id})
    
    # Update post comment count
    if not comment.get("parent_comment_id"):
        await db.posts.update_one(
            {"post_id": comment["post_id"]},
            {"$inc": {"comments_count": -1}}
        )
    else:
        # Update parent comment reply count
        await db.comments.update_one(
            {"comment_id": comment["parent_comment_id"]},
            {"$inc": {"replies_count": -1}}
        )
    
    return {"message": "Comment deleted"}

# ============ PRODUCT ENDPOINTS ============

@api_router.get("/products")
async def get_products(current_user: User = Depends(require_auth)):
    products = await db.products.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for product in products:
        user = await db.users.find_one({"user_id": product["user_id"]}, {"_id": 0})
        product["user"] = user
    
    return products

@api_router.get("/products/me")
async def get_products_me(
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get current user's products with pagination"""
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    products = await db.products.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return products

@api_router.get("/products/my-products")
async def get_my_products(current_user: User = Depends(require_auth)):
    products = await db.products.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return products

@api_router.post("/products")
async def create_product(
    name: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    product_type: str = Form("physical"),  # physical, digital, service
    service_duration: Optional[int] = Form(None),  # minutes for service type
    digital_file_url: Optional[str] = Form(None),  # URL for digital downloads
    is_bundle: bool = Form(False),
    bundle_items: Optional[str] = Form(None),  # JSON array of product IDs
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_auth)
):
    # Security: Validate and sanitize inputs
    name = sanitize_string(name, 200, "name")
    if not name:
        raise HTTPException(status_code=400, detail="Product name is required")
    
    description = sanitize_string(description, 2000, "description")
    
    # Validate product type
    valid_types = ["physical", "digital", "service"]
    if product_type not in valid_types:
        product_type = "physical"
    
    # Validate price
    if price <= 0 or price > 100000:
        raise HTTPException(status_code=400, detail="Invalid price (must be between 0.01 and 100000)")
    
    image_url = None
    image_public_id = None
    if image:
        # Security: Validate file upload
        file_content = await validate_file_upload(image, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE)
        
        # Upload to Cloudinary (or base64 fallback)
        upload_result = await upload_media(
            file_data=file_content,
            filename=image.filename or "product",
            content_type=image.content_type or "image/jpeg",
            folder="grover/products",
            generate_thumbnail=False
        )
        image_url = upload_result["url"]
        image_public_id = upload_result.get("public_id")
    
    # Parse bundle items if provided
    bundle_items_list = []
    if bundle_items:
        try:
            import json
            bundle_items_list = json.loads(bundle_items)
        except (json.JSONDecodeError, ValueError, TypeError):
            pass
    
    product_id = f"prod_{uuid.uuid4().hex[:12]}"
    product_data = {
        "product_id": product_id,
        "user_id": current_user.user_id,
        "name": name,
        "description": description,
        "price": round(price, 2),  # Ensure 2 decimal places
        "product_type": product_type,
        "image_url": image_url,
        "image_public_id": image_public_id,
        "is_bundle": is_bundle,
        "rating": 0,
        "reviews_count": 0,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Add type-specific fields
    if product_type == "service" and service_duration:
        product_data["service_duration"] = service_duration
    if product_type == "digital" and digital_file_url:
        product_data["digital_file_url"] = digital_file_url
    if is_bundle and bundle_items_list:
        product_data["bundle_items"] = bundle_items_list
    
    await db.products.insert_one(product_data)
    
    return {"product_id": product_id, "message": "Product created"}

@api_router.get("/products/{product_id}")
async def get_product_by_id(product_id: str, current_user: User = Depends(require_auth)):
    """Get a single product by ID"""
    validate_id(product_id, "product_id")
    
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Add user info
    user = await db.users.find_one({"user_id": product["user_id"]}, {"_id": 0})
    product["user"] = user
    
    return product

@api_router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    name: str = None,
    description: str = None,
    price: float = None,
    current_user: User = Depends(require_auth)
):
    """Update a product"""
    validate_id(product_id, "product_id")
    
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    if name is not None:
        update_data["name"] = sanitize_string(name, 200, "name")
    if description is not None:
        update_data["description"] = sanitize_string(description, 2000, "description")
    if price is not None:
        if price < 0:
            raise HTTPException(status_code=400, detail="Price cannot be negative")
        update_data["price"] = round(price, 2)
    
    await db.products.update_one({"product_id": product_id}, {"$set": update_data})
    return {"message": "Product updated"}

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(require_auth)):
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.products.delete_one({"product_id": product_id})
    return {"message": "Product deleted"}

# ============ DISCOUNT CODE ENDPOINTS ============

class DiscountCodeCreate(BaseModel):
    code: str
    percent: float
    expiry: Optional[str] = None

@api_router.post("/discounts")
async def create_discount(
    data: DiscountCodeCreate,
    current_user: User = Depends(require_auth)
):
    """Create a new discount code"""
    code = data.code.strip().upper()
    
    if not code or len(code) < 3 or len(code) > 20:
        raise HTTPException(status_code=400, detail="Code must be 3-20 characters")
    
    if data.percent <= 0 or data.percent > 100:
        raise HTTPException(status_code=400, detail="Percent must be between 1-100")
    
    # Check if code already exists
    existing = await db.discounts.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Discount code already exists")
    
    # Parse expiry date if provided
    expires_at = None
    if data.expiry:
        try:
            expires_at = datetime.fromisoformat(data.expiry.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid expiry date format")
    
    discount_data = {
        "code": code,
        "percent": data.percent,
        "user_id": current_user.user_id,
        "expires_at": expires_at,
        "uses_count": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.discounts.insert_one(discount_data)
    
    return {
        "code": code,
        "percent": data.percent,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "message": "Discount code created"
    }

@api_router.get("/discounts")
async def get_my_discounts(current_user: User = Depends(require_auth)):
    """Get all discount codes created by the current user"""
    discounts = await db.discounts.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return discounts

@api_router.get("/discounts/validate/{code}")
async def validate_discount(code: str, current_user: User = Depends(require_auth)):
    """Validate a discount code"""
    code = code.strip().upper()
    
    discount = await db.discounts.find_one({"code": code, "is_active": True}, {"_id": 0})
    if not discount:
        raise HTTPException(status_code=404, detail="Invalid or expired discount code")
    
    # Check expiry
    if discount.get("expires_at"):
        expires_at = discount["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Discount code has expired")
    
    return {
        "code": discount["code"],
        "percent": discount["percent"],
        "valid": True
    }

@api_router.delete("/discounts/{code}")
async def delete_discount(code: str, current_user: User = Depends(require_auth)):
    """Delete a discount code (soft delete - sets is_active to false)"""
    code = code.strip().upper()
    
    discount = await db.discounts.find_one({"code": code})
    if not discount:
        raise HTTPException(status_code=404, detail="Discount code not found")
    
    if discount["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.discounts.update_one(
        {"code": code},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Discount code deleted"}

# ============ ORDER ENDPOINTS ============

@api_router.post("/paypal/create-payment")
async def create_paypal_payment(
    product_id: str,
    current_user: User = Depends(require_auth)
):
    """Create a PayPal payment for a product"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Create PayPal payment
    result = create_payment(
        amount=product["price"],
        currency="USD",
        description=f"Purchase: {product['name']}"
    )
    
    if result["success"]:
        return {
            "success": True,
            "payment_id": result["payment_id"],
            "approval_url": result["approval_url"]
        }
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Payment creation failed"))

@api_router.post("/paypal/execute-payment")
async def execute_paypal_payment(
    payment_id: str,
    payer_id: str,
    product_id: str,
    current_user: User = Depends(require_auth)
):
    """Execute a PayPal payment after user approval"""
    result = execute_payment(payment_id, payer_id)
    
    if result["success"]:
        # Get product details
        product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Get seller info
        seller = await db.users.find_one({"user_id": product["user_id"]}, {"_id": 0})
        
        # Calculate platform fee (5% for now, can be adjusted)
        platform_fee_percentage = 0.05
        platform_fee = product["price"] * platform_fee_percentage
        seller_amount = product["price"] - platform_fee
        
        # Create order in database
        order_id = f"order_{uuid.uuid4().hex[:12]}"
        await db.orders.insert_one({
            "order_id": order_id,
            "buyer_id": current_user.user_id,
            "seller_id": product["user_id"],
            "product_id": product_id,
            "amount": product["price"],
            "platform_fee": platform_fee,
            "seller_amount": seller_amount,
            "status": "completed",
            "paypal_payment_id": payment_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Send payout to seller if they have PayPal configured
        payout_info = None
        if seller and seller.get("paypal_email"):
            payout_result = send_payout(
                recipient_email=seller["paypal_email"],
                amount=seller_amount,
                note=f"Sale of '{product['name']}' on Grover"
            )
            
            if payout_result["success"]:
                # Update order with payout info
                await db.orders.update_one(
                    {"order_id": order_id},
                    {"$set": {
                        "payout_batch_id": payout_result.get("payout_batch_id"),
                        "payout_status": "sent"
                    }}
                )
                payout_info = "Payout sent to seller's PayPal"
            else:
                logger.error(f"Payout failed for order {order_id}: {payout_result.get('error')}")
                await db.orders.update_one(
                    {"order_id": order_id},
                    {"$set": {"payout_status": "failed", "payout_error": payout_result.get("error")}}
                )
                payout_info = "Payment received, but seller payout pending"
        else:
            # Seller doesn't have PayPal configured
            await db.orders.update_one(
                {"order_id": order_id},
                {"$set": {"payout_status": "pending_seller_setup"}}
            )
            payout_info = "Seller needs to configure PayPal to receive funds"
        
        # Create notification
        await create_notification(
            product["user_id"],
            "sale",
            f"{current_user.name} purchased {product['name']}",
            order_id
        )
        
        return {
            "success": True,
            "order_id": order_id,
            "message": "Payment completed successfully",
            "payout_info": payout_info,
            "seller_amount": seller_amount,
            "platform_fee": platform_fee
        }
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Payment execution failed"))

@api_router.post("/orders")
async def create_order(
    product_id: str,
    paypal_order_id: str,
    current_user: User = Depends(require_auth)
):
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    await db.orders.insert_one({
        "order_id": order_id,
        "buyer_id": current_user.user_id,
        "seller_id": product["user_id"],
        "product_id": product_id,
        "amount": product["price"],
        "status": "completed",
        "paypal_order_id": paypal_order_id,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Create notification
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": product["user_id"],
        "type": "purchase",
        "content": f"{current_user.name} purchased {product['name']}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"order_id": order_id, "message": "Order created"}

@api_router.get("/orders/my-orders")
async def get_my_orders(current_user: User = Depends(require_auth)):
    orders = await db.orders.find(
        {"buyer_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for order in orders:
        product = await db.products.find_one({"product_id": order["product_id"]}, {"_id": 0})
        order["product"] = product
    
    return orders

# ============ MESSAGE ENDPOINTS ============

@api_router.get("/messages/conversations")
async def get_conversations(current_user: User = Depends(require_auth)):
    conversations = await db.conversations.find(
        {"participants": current_user.user_id},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)
    
    for conv in conversations:
        # Get other user
        other_user_id = [p for p in conv["participants"] if p != current_user.user_id][0]
        other_user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0})
        conv["other_user"] = other_user
        
        # Get unread count
        unread_count = await db.messages.count_documents({
            "conversation_id": conv["conversation_id"],
            "sender_id": {"$ne": current_user.user_id},
            "read": False
        })
        conv["unread_count"] = unread_count
    
    return conversations

@api_router.get("/messages/{user_id}")
async def get_messages(user_id: str, current_user: User = Depends(require_auth)):
    # Find or create conversation
    conv = await db.conversations.find_one({
        "participants": {"$all": [current_user.user_id, user_id]}
    }, {"_id": 0})
    
    if not conv:
        conv_id = f"conv_{uuid.uuid4().hex[:12]}"
        await db.conversations.insert_one({
            "conversation_id": conv_id,
            "participants": [current_user.user_id, user_id],
            "last_message": "",
            "last_message_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc)
        })
        return {"conversation_id": conv_id, "messages": []}
    
    messages = await db.messages.find(
        {"conversation_id": conv["conversation_id"]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    # Mark as read
    await db.messages.update_many(
        {
            "conversation_id": conv["conversation_id"],
            "sender_id": user_id,
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    return {"conversation_id": conv["conversation_id"], "messages": messages}

# ============ RICH MESSAGES ENDPOINTS ============

@api_router.post("/messages/send-post")
async def send_post_in_dm(
    receiver_id: str,
    post_id: str,
    message_text: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """Send a post in DM"""
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    
    await db.messages.insert_one({
        "message_id": message_id,
        "sender_id": current_user.user_id,
        "receiver_id": receiver_id,
        "content": message_text or "",
        "type": "post",
        "shared_post_id": post_id,
        "shared_post": post,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    await create_notification(receiver_id, "message", f"{current_user.name} shared a post with you", message_id)
    
    return {"message_id": message_id, "message": "Post sent"}

@api_router.post("/messages/send-voice")
async def send_voice_message(
    receiver_id: str,
    audio: UploadFile,
    duration: int = Form(...),
    current_user: User = Depends(require_auth)
):
    """Send voice message"""
    # Security: Validate receiver_id and file
    validate_id(receiver_id, "receiver_id")
    
    audio_content = await validate_file_upload(audio, ALLOWED_AUDIO_TYPES, MAX_FILE_SIZE)
    audio_base64 = base64.b64encode(audio_content).decode('utf-8')
    
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    
    await db.messages.insert_one({
        "message_id": message_id,
        "sender_id": current_user.user_id,
        "receiver_id": receiver_id,
        "content": "",
        "type": "voice",
        "voice_data": audio_base64,
        "duration": duration,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    await create_notification(receiver_id, "message", f"{current_user.name} sent a voice message", message_id)
    
    return {"message_id": message_id, "message": "Voice message sent"}

@api_router.post("/messages/send-video")
async def send_video_message(
    receiver_id: str,
    video: UploadFile,
    thumbnail: Optional[UploadFile] = None,
    duration: int = Form(...),
    current_user: User = Depends(require_auth)
):
    """Send video message"""
    # Security: Validate receiver_id and files
    validate_id(receiver_id, "receiver_id")
    
    video_content = await validate_file_upload(video, ALLOWED_VIDEO_TYPES, MAX_FILE_SIZE)
    video_base64 = base64.b64encode(video_content).decode('utf-8')
    
    thumbnail_base64 = None
    if thumbnail:
        thumbnail_content = await validate_file_upload(thumbnail, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE)
        thumbnail_base64 = base64.b64encode(thumbnail_content).decode('utf-8')
    
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    
    await db.messages.insert_one({
        "message_id": message_id,
        "sender_id": current_user.user_id,
        "receiver_id": receiver_id,
        "content": "",
        "type": "video",
        "video_data": video_base64,
        "thumbnail": thumbnail_base64,
        "duration": duration,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    await create_notification(receiver_id, "message", f"{current_user.name} sent a video", message_id)
    
    return {"message_id": message_id, "message": "Video message sent"}

@api_router.post("/messages/send-gif")
async def send_gif_message(
    receiver_id: str,
    gif_url: str,
    current_user: User = Depends(require_auth)
):
    """Send GIF message"""
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    
    await db.messages.insert_one({
        "message_id": message_id,
        "sender_id": current_user.user_id,
        "receiver_id": receiver_id,
        "content": "",
        "type": "gif",
        "gif_url": gif_url,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message_id": message_id, "message": "GIF sent"}

# ============ GROUP CHATS ENDPOINTS ============

@api_router.post("/groups/create")
async def create_group(
    name: str,
    description: Optional[str] = None,
    member_ids: str = Form(...),  # Comma-separated
    photo: Optional[UploadFile] = None,
    current_user: User = Depends(require_auth)
):
    """Create a group chat"""
    member_list = [m.strip() for m in member_ids.split(',') if m.strip()]
    
    if len(member_list) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 members allowed")
    
    # Add creator to members
    if current_user.user_id not in member_list:
        member_list.append(current_user.user_id)
    
    photo_base64 = None
    if photo:
        photo_content = await photo.read()
        photo_base64 = base64.b64encode(photo_content).decode('utf-8')
    
    group_id = f"group_{uuid.uuid4().hex[:12]}"
    
    await db.groups.insert_one({
        "group_id": group_id,
        "name": name,
        "description": description,
        "photo": photo_base64,
        "creator_id": current_user.user_id,
        "admin_ids": [current_user.user_id],
        "member_ids": member_list,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    })
    
    # Notify members
    for member_id in member_list:
        if member_id != current_user.user_id:
            await create_notification(member_id, "group_invite", f"{current_user.name} added you to '{name}'", group_id)
    
    return {"group_id": group_id, "message": "Group created"}

@api_router.get("/groups/{group_id}")
async def get_group(group_id: str, current_user: User = Depends(require_auth)):
    """Get group details"""
    group = await db.groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if current_user.user_id not in group["member_ids"]:
        raise HTTPException(status_code=403, detail="Not a member")
    
    # Add member data
    members = []
    for member_id in group["member_ids"]:
        user = await db.users.find_one({"user_id": member_id}, {"_id": 0, "name": 1, "picture": 1})
        if user:
            user["is_admin"] = member_id in group.get("admin_ids", [])
            members.append(user)
    
    group["members"] = members
    group["is_admin"] = current_user.user_id in group.get("admin_ids", [])
    
    return group

@api_router.post("/groups/{group_id}/messages")
async def send_group_message(
    group_id: str,
    content: str,
    current_user: User = Depends(require_auth)
):
    """Send message to group"""
    group = await db.groups.find_one({"group_id": group_id})
    if not group or current_user.user_id not in group["member_ids"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    message_id = f"gmsg_{uuid.uuid4().hex[:12]}"
    
    await db.group_messages.insert_one({
        "message_id": message_id,
        "group_id": group_id,
        "sender_id": current_user.user_id,
        "content": content,
        "read_by": [current_user.user_id],
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message_id": message_id, "message": "Message sent"}

@api_router.get("/groups/{group_id}/messages")
async def get_group_messages(group_id: str, current_user: User = Depends(require_auth)):
    """Get group messages"""
    group = await db.groups.find_one({"group_id": group_id})
    if not group or current_user.user_id not in group["member_ids"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    messages = await db.group_messages.find(
        {"group_id": group_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    # Add sender data
    for msg in messages:
        user = await db.users.find_one({"user_id": msg["sender_id"]}, {"_id": 0, "name": 1, "picture": 1})
        msg["sender"] = user
    
    return messages[::-1]

@api_router.post("/groups/{group_id}/members/add")
async def add_group_member(
    group_id: str,
    user_id: str,
    current_user: User = Depends(require_auth)
):
    """Add member to group (admin only)"""
    group = await db.groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if current_user.user_id not in group.get("admin_ids", []):
        raise HTTPException(status_code=403, detail="Admin only")
    
    if len(group["member_ids"]) >= 50:
        raise HTTPException(status_code=400, detail="Group is full")
    
    await db.groups.update_one(
        {"group_id": group_id},
        {"$addToSet": {"member_ids": user_id}}
    )
    
    await create_notification(user_id, "group_invite", f"You were added to '{group['name']}'", group_id)
    
    return {"message": "Member added"}

@api_router.delete("/groups/{group_id}/members/{user_id}")
async def remove_group_member(
    group_id: str,
    user_id: str,
    current_user: User = Depends(require_auth)
):
    """Remove member from group (admin only)"""
    group = await db.groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if current_user.user_id not in group.get("admin_ids", []) and user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Admin only")
    
    await db.groups.update_one(
        {"group_id": group_id},
        {"$pull": {"member_ids": user_id}}
    )
    
    return {"message": "Member removed"}

# ============ COMMUNITIES ENDPOINTS ============

@api_router.post("/communities/create")
async def create_community(
    name: str,
    description: str,
    category: str,
    is_private: bool = False,
    cover_image: Optional[UploadFile] = None,
    current_user: User = Depends(require_auth)
):
    """Create an interest-based community"""
    cover_base64 = None
    if cover_image:
        cover_content = await cover_image.read()
        cover_base64 = base64.b64encode(cover_content).decode('utf-8')
    
    community_id = f"community_{uuid.uuid4().hex[:12]}"
    
    await db.communities.insert_one({
        "community_id": community_id,
        "name": name,
        "description": description,
        "category": category,
        "is_private": is_private,
        "cover_image": cover_base64,
        "creator_id": current_user.user_id,
        "moderator_ids": [current_user.user_id],
        "member_ids": [current_user.user_id],
        "member_count": 1,
        "post_count": 0,
        "rules": [],
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"community_id": community_id, "message": "Community created"}

@api_router.get("/communities/{community_id}")
async def get_community(community_id: str, current_user: User = Depends(require_auth)):
    """Get community details"""
    community = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    
    if community.get("is_private") and current_user.user_id not in community["member_ids"]:
        raise HTTPException(status_code=403, detail="Private community")
    
    community["is_member"] = current_user.user_id in community["member_ids"]
    community["is_moderator"] = current_user.user_id in community.get("moderator_ids", [])
    
    return community

@api_router.post("/communities/{community_id}/join")
async def join_community(community_id: str, current_user: User = Depends(require_auth)):
    """Join a community"""
    community = await db.communities.find_one({"community_id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    
    if community.get("is_private"):
        raise HTTPException(status_code=400, detail="Private community - request needed")
    
    await db.communities.update_one(
        {"community_id": community_id},
        {
            "$addToSet": {"member_ids": current_user.user_id},
            "$inc": {"member_count": 1}
        }
    )
    
    return {"message": "Joined community"}

@api_router.post("/communities/{community_id}/posts")
async def create_community_post(
    community_id: str,
    content: str,
    media: Optional[UploadFile] = None,
    current_user: User = Depends(require_auth)
):
    """Create post in community"""
    community = await db.communities.find_one({"community_id": community_id})
    if not community or current_user.user_id not in community["member_ids"]:
        raise HTTPException(status_code=403, detail="Not a member")
    
    media_url = None
    if media:
        media_content = await media.read()
        media_url = base64.b64encode(media_content).decode('utf-8')
    
    post_id = f"cpost_{uuid.uuid4().hex[:12]}"
    
    await db.community_posts.insert_one({
        "post_id": post_id,
        "community_id": community_id,
        "user_id": current_user.user_id,
        "content": content,
        "media_url": media_url,
        "likes_count": 0,
        "comments_count": 0,
        "created_at": datetime.now(timezone.utc)
    })
    
    await db.communities.update_one(
        {"community_id": community_id},
        {"$inc": {"post_count": 1}}
    )
    
    return {"post_id": post_id, "message": "Posted to community"}

@api_router.get("/communities/{community_id}/posts")
async def get_community_posts(community_id: str, current_user: User = Depends(require_auth)):
    """Get community posts"""
    community = await db.communities.find_one({"community_id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    
    if community.get("is_private") and current_user.user_id not in community["member_ids"]:
        raise HTTPException(status_code=403, detail="Private community")
    
    posts = await db.community_posts.find(
        {"community_id": community_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
    
    return posts

@api_router.get("/communities/discover")
async def discover_communities(current_user: User = Depends(require_auth)):
    """Discover public communities"""
    communities = await db.communities.find(
        {"is_private": False},
        {"_id": 0}
    ).sort("member_count", -1).limit(20).to_list(20)
    
    for community in communities:
        community["is_member"] = current_user.user_id in community.get("member_ids", [])
    
    return communities

# ============ VOICE/VIDEO CALLS ENDPOINTS ============

@api_router.post("/calls/initiate")
async def initiate_call(
    receiver_id: str,
    call_type: str,  # "voice" or "video"
    current_user: User = Depends(require_auth)
):
    """Initiate a voice or video call - Available to all users"""
    receiver = await db.users.find_one({"user_id": receiver_id})
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    call_id = f"call_{uuid.uuid4().hex[:12]}"
    channel_name = call_id
    
    # In production, generate Agora token here
    call_data = {
        "call_id": call_id,
        "caller_id": current_user.user_id,
        "receiver_id": receiver_id,
        "type": call_type,
        "status": "ringing",
        "channel_name": channel_name,
        "agora_token": "temp_token",
        "started_at": datetime.now(timezone.utc)
    }
    
    await db.calls.insert_one(call_data)
    
    # Notify receiver
    await create_notification(
        receiver_id,
        "call",
        f"{current_user.name} is calling you",
        call_id
    )
    
    return {
        "call_id": call_id,
        "channel_name": channel_name,
        "token": "temp_token"
    }

@api_router.post("/calls/{call_id}/answer")
async def answer_call(call_id: str, current_user: User = Depends(require_auth)):
    """Answer an incoming call"""
    call = await db.calls.find_one({"call_id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if call["receiver_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.calls.update_one(
        {"call_id": call_id},
        {"$set": {"status": "active", "answered_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "channel_name": call["channel_name"],
        "token": call["agora_token"]
    }

@api_router.post("/calls/{call_id}/end")
async def end_call(call_id: str, current_user: User = Depends(require_auth)):
    """End a call"""
    call = await db.calls.find_one({"call_id": call_id})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if current_user.user_id not in [call["caller_id"], call["receiver_id"]]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.calls.update_one(
        {"call_id": call_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Call ended"}

@api_router.get("/calls/history")
async def get_call_history(current_user: User = Depends(require_auth)):
    """Get call history"""
    calls = await db.calls.find(
        {"$or": [{"caller_id": current_user.user_id}, {"receiver_id": current_user.user_id}]},
        {"_id": 0}
    ).sort("started_at", -1).limit(50).to_list(50)
    
    for call in calls:
        # Add user data
        other_user_id = call["receiver_id"] if call["caller_id"] == current_user.user_id else call["caller_id"]
        user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0, "name": 1, "picture": 1})
        call["other_user"] = user
        call["is_incoming"] = call["receiver_id"] == current_user.user_id
    
    return calls

# ============ ANALYTICS ENDPOINTS ============

@api_router.get("/analytics/revenue")
async def get_revenue_analytics(current_user: User = Depends(require_auth)):
    orders = await db.orders.find(
        {"seller_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    total_revenue = sum(o["amount"] for o in orders)
    total_orders = len(orders)
    
    return {
        "total_revenue": total_revenue,
        "total_orders": total_orders
    }

@api_router.get("/analytics/engagement")
async def get_engagement_analytics(current_user: User = Depends(require_auth)):
    posts_count = await db.posts.count_documents({"user_id": current_user.user_id})
    
    posts = await db.posts.find({"user_id": current_user.user_id}, {"_id": 0}).to_list(1000)
    total_likes = sum(p["likes_count"] for p in posts)
    
    followers_count = await db.follows.count_documents({"following_id": current_user.user_id})
    
    return {
        "total_posts": posts_count,
        "total_likes": total_likes,
        "total_followers": followers_count
    }

# ============ NOTIFICATION ENDPOINTS ============

@api_router.get("/notifications")
async def get_notifications(
    limit: int = 50,
    skip: int = 0,
    unread_only: bool = False,
    current_user: User = Depends(require_auth)
):
    query = {"user_id": current_user.user_id}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get total count for pagination
    total = await db.notifications.count_documents(query)
    
    return {
        "notifications": notifications,
        "total": total,
        "has_more": skip + len(notifications) < total
    }

@api_router.post("/notifications/mark-read")
async def mark_notifications_read(current_user: User = Depends(require_auth)):
    await db.notifications.update_many(
        {"user_id": current_user.user_id},
        {"$set": {"read": True}}
    )
    return {"message": "Notifications marked as read"}

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(require_auth)):
    """Mark a single notification as read"""
    validate_id(notification_id, "notification_id")
    
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": current_user.user_id},
        {"$set": {"read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

# ============ COLLECTIONS ENDPOINTS ============

@api_router.post("/collections")
async def create_collection(
    name: str,
    description: Optional[str] = None,
    is_public: bool = False,
    current_user: User = Depends(require_auth)
):
    """Create a new collection/bookmark folder"""
    collection_id = f"collection_{uuid.uuid4().hex[:12]}"
    
    collection_data = {
        "collection_id": collection_id,
        "user_id": current_user.user_id,
        "name": name,
        "description": description,
        "is_public": is_public,
        "post_count": 0,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.collections.insert_one(collection_data)
    return {"collection_id": collection_id, "message": "Collection created"}

@api_router.get("/collections")
async def get_my_collections(current_user: User = Depends(require_auth)):
    """Get user's collections"""
    collections = await db.collections.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add post count for each collection
    for collection in collections:
        post_count = await db.collection_posts.count_documents({
            "collection_id": collection["collection_id"]
        })
        collection["post_count"] = post_count
    
    return collections

@api_router.get("/collections/public")
async def get_public_collections(current_user: User = Depends(require_auth)):
    """Get public collections from all users"""
    collections = await db.collections.find(
        {"is_public": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add user data and post count
    for collection in collections:
        user = await db.users.find_one({"user_id": collection["user_id"]}, {"_id": 0})
        collection["user"] = user
        
        post_count = await db.collection_posts.count_documents({
            "collection_id": collection["collection_id"]
        })
        collection["post_count"] = post_count
    
    return collections

@api_router.get("/collections/following")
async def get_followed_collections(current_user: User = Depends(require_auth)):
    """Get collections the user is following"""
    follows = await db.collection_follows.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(100)
    
    collection_ids = [f["collection_id"] for f in follows]
    collections = await db.collections.find(
        {"collection_id": {"$in": collection_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Add user data and post count
    for collection in collections:
        user = await db.users.find_one({"user_id": collection["user_id"]}, {"_id": 0})
        collection["user"] = user
        
        post_count = await db.collection_posts.count_documents({
            "collection_id": collection["collection_id"]
        })
        collection["post_count"] = post_count
    
    return collections

@api_router.get("/collections/{collection_id}")
async def get_collection(collection_id: str, current_user: User = Depends(require_auth)):
    """Get collection details and posts"""
    collection = await db.collections.find_one({"collection_id": collection_id}, {"_id": 0})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Check if user can access this collection
    if collection["user_id"] != current_user.user_id and not collection.get("is_public", False):
        raise HTTPException(status_code=403, detail="Collection is private")
    
    # Get posts in collection
    collection_posts = await db.collection_posts.find(
        {"collection_id": collection_id},
        {"_id": 0}
    ).sort("added_at", -1).to_list(100)
    
    post_ids = [cp["post_id"] for cp in collection_posts]
    posts = await db.posts.find(
        {"post_id": {"$in": post_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Add user data and reaction status
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
        
        # Check if current user reacted
        user_reaction = await db.reactions.find_one({
            "user_id": current_user.user_id,
            "post_id": post["post_id"]
        })
        post["user_reaction"] = user_reaction["reaction_type"] if user_reaction else None
        post["liked"] = user_reaction and user_reaction["reaction_type"] == "like"
        
        # Check saved status
        post["saved"] = True  # All posts in collection are saved
    
    collection["posts"] = posts
    return collection

@api_router.post("/collections/{collection_id}/posts/{post_id}")
async def add_post_to_collection(
    collection_id: str,
    post_id: str,
    current_user: User = Depends(require_auth)
):
    """Add a post to a collection"""
    # Check if collection exists and user owns it
    collection = await db.collections.find_one({"collection_id": collection_id})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if collection["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if post exists
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already in collection
    existing = await db.collection_posts.find_one({
        "collection_id": collection_id,
        "post_id": post_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Post already in collection")
    
    # Add to collection
    await db.collection_posts.insert_one({
        "collection_id": collection_id,
        "post_id": post_id,
        "user_id": current_user.user_id,
        "added_at": datetime.now(timezone.utc)
    })
    
    # Update collection post count
    await db.collections.update_one(
        {"collection_id": collection_id},
        {"$inc": {"post_count": 1}}
    )
    
    return {"message": "Post added to collection"}

@api_router.delete("/collections/{collection_id}/posts/{post_id}")
async def remove_post_from_collection(
    collection_id: str,
    post_id: str,
    current_user: User = Depends(require_auth)
):
    """Remove a post from a collection"""
    # Check if collection exists and user owns it
    collection = await db.collections.find_one({"collection_id": collection_id})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if collection["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Remove from collection
    result = await db.collection_posts.delete_one({
        "collection_id": collection_id,
        "post_id": post_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not in collection")
    
    # Update collection post count
    await db.collections.update_one(
        {"collection_id": collection_id},
        {"$inc": {"post_count": -1}}
    )
    
    return {"message": "Post removed from collection"}

@api_router.put("/collections/{collection_id}")
async def update_collection(
    collection_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    is_public: Optional[bool] = None,
    current_user: User = Depends(require_auth)
):
    """Update collection details"""
    collection = await db.collections.find_one({"collection_id": collection_id})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if collection["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description
    if is_public is not None:
        update_data["is_public"] = is_public
    
    if update_data:
        await db.collections.update_one(
            {"collection_id": collection_id},
            {"$set": update_data}
        )
    
    return {"message": "Collection updated"}

@api_router.delete("/collections/{collection_id}")
async def delete_collection(collection_id: str, current_user: User = Depends(require_auth)):
    """Delete a collection"""
    collection = await db.collections.find_one({"collection_id": collection_id})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if collection["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete collection and all its posts
    await db.collections.delete_one({"collection_id": collection_id})
    await db.collection_posts.delete_many({"collection_id": collection_id})
    
    return {"message": "Collection deleted"}

@api_router.get("/users/{user_id}/collections")
async def get_user_public_collections(user_id: str, current_user: User = Depends(require_auth)):
    """Get a user's public collections"""
    collections = await db.collections.find(
        {"user_id": user_id, "is_public": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add post count
    for collection in collections:
        post_count = await db.collection_posts.count_documents({
            "collection_id": collection["collection_id"]
        })
        collection["post_count"] = post_count
    
    return collections

@api_router.post("/collections/{collection_id}/follow")
async def follow_collection(collection_id: str, current_user: User = Depends(require_auth)):
    """Follow/unfollow a public collection"""
    collection = await db.collections.find_one({"collection_id": collection_id})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    if not collection.get("is_public", False):
        raise HTTPException(status_code=403, detail="Collection is private")
    
    if collection["user_id"] == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot follow your own collection")
    
    # Check if already following
    existing = await db.collection_follows.find_one({
        "collection_id": collection_id,
        "user_id": current_user.user_id
    })
    
    if existing:
        # Unfollow
        await db.collection_follows.delete_one({
            "collection_id": collection_id,
            "user_id": current_user.user_id
        })
        return {"message": "Collection unfollowed", "following": False}
    else:
        # Follow
        await db.collection_follows.insert_one({
            "collection_id": collection_id,
            "user_id": current_user.user_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Notify collection owner
        await create_notification(
            collection["user_id"],
            "follow",
            f"{current_user.name} started following your collection '{collection['name']}'",
            collection_id
        )
        
        return {"message": "Collection followed", "following": True}

# ============ PREMIUM ENDPOINTS ============

@api_router.post("/premium/subscribe")
async def subscribe_premium(current_user: User = Depends(require_auth)):
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"is_premium": True}}
    )
    return {"message": "Premium subscription activated"}

@api_router.post("/premium/cancel")
async def cancel_premium(current_user: User = Depends(require_auth)):
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"is_premium": False}}
    )
    return {"message": "Premium subscription cancelled"}

# ============ SCHEDULED POSTS ENDPOINTS ============

@api_router.post("/posts/schedule")
async def schedule_post(
    content: str = Form(...),
    scheduled_time: str = Form(...),  # ISO format datetime
    media: Optional[UploadFile] = File(None),
    tagged_users: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    poll_question: Optional[str] = Form(None),
    poll_options: Optional[str] = Form(None),
    current_user: User = Depends(require_auth)
):
    """Schedule a post for future publishing"""
    scheduled_dt = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
    
    if scheduled_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
    
    # Process media if present
    media_url = None
    media_type = None
    if media:
        media_content = await media.read()
        media_url = base64.b64encode(media_content).decode('utf-8')
        media_type = 'video' if media.content_type.startswith('video') else 'audio' if media.content_type.startswith('audio') else 'image'
    
    # Parse poll data
    has_poll = False
    poll_options_list = None
    if poll_question and poll_options:
        has_poll = True
        import json
        poll_options_list = json.loads(poll_options) if isinstance(poll_options, str) else poll_options
    
    scheduled_post_id = f"scheduled_{uuid.uuid4().hex[:12]}"
    
    await db.scheduled_posts.insert_one({
        "scheduled_post_id": scheduled_post_id,
        "user_id": current_user.user_id,
        "content": content,
        "media_url": media_url,
        "media_type": media_type,
        "tagged_users": tagged_users.split(',') if tagged_users else [],
        "location": location,
        "has_poll": has_poll,
        "poll_question": poll_question,
        "poll_options": poll_options_list,
        "scheduled_time": scheduled_dt,
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"scheduled_post_id": scheduled_post_id, "scheduled_time": scheduled_dt, "message": "Post scheduled"}

@api_router.get("/posts/scheduled")
async def get_scheduled_posts(current_user: User = Depends(require_auth)):
    """Get all scheduled posts for current user"""
    posts = await db.scheduled_posts.find(
        {"user_id": current_user.user_id, "status": "scheduled"},
        {"_id": 0}
    ).sort("scheduled_time", 1).to_list(100)
    
    return posts

@api_router.delete("/posts/scheduled/{scheduled_post_id}")
async def delete_scheduled_post(scheduled_post_id: str, current_user: User = Depends(require_auth)):
    """Cancel a scheduled post"""
    post = await db.scheduled_posts.find_one({"scheduled_post_id": scheduled_post_id})
    if not post or post["user_id"] != current_user.user_id:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    
    await db.scheduled_posts.delete_one({"scheduled_post_id": scheduled_post_id})
    return {"message": "Scheduled post cancelled"}

# ============ TIPS/DONATIONS ENDPOINTS ============

@api_router.post("/users/{user_id}/tip")
async def send_tip(
    user_id: str,
    amount: float,
    message: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """Send a tip/donation to a creator"""
    if amount < 1:
        raise HTTPException(status_code=400, detail="Minimum tip is $1")
    
    recipient = await db.users.find_one({"user_id": user_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    
    # In production, process PayPal payment here
    tip_id = f"tip_{uuid.uuid4().hex[:12]}"
    
    await db.tips.insert_one({
        "tip_id": tip_id,
        "from_user_id": current_user.user_id,
        "to_user_id": user_id,
        "amount": amount,
        "message": message,
        "status": "completed",
        "created_at": datetime.now(timezone.utc)
    })
    
    # Notify recipient
    await create_notification(
        user_id,
        "tip",
        f"{current_user.name} sent you ${amount}!" + (f" '{message}'" if message else ""),
        tip_id
    )
    
    return {"tip_id": tip_id, "message": "Tip sent successfully"}

@api_router.get("/users/{user_id}/tips/leaderboard")
async def get_top_supporters(user_id: str, current_user: User = Depends(require_auth)):
    """Get top supporters (tip leaderboard) for a user"""
    # Aggregate tips by sender
    pipeline = [
        {"$match": {"to_user_id": user_id, "status": "completed"}},
        {"$group": {
            "_id": "$from_user_id",
            "total_amount": {"$sum": "$amount"},
            "tip_count": {"$sum": 1}
        }},
        {"$sort": {"total_amount": -1}},
        {"$limit": 10}
    ]
    
    results = await db.tips.aggregate(pipeline).to_list(10)
    
    # Add user data
    leaderboard = []
    for result in results:
        user = await db.users.find_one({"user_id": result["_id"]}, {"_id": 0, "name": 1, "picture": 1})
        leaderboard.append({
            "user": user,
            "total_amount": result["total_amount"],
            "tip_count": result["tip_count"]
        })
    
    return leaderboard

# ============ ANALYTICS ENDPOINTS ============

@api_router.get("/analytics/overview")
async def get_analytics_overview(current_user: User = Depends(require_auth)):
    """Get analytics overview for creator"""
    # Get date range (last 30 days)
    end_date = datetime.now(timezone.utc)
    # start_date = end_date - timedelta(days=30)  # Reserved for future date filtering
    
    # Total posts
    total_posts = await db.posts.count_documents({"user_id": current_user.user_id})
    
    # Total reactions
    total_reactions = await db.reactions.count_documents({"post_id": {"$regex": "^post_"}})
    user_posts = await db.posts.find({"user_id": current_user.user_id}, {"post_id": 1}).to_list(1000)
    post_ids = [p["post_id"] for p in user_posts]
    total_reactions = await db.reactions.count_documents({"post_id": {"$in": post_ids}})
    
    # Total followers
    total_followers = await db.follows.count_documents({"following_id": current_user.user_id})
    
    # Total revenue (tips + sales)
    tips_pipeline = [
        {"$match": {"to_user_id": current_user.user_id, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    tips_result = await db.tips.aggregate(tips_pipeline).to_list(1)
    total_tips = tips_result[0]["total"] if tips_result else 0
    
    # Get follower growth (last 7 days)
    follower_growth = []
    for i in range(7):
        day = end_date - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        count = await db.follows.count_documents({
            "following_id": current_user.user_id,
            "created_at": {"$gte": day_start, "$lt": day_end}
        })
        
        follower_growth.append({
            "date": day_start.isoformat(),
            "new_followers": count
        })
    
    return {
        "total_posts": total_posts,
        "total_reactions": total_reactions,
        "total_followers": total_followers,
        "total_revenue": total_tips,
        "follower_growth": follower_growth[::-1]
    }

@api_router.get("/analytics/content-performance")
async def get_content_performance(current_user: User = Depends(require_auth)):
    """Get top performing posts"""
    posts = await db.posts.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("likes_count", -1).limit(10).to_list(10)
    
    for post in posts:
        # Calculate engagement rate
        reaction_counts = post.get("reaction_counts", {})
        total_reactions = sum(reaction_counts.values())
        post["total_reactions"] = total_reactions
        post["engagement_score"] = total_reactions + post.get("comments_count", 0) + post.get("shares_count", 0)
    
    return posts

# ============ CATEGORIES ENDPOINTS ============

@api_router.get("/categories")
async def get_categories(current_user: User = Depends(require_auth)):
    """Get all content categories"""
    categories = [
        {"id": "music", "name": "Music", "icon": "musical-notes", "color": "#E91E63"},
        {"id": "art", "name": "Art & Design", "icon": "color-palette", "color": "#9C27B0"},
        {"id": "tech", "name": "Technology", "icon": "hardware-chip", "color": "#2196F3"},
        {"id": "fashion", "name": "Fashion", "icon": "shirt", "color": "#FF9800"},
        {"id": "food", "name": "Food & Cooking", "icon": "restaurant", "color": "#4CAF50"},
        {"id": "fitness", "name": "Fitness", "icon": "fitness", "color": "#F44336"},
        {"id": "gaming", "name": "Gaming", "icon": "game-controller", "color": "#673AB7"},
        {"id": "education", "name": "Education", "icon": "school", "color": "#009688"},
        {"id": "business", "name": "Business", "icon": "briefcase", "color": "#607D8B"},
        {"id": "entertainment", "name": "Entertainment", "icon": "film", "color": "#FF5722"}
    ]
    
    return categories

@api_router.get("/categories/{category_id}/posts")
async def get_category_posts(category_id: str, current_user: User = Depends(require_auth)):
    """Get posts in a category"""
    # In a real implementation, posts would have category tags
    # For now, return trending posts
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
    
    return posts

# ============ DISCOVERY & TRENDING ENDPOINTS ============

@api_router.get("/discover/for-you")
async def get_for_you_feed(current_user: User = Depends(require_auth)):
    """Get personalized 'For You' feed"""
    # Simple algorithm: Mix of followed users + popular posts + random discovery
    
    # Get posts from followed users
    follows = await db.follows.find({"follower_id": current_user.user_id}, {"_id": 0}).to_list(1000)
    followed_ids = [f["following_id"] for f in follows]
    
    followed_posts = await db.posts.find(
        {"user_id": {"$in": followed_ids}},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get trending posts (high engagement)
    trending_posts = await db.posts.find({}, {"_id": 0}).sort("likes_count", -1).limit(10).to_list(10)
    
    # Get random discovery posts
    random_posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).skip(10).limit(10).to_list(10)
    
    # Mix them
    all_posts = followed_posts + trending_posts + random_posts
    
    # Remove duplicates and add user data
    seen = set()
    unique_posts = []
    for post in all_posts:
        if post["post_id"] not in seen:
            seen.add(post["post_id"])
            user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
            post["user"] = user
            
            # Check reactions
            user_reaction = await db.reactions.find_one({
                "user_id": current_user.user_id,
                "post_id": post["post_id"]
            })
            post["user_reaction"] = user_reaction["reaction_type"] if user_reaction else None
            post["liked"] = user_reaction and user_reaction["reaction_type"] == "like"
            
            unique_posts.append(post)
    
    return unique_posts[:30]

@api_router.get("/discover/trending")
async def get_trending(current_user: User = Depends(require_auth)):
    """Get trending posts, creators, and topics"""
    # Trending posts (last 24 hours with high engagement)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    
    trending_posts = await db.posts.find(
        {"created_at": {"$gte": yesterday}},
        {"_id": 0}
    ).sort("likes_count", -1).limit(10).to_list(10)
    
    for post in trending_posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = user
    
    # Rising creators (new users with growing followers)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_users = await db.users.find(
        {"created_at": {"$gte": week_ago}},
        {"_id": 0}
    ).limit(10).to_list(10)
    
    rising_creators = []
    for user in new_users:
        follower_count = await db.follows.count_documents({"following_id": user["user_id"]})
        if follower_count > 0:
            user["follower_count"] = follower_count
            rising_creators.append(user)
    
    rising_creators.sort(key=lambda x: x["follower_count"], reverse=True)
    
    return {
        "trending_posts": trending_posts,
        "rising_creators": rising_creators[:5]
    }

@api_router.get("/discover/suggested-users")
async def get_suggested_users(current_user: User = Depends(require_auth)):
    """Get suggested users to follow"""
    # Get users followed by people you follow (2nd degree connections)
    follows = await db.follows.find({"follower_id": current_user.user_id}, {"_id": 0}).to_list(1000)
    followed_ids = [f["following_id"] for f in follows]
    followed_ids.append(current_user.user_id)  # Exclude self
    
    # Get who they follow
    second_degree = await db.follows.find(
        {"follower_id": {"$in": followed_ids}},
        {"_id": 0}
    ).to_list(1000)
    
    # Count occurrences
    suggestions = {}
    for follow in second_degree:
        user_id = follow["following_id"]
        if user_id not in followed_ids:  # Not already following
            suggestions[user_id] = suggestions.get(user_id, 0) + 1
    
    # Get top suggestions
    sorted_suggestions = sorted(suggestions.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Add user data
    suggested_users = []
    for user_id, mutual_count in sorted_suggestions:
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if user:
            user["mutual_followers"] = mutual_count
            follower_count = await db.follows.count_documents({"following_id": user_id})
            user["follower_count"] = follower_count
            suggested_users.append(user)
    
    return suggested_users

# ============ SEARCH ENDPOINT ============

@api_router.get("/search")
async def search(q: str, current_user: User = Depends(require_auth)):
    users = await db.users.find(
        {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0}
    ).to_list(50)
    
    posts = await db.posts.find(
        {"content": {"$regex": q, "$options": "i"}},
        {"_id": 0}
    ).to_list(50)
    
    return {"users": users, "posts": posts}

# ============ STORIES ENDPOINTS ============

@api_router.post("/stories")
async def create_story(
    media: UploadFile,
    caption: Optional[str] = Form(None),
    current_user: User = Depends(require_auth)
):
    """Create a 24-hour disappearing story"""
    story_id = f"story_{uuid.uuid4().hex[:12]}"
    
    # Read and validate media
    media_content = await media.read()
    
    # Determine media type
    media_type = 'video' if media.content_type and media.content_type.startswith('video') else 'image'
    
    # Upload to Cloudinary (or base64 fallback)
    upload_result = await upload_media(
        file_data=media_content,
        filename=media.filename or f"story_{story_id}",
        content_type=media.content_type or "image/jpeg",
        folder="grover/stories",
        generate_thumbnail=media_type == "image"
    )
    
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    
    story_data = {
        "story_id": story_id,
        "user_id": current_user.user_id,
        "media_url": upload_result["url"],
        "media_type": upload_result["media_type"],
        "media_public_id": upload_result.get("public_id"),
        "thumbnail_url": upload_result.get("thumbnail"),
        "caption": caption,
        "views_count": 0,
        "reactions_count": 0,
        "replies_count": 0,
        "is_highlighted": False,
        "highlight_title": None,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.stories.insert_one(story_data)
    return {"story_id": story_id, "message": "Story created", "expires_at": expires_at}

@api_router.get("/stories")
async def get_active_stories(current_user: User = Depends(require_auth)):
    """Get all active stories (not expired) from followed users"""
    # Get followed users
    follows = await db.follows.find(
        {"follower_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    followed_ids = [f["following_id"] for f in follows]
    followed_ids.append(current_user.user_id)  # Include own stories
    
    # Get non-expired stories
    stories = await db.stories.find(
        {
            "user_id": {"$in": followed_ids},
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Group by user and add user data
    stories_by_user = {}
    for story in stories:
        user_id = story["user_id"]
        if user_id not in stories_by_user:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            stories_by_user[user_id] = {
                "user": user,
                "stories": []
            }
        
        # Check if current user viewed this story
        viewed = await db.story_views.find_one({
            "story_id": story["story_id"],
            "user_id": current_user.user_id
        })
        story["viewed"] = viewed is not None
        stories_by_user[user_id]["stories"].append(story)
    
    return list(stories_by_user.values())

@api_router.post("/stories/{story_id}/view")
async def view_story(story_id: str, current_user: User = Depends(require_auth)):
    """Record a story view"""
    story = await db.stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Check if already viewed
    existing = await db.story_views.find_one({
        "story_id": story_id,
        "user_id": current_user.user_id
    })
    
    if not existing:
        await db.story_views.insert_one({
            "story_id": story_id,
            "user_id": current_user.user_id,
            "viewed_at": datetime.now(timezone.utc)
        })
        await db.stories.update_one(
            {"story_id": story_id},
            {"$inc": {"views_count": 1}}
        )
    
    return {"message": "View recorded", "views_count": story.get("views_count", 0) + 1}

@api_router.get("/stories/{story_id}/viewers")
async def get_story_viewers(
    story_id: str,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get list of users who viewed a story (only visible to story owner)"""
    validate_id(story_id, "story_id")
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    story = await db.stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Only the story owner can see viewers
    if story["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the story owner can view this")
    
    # Get viewers
    views = await db.story_views.find(
        {"story_id": story_id},
        {"_id": 0}
    ).sort("viewed_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user data
    viewers = []
    for view in views:
        user = await db.users.find_one(
            {"user_id": view["user_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
        )
        if user:
            viewers.append({
                "user": user,
                "viewed_at": view["viewed_at"]
            })
    
    return {
        "viewers": viewers,
        "total_count": story.get("views_count", 0)
    }

@api_router.post("/stories/{story_id}/react")
async def react_to_story(
    story_id: str,
    reaction: str,
    current_user: User = Depends(require_auth)
):
    """React to a story (emoji)"""
    story = await db.stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Check if already reacted
    existing = await db.story_reactions.find_one({
        "story_id": story_id,
        "user_id": current_user.user_id
    })
    
    if existing:
        # Update reaction
        await db.story_reactions.update_one(
            {"story_id": story_id, "user_id": current_user.user_id},
            {"$set": {"reaction": reaction}}
        )
    else:
        await db.story_reactions.insert_one({
            "story_id": story_id,
            "user_id": current_user.user_id,
            "reaction": reaction,
            "created_at": datetime.now(timezone.utc)
        })
        await db.stories.update_one(
            {"story_id": story_id},
            {"$inc": {"reactions_count": 1}}
        )
        
        # Notify story owner
        if story["user_id"] != current_user.user_id:
            await create_notification(
                story["user_id"],
                "reaction",
                f"{current_user.name} reacted {reaction} to your story",
                story_id
            )
    
    return {"message": "Reaction added"}

@api_router.post("/stories/{story_id}/reply")
async def reply_to_story(
    story_id: str,
    message: str,
    current_user: User = Depends(require_auth)
):
    """Reply to a story (sends as DM to story owner)"""
    story = await db.stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Create message to story owner
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    await db.messages.insert_one({
        "message_id": message_id,
        "sender_id": current_user.user_id,
        "receiver_id": story["user_id"],
        "content": f"Replied to your story: {message}",
        "story_reply": True,
        "story_id": story_id,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    await db.stories.update_one(
        {"story_id": story_id},
        {"$inc": {"replies_count": 1}}
    )
    
    # Notify story owner
    if story["user_id"] != current_user.user_id:
        await create_notification(
            story["user_id"],
            "message",
            f"{current_user.name} replied to your story",
            message_id
        )
    
    return {"message": "Reply sent"}

@api_router.post("/stories/{story_id}/highlight")
async def highlight_story(
    story_id: str,
    title: str,
    current_user: User = Depends(require_auth)
):
    """Add story to highlights (permanent)"""
    story = await db.stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.stories.update_one(
        {"story_id": story_id},
        {"$set": {"is_highlighted": True, "highlight_title": title}}
    )
    
    return {"message": "Story added to highlights"}

@api_router.delete("/stories/{story_id}")
async def delete_story(story_id: str, current_user: User = Depends(require_auth)):
    """Delete a story"""
    story = await db.stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.stories.delete_one({"story_id": story_id})
    return {"message": "Story deleted"}

@api_router.get("/users/{user_id}/highlights")
async def get_user_highlights(user_id: str, current_user: User = Depends(require_auth)):
    """Get user's highlighted stories"""
    highlights = await db.stories.find(
        {"user_id": user_id, "is_highlighted": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Group by highlight title
    grouped = {}
    for story in highlights:
        title = story.get("highlight_title", "Untitled")
        if title not in grouped:
            grouped[title] = []
        grouped[title].append(story)
    
    return grouped

# ============ LIVE STREAMING ENDPOINTS ============

# Agora configuration
AGORA_APP_ID = os.environ.get('AGORA_APP_ID', '')
AGORA_APP_CERTIFICATE = os.environ.get('AGORA_APP_CERTIFICATE', '')

def generate_agora_token(channel_name: str, uid: int, role: str = 'publisher', expire_seconds: int = 3600):
    """Generate Agora RTC token"""
    if not AGORA_AVAILABLE or not AGORA_APP_ID or not AGORA_APP_CERTIFICATE:
        return None
    
    try:
        privilege_expire_ts = int(time.time()) + expire_seconds
        
        if role == 'publisher':
            agora_role = Role_Publisher
        else:
            agora_role = Role_Subscriber
        
        token = RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERTIFICATE,
            channel_name,
            uid,
            agora_role,
            privilege_expire_ts
        )
        return token
    except Exception as e:
        print(f"Agora token generation error: {e}")
        return None

@api_router.get("/streams/agora-config")
async def get_agora_config(current_user: User = Depends(require_auth)):
    """Get Agora configuration for client"""
    return {
        "app_id": AGORA_APP_ID if AGORA_APP_ID else None,
        "available": bool(AGORA_APP_ID and AGORA_AVAILABLE)
    }

@api_router.post("/streams/token")
async def get_stream_token(
    channel_name: str = Form(...),
    role: str = Form("subscriber"),
    current_user: User = Depends(require_auth)
):
    """Get Agora token for joining a stream"""
    validate_id(channel_name, "channel_name")
    
    # Generate a unique UID based on user_id
    uid = abs(hash(current_user.user_id)) % (2**31)
    
    token = generate_agora_token(channel_name, uid, role)
    
    if not token:
        # Return placeholder if Agora not configured
        return {
            "token": None,
            "uid": uid,
            "channel_name": channel_name,
            "app_id": AGORA_APP_ID or None,
            "message": "Agora not configured - using mock mode"
        }
    
    return {
        "token": token,
        "uid": uid,
        "channel_name": channel_name,
        "app_id": AGORA_APP_ID
    }

@api_router.post("/streams/start")
async def start_stream(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    enable_super_chat: bool = Form(False),
    enable_shopping: bool = Form(False),
    camera_facing: Optional[str] = Form("front"),
    current_user: User = Depends(require_auth)
):
    """Start a live stream"""
    stream_id = f"stream_{uuid.uuid4().hex[:12]}"
    channel_name = stream_id
    
    # Generate UID for the host
    host_uid = abs(hash(current_user.user_id)) % (2**31)
    
    # Generate Agora token for host (publisher role)
    agora_token = generate_agora_token(channel_name, host_uid, 'publisher', 7200)  # 2 hour expiry
    
    stream_data = {
        "stream_id": stream_id,
        "user_id": current_user.user_id,
        "title": sanitize_string(title, 200, "title"),
        "description": sanitize_string(description, 1000, "description") if description else None,
        "enable_super_chat": enable_super_chat,
        "enable_shopping": enable_shopping,
        "status": "live",
        "viewers_count": 0,
        "started_at": datetime.utcnow().isoformat(),
        "channel_name": channel_name,
        "host_uid": host_uid,
        "camera_facing": camera_facing,
    }
    
    await db.streams.insert_one(stream_data)
    
    # Notify followers
    followers = await db.follows.find(
        {"following_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    for follower in followers:
        await create_notification(
            follower["follower_id"],
            "live",
            f"{current_user.name} just went live: {title}",
            stream_id
        )
    
    return {
        "stream_id": stream_id,
        "channel_name": channel_name,
        "token": agora_token,
        "uid": host_uid,
        "app_id": AGORA_APP_ID or None,
        "message": "Stream started successfully"
    }

@api_router.post("/streams/{stream_id}/end")
async def end_stream(stream_id: str, current_user: User = Depends(require_auth)):
    """End a live stream"""
    stream = await db.streams.find_one({"stream_id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    if stream["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.streams.update_one(
        {"stream_id": stream_id},
        {
            "$set": {
                "status": "ended",
                "ended_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Stream ended"}

@api_router.get("/streams/live")
async def get_live_streams(current_user: User = Depends(require_auth)):
    """Get all currently live streams"""
    streams = await db.streams.find(
        {"status": "live"},
        {"_id": 0}
    ).sort("started_at", -1).to_list(100)
    
    # Add user data
    for stream in streams:
        user = await db.users.find_one({"user_id": stream["user_id"]}, {"_id": 0})
        stream["user"] = user
    
    return streams

@api_router.get("/streams/{stream_id}")
async def get_stream(stream_id: str, current_user: User = Depends(require_auth)):
    """Get stream details and join token"""
    stream = await db.streams.find_one({"stream_id": stream_id}, {"_id": 0})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    # Add user data
    user = await db.users.find_one({"user_id": stream["user_id"]}, {"_id": 0})
    stream["user"] = user
    
    # Increment viewers count
    await db.streams.update_one(
        {"stream_id": stream_id},
        {"$inc": {"viewers_count": 1}}
    )
    
    # Generate viewer token (would be real Agora token in production)
    return {
        **stream,
        "viewer_token": "temp_viewer_token",
        "channel_name": stream["channel_name"]
    }

@api_router.post("/streams/{stream_id}/super-chat")
async def send_super_chat(
    stream_id: str,
    amount: float,
    message: str,
    current_user: User = Depends(require_auth)
):
    """Send a paid super chat message"""
    stream = await db.streams.find_one({"stream_id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    if not stream.get("enable_super_chat"):
        raise HTTPException(status_code=400, detail="Super chat not enabled")
    
    # In production, process PayPal payment here
    super_chat_id = f"superchat_{uuid.uuid4().hex[:12]}"
    
    await db.super_chats.insert_one({
        "super_chat_id": super_chat_id,
        "stream_id": stream_id,
        "user_id": current_user.user_id,
        "amount": amount,
        "message": message,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Notify streamer
    await create_notification(
        stream["user_id"],
        "super_chat",
        f"{current_user.name} sent ${amount}: {message}",
        super_chat_id
    )
    
    return {"message": "Super chat sent", "super_chat_id": super_chat_id}

@api_router.get("/streams/{stream_id}/join-info")
async def get_stream_join_info(stream_id: str, current_user: User = Depends(require_auth)):
    """Get stream join information with Agora token for audience"""
    stream = await db.streams.find_one({"stream_id": stream_id}, {"_id": 0})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    if stream.get("status") != "live":
        raise HTTPException(status_code=400, detail="Stream is not live")
    
    # Generate viewer UID and token
    viewer_uid = abs(hash(current_user.user_id)) % (2**31)
    agora_token = generate_agora_token(stream["channel_name"], viewer_uid, 'subscriber', 3600)
    
    # Get host user data
    user = await db.users.find_one({"user_id": stream["user_id"]}, {"_id": 0})
    
    return {
        "stream_id": stream_id,
        "channel_name": stream["channel_name"],
        "token": agora_token,
        "uid": viewer_uid,
        "app_id": AGORA_APP_ID or None,
        "host": user,
        "title": stream.get("title"),
        "viewers_count": stream.get("viewers_count", 0),
        "enable_super_chat": stream.get("enable_super_chat", False),
        "enable_shopping": stream.get("enable_shopping", False)
    }

@api_router.post("/streams/schedule")
async def schedule_stream(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    scheduled_time: str = Form(...),
    enable_super_chat: bool = Form(False),
    enable_shopping: bool = Form(False),
    current_user: User = Depends(require_auth)
):
    """Schedule a future live stream"""
    # Parse scheduled time
    try:
        scheduled_dt = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid datetime format")
    
    if scheduled_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
    
    stream_id = f"stream_{uuid.uuid4().hex[:12]}"
    channel_name = stream_id
    
    scheduled_stream = {
        "stream_id": stream_id,
        "user_id": current_user.user_id,
        "title": sanitize_string(title, 200, "title"),
        "description": sanitize_string(description, 1000, "description") if description else None,
        "enable_super_chat": enable_super_chat,
        "enable_shopping": enable_shopping,
        "status": "scheduled",
        "scheduled_time": scheduled_dt,
        "channel_name": channel_name,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.scheduled_streams.insert_one(scheduled_stream)
    
    # Notify followers
    followers = await db.follows.find(
        {"following_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    for follower in followers:
        await create_notification(
            follower["follower_id"],
            "scheduled_stream",
            f"{current_user.name} scheduled a live stream: {title}",
            stream_id
        )
    
    return {
        "stream_id": stream_id,
        "scheduled_time": scheduled_dt.isoformat(),
        "message": "Stream scheduled successfully"
    }

@api_router.post("/streams/{stream_id}/join")
async def join_stream(stream_id: str, current_user: User = Depends(require_auth)):
    """Join a live stream as a viewer"""
    stream = await db.streams.find_one({"stream_id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    if stream.get("status") != "live":
        raise HTTPException(status_code=400, detail="Stream is not live")
    
    # Add viewer to stream room (tracked separately)
    await db.stream_viewers.update_one(
        {"stream_id": stream_id, "user_id": current_user.user_id},
        {
            "$set": {
                "stream_id": stream_id,
                "user_id": current_user.user_id,
                "joined_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    # Update viewer count
    viewer_count = await db.stream_viewers.count_documents({"stream_id": stream_id})
    await db.streams.update_one(
        {"stream_id": stream_id},
        {"$set": {"viewers_count": viewer_count}}
    )
    
    # Emit viewer count update via socket
    await sio.emit('stream:viewers', {
        "stream_id": stream_id,
        "viewers_count": viewer_count
    }, room=f"stream_{stream_id}")
    
    return {
        "message": "Joined stream",
        "viewers_count": viewer_count
    }

@api_router.post("/streams/{stream_id}/leave")
async def leave_stream(stream_id: str, current_user: User = Depends(require_auth)):
    """Leave a live stream"""
    # Remove viewer from tracking
    await db.stream_viewers.delete_one({
        "stream_id": stream_id,
        "user_id": current_user.user_id
    })
    
    # Update viewer count
    viewer_count = await db.stream_viewers.count_documents({"stream_id": stream_id})
    await db.streams.update_one(
        {"stream_id": stream_id},
        {"$set": {"viewers_count": viewer_count}}
    )
    
    # Emit viewer count update via socket
    await sio.emit('stream:viewers', {
        "stream_id": stream_id,
        "viewers_count": viewer_count
    }, room=f"stream_{stream_id}")
    
    return {
        "message": "Left stream",
        "viewers_count": viewer_count
    }

@api_router.post("/streams/{stream_id}/chat")
async def send_stream_chat(
    stream_id: str,
    text: str = Form(...),
    current_user: User = Depends(require_auth)
):
    """Send a chat message in a stream"""
    stream = await db.streams.find_one({"stream_id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    if stream.get("status") != "live":
        raise HTTPException(status_code=400, detail="Stream is not live")
    
    message_id = f"chat_{uuid.uuid4().hex[:12]}"
    message_data = {
        "message_id": message_id,
        "stream_id": stream_id,
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "user_picture": current_user.picture,
        "text": sanitize_string(text, 500, "text"),
        "type": "chat",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.stream_chats.insert_one(message_data)
    
    # Emit to stream room
    await sio.emit('stream:chat', {
        "message_id": message_id,
        "user": {
            "user_id": current_user.user_id,
            "name": current_user.name,
            "picture": current_user.picture
        },
        "text": message_data["text"],
        "type": "chat",
        "created_at": message_data["created_at"].isoformat()
    }, room=f"stream_{stream_id}")
    
    return {"message": "Chat sent", "message_id": message_id}

@api_router.post("/streams/{stream_id}/like")
async def like_stream(stream_id: str, current_user: User = Depends(require_auth)):
    """Send a like/heart in a stream"""
    stream = await db.streams.find_one({"stream_id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    # Increment likes count
    await db.streams.update_one(
        {"stream_id": stream_id},
        {"$inc": {"likes_count": 1}}
    )
    
    updated_stream = await db.streams.find_one({"stream_id": stream_id})
    likes_count = updated_stream.get("likes_count", 0)
    
    # Emit to stream room
    await sio.emit('stream:likes', {
        "stream_id": stream_id,
        "likes_count": likes_count,
        "user_id": current_user.user_id
    }, room=f"stream_{stream_id}")
    
    return {"message": "Like sent", "likes_count": likes_count}

@api_router.post("/streams/{stream_id}/gift")
async def send_stream_gift(
    stream_id: str,
    gift_id: str = Form(...),
    current_user: User = Depends(require_auth)
):
    """Send a virtual gift in a stream"""
    stream = await db.streams.find_one({"stream_id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    # Gift definitions (can be moved to DB)
    gifts = {
        "heart": {"name": "Heart", "value": 1, "emoji": "❤️"},
        "star": {"name": "Star", "value": 5, "emoji": "⭐"},
        "fire": {"name": "Fire", "value": 10, "emoji": "🔥"},
        "diamond": {"name": "Diamond", "value": 50, "emoji": "💎"},
        "rocket": {"name": "Rocket", "value": 100, "emoji": "🚀"},
        "crown": {"name": "Crown", "value": 500, "emoji": "👑"}
    }
    
    gift = gifts.get(gift_id)
    if not gift:
        raise HTTPException(status_code=400, detail="Invalid gift")
    
    gift_record_id = f"gift_{uuid.uuid4().hex[:12]}"
    gift_record = {
        "gift_record_id": gift_record_id,
        "stream_id": stream_id,
        "user_id": current_user.user_id,
        "gift_id": gift_id,
        "gift_name": gift["name"],
        "gift_value": gift["value"],
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.stream_gifts.insert_one(gift_record)
    
    # Emit to stream room
    await sio.emit('stream:gift', {
        "stream_id": stream_id,
        "user": {
            "user_id": current_user.user_id,
            "name": current_user.name,
            "picture": current_user.picture
        },
        "gift": gift,
        "created_at": gift_record["created_at"].isoformat()
    }, room=f"stream_{stream_id}")
    
    # Notify streamer
    if stream["user_id"] != current_user.user_id:
        await create_notification(
            stream["user_id"],
            "gift",
            f"{current_user.name} sent you a {gift['emoji']} {gift['name']}!",
            gift_record_id
        )
    
    return {"message": "Gift sent", "gift": gift}

@api_router.post("/streams/{stream_id}/superchat")
async def send_stream_superchat(
    stream_id: str,
    amount: float = Form(...),
    message: str = Form(...),
    current_user: User = Depends(require_auth)
):
    """Send a super chat in a stream (alias for /super-chat)"""
    stream = await db.streams.find_one({"stream_id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    if not stream.get("enable_super_chat"):
        raise HTTPException(status_code=400, detail="Super chat not enabled for this stream")
    
    # Validate amount
    if amount <= 0 or amount > 500:
        raise HTTPException(status_code=400, detail="Invalid amount (must be between $0.01 and $500)")
    
    super_chat_id = f"superchat_{uuid.uuid4().hex[:12]}"
    
    superchat_record = {
        "super_chat_id": super_chat_id,
        "stream_id": stream_id,
        "user_id": current_user.user_id,
        "amount": amount,
        "message": sanitize_string(message, 200, "message"),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.super_chats.insert_one(superchat_record)
    
    # Emit to stream room
    await sio.emit('stream:superchat', {
        "stream_id": stream_id,
        "user": {
            "user_id": current_user.user_id,
            "name": current_user.name,
            "picture": current_user.picture
        },
        "amount": amount,
        "message": superchat_record["message"],
        "created_at": superchat_record["created_at"].isoformat()
    }, room=f"stream_{stream_id}")
    
    # Notify streamer
    await create_notification(
        stream["user_id"],
        "super_chat",
        f"{current_user.name} sent ${amount}: {message}",
        super_chat_id
    )
    
    return {"message": "Super chat sent", "super_chat_id": super_chat_id}

# ============ POLLS ENDPOINTS ============

@api_router.post("/posts/{post_id}/vote")
async def vote_on_poll(
    post_id: str,
    option_index: int,
    current_user: User = Depends(require_auth)
):
    """Vote on a poll in a post"""
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if not post.get("has_poll"):
        raise HTTPException(status_code=400, detail="Post does not have a poll")
    
    # Check if poll expired
    if post.get("poll_expires_at") and post["poll_expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Poll has expired")
    
    # Check if user already voted
    existing_vote = await db.poll_votes.find_one({
        "post_id": post_id,
        "user_id": current_user.user_id
    })
    
    if existing_vote:
        # Update vote
        old_option = existing_vote["option_index"]
        await db.poll_votes.update_one(
            {"post_id": post_id, "user_id": current_user.user_id},
            {"$set": {"option_index": option_index}}
        )
        
        # Update counts
        poll_votes = post.get("poll_votes", {})
        poll_votes[str(old_option)] = poll_votes.get(str(old_option), 0) - 1
        poll_votes[str(option_index)] = poll_votes.get(str(option_index), 0) + 1
        await db.posts.update_one(
            {"post_id": post_id},
            {"$set": {"poll_votes": poll_votes}}
        )
    else:
        # New vote
        await db.poll_votes.insert_one({
            "post_id": post_id,
            "user_id": current_user.user_id,
            "option_index": option_index,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Update count
        poll_votes = post.get("poll_votes", {})
        poll_votes[str(option_index)] = poll_votes.get(str(option_index), 0) + 1
        await db.posts.update_one(
            {"post_id": post_id},
            {"$set": {"poll_votes": poll_votes}}
        )
    
    return {"message": "Vote recorded", "poll_votes": poll_votes}

@api_router.get("/posts/{post_id}/poll-results")
async def get_poll_results(post_id: str, current_user: User = Depends(require_auth)):
    """Get poll results with percentages"""
    post = await db.posts.find_one({"post_id": post_id})
    if not post or not post.get("has_poll"):
        raise HTTPException(status_code=404, detail="Poll not found")
    
    poll_votes = post.get("poll_votes", {})
    total_votes = sum(poll_votes.values())
    
    results = []
    for idx, option in enumerate(post.get("poll_options", [])):
        votes = poll_votes.get(str(idx), 0)
        percentage = (votes / total_votes * 100) if total_votes > 0 else 0
        results.append({
            "option": option,
            "votes": votes,
            "percentage": round(percentage, 1)
        })
    
    # Check if current user voted
    user_vote = await db.poll_votes.find_one({
        "post_id": post_id,
        "user_id": current_user.user_id
    })
    
    return {
        "results": results,
        "total_votes": total_votes,
        "user_voted": user_vote is not None,
        "user_vote_index": user_vote["option_index"] if user_vote else None,
        "expires_at": post.get("poll_expires_at")
    }

# ============ SOCKET.IO HANDLERS ============

active_users = {}
stream_viewers = {}  # {stream_id: {user_id: sid}}

@sio.event
async def connect(sid, environ):
    logger.info(f"Client {sid} connected")

# ============ STREAMING SOCKET.IO EVENTS ============

@sio.on('stream:join')
async def handle_join_stream(sid, data):
    """Join a stream room for real-time updates"""
    stream_id = data.get("stream_id")
    user_id = data.get("user_id")
    
    if stream_id and user_id:
        sio.enter_room(sid, f"stream_{stream_id}")
        
        # Track viewer
        if stream_id not in stream_viewers:
            stream_viewers[stream_id] = {}
        stream_viewers[stream_id][user_id] = sid
        
        # Get updated viewer count
        viewer_count = len(stream_viewers.get(stream_id, {}))
        
        # Broadcast viewer count to stream room
        await sio.emit('stream:viewers', {
            "stream_id": stream_id,
            "viewers_count": viewer_count
        }, room=f"stream_{stream_id}")
        
        logger.info(f"User {user_id} joined stream {stream_id}, viewers: {viewer_count}")

@sio.on('stream:leave')
async def handle_leave_stream(sid, data):
    """Leave a stream room"""
    stream_id = data.get("stream_id")
    user_id = data.get("user_id")
    
    if stream_id and user_id:
        sio.leave_room(sid, f"stream_{stream_id}")
        
        # Remove from tracking
        if stream_id in stream_viewers and user_id in stream_viewers[stream_id]:
            del stream_viewers[stream_id][user_id]
        
        # Get updated viewer count
        viewer_count = len(stream_viewers.get(stream_id, {}))
        
        # Broadcast viewer count to stream room
        await sio.emit('stream:viewers', {
            "stream_id": stream_id,
            "viewers_count": viewer_count
        }, room=f"stream_{stream_id}")
        
        logger.info(f"User {user_id} left stream {stream_id}, viewers: {viewer_count}")

@sio.on('stream:chat')
async def handle_stream_chat(sid, data):
    """Handle real-time chat in a stream"""
    stream_id = data.get("stream_id")
    user_id = data.get("user_id")
    text = data.get("text")
    
    if not all([stream_id, user_id, text]):
        return
    
    # Get user info
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return
    
    message_id = f"chat_{uuid.uuid4().hex[:12]}"
    
    # Store chat message
    await db.stream_chats.insert_one({
        "message_id": message_id,
        "stream_id": stream_id,
        "user_id": user_id,
        "text": text[:500],  # Limit message length
        "type": "chat",
        "created_at": datetime.now(timezone.utc)
    })
    
    # Broadcast to stream room
    await sio.emit('stream:chat', {
        "message_id": message_id,
        "user": {
            "user_id": user_id,
            "name": user.get("name", "Anonymous"),
            "picture": user.get("picture")
        },
        "text": text[:500],
        "type": "chat",
        "created_at": datetime.now(timezone.utc).isoformat()
    }, room=f"stream_{stream_id}")

@sio.on('stream:like')
async def handle_stream_like(sid, data):
    """Handle likes in a stream"""
    stream_id = data.get("stream_id")
    user_id = data.get("user_id")
    
    if stream_id and user_id:
        # Increment likes in DB
        await db.streams.update_one(
            {"stream_id": stream_id},
            {"$inc": {"likes_count": 1}}
        )
        
        # Get updated count
        stream = await db.streams.find_one({"stream_id": stream_id})
        likes_count = stream.get("likes_count", 0) if stream else 0
        
        # Broadcast to stream room
        await sio.emit('stream:likes', {
            "stream_id": stream_id,
            "likes_count": likes_count,
            "user_id": user_id
        }, room=f"stream_{stream_id}")

@sio.on('stream:end')
async def handle_end_stream(sid, data):
    """Handle stream end event"""
    stream_id = data.get("stream_id")
    user_id = data.get("user_id")
    
    if stream_id:
        # Verify host
        stream = await db.streams.find_one({"stream_id": stream_id})
        if stream and stream.get("user_id") == user_id:
            # Update stream status
            await db.streams.update_one(
                {"stream_id": stream_id},
                {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc)}}
            )
            
            # Broadcast end to all viewers
            await sio.emit('stream:ended', {
                "stream_id": stream_id,
                "message": "Stream has ended"
            }, room=f"stream_{stream_id}")
            
            # Clean up viewers
            if stream_id in stream_viewers:
                del stream_viewers[stream_id]
            
            logger.info(f"Stream {stream_id} ended by host {user_id}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client {sid} disconnected")
    for user_id in list(active_users.keys()):
        if active_users[user_id] == sid:
            del active_users[user_id]
            break

@sio.event
async def join_conversation(sid, data):
    conversation_id = data.get("conversation_id")
    user_id = data.get("user_id")
    
    if conversation_id and user_id:
        sio.enter_room(sid, f"conversation_{conversation_id}")
        active_users[user_id] = sid
        logger.info(f"User {user_id} joined conversation {conversation_id}")

@sio.event
async def send_message(sid, data):
    conversation_id = data.get("conversation_id")
    sender_id = data.get("sender_id")
    content = data.get("content")
    
    if not all([conversation_id, sender_id, content]):
        return
    
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    await db.messages.insert_one({
        "message_id": message_id,
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "content": content,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Update conversation
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {
            "last_message": content,
            "last_message_at": datetime.now(timezone.utc)
        }}
    )
    
    # Get sender info
    sender = await db.users.find_one({"user_id": sender_id}, {"_id": 0})
    
    # Broadcast to room
    message_data = {
        "message_id": message_id,
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "sender_name": sender["name"] if sender else "Unknown",
        "sender_picture": sender["picture"] if sender else None,
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await sio.emit('new_message', message_data, room=f"conversation_{conversation_id}")

@sio.event
async def typing(sid, data):
    conversation_id = data.get("conversation_id")
    user_id = data.get("user_id")
    
    if conversation_id and user_id:
        await sio.emit('user_typing', {"user_id": user_id}, room=f"conversation_{conversation_id}", skip_sid=sid)

# Health check at root
@app.get("/health")
async def health():
    return {"status": "ok"}

# Include router
app.include_router(api_router)

# Wrap with Socket.IO
app_with_socketio = socketio.ASGIApp(sio, app)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app_with_socketio, host="0.0.0.0", port=8001)
