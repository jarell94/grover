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

# Sentry for error tracking
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

# Prometheus metrics
from metrics import setup_metrics, track_post_created, track_auth_attempt, track_message_sent, track_transaction

# Redis Cache Service
from cache_service import (
    cache, init_cache, close_cache, 
    batch_fetch_users, enrich_posts_with_users, enrich_comments_with_users
)

# Load environment variables first
load_dotenv()

# Initialize Sentry (must be before FastAPI app initialization)
SENTRY_DSN = os.getenv("SENTRY_DSN")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=ENVIRONMENT,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        # Set traces_sample_rate to capture performance data
        traces_sample_rate=0.1 if ENVIRONMENT == "production" else 1.0,
        # Set profiles_sample_rate to profile transactions
        profiles_sample_rate=0.1 if ENVIRONMENT == "production" else 1.0,
        # Capture user info (without PII)
        send_default_pii=False,
        # Release version
        release=os.getenv("APP_VERSION", "1.0.0"),
    )
    logging.info(f"Sentry initialized for environment: {ENVIRONMENT}")
else:
    logging.warning("SENTRY_DSN not set - error tracking disabled")

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
MESSAGE_EDIT_WINDOW = timedelta(minutes=15)
MESSAGE_DELETE_WINDOW = timedelta(hours=1)
FOLLOWER_MILESTONES = [10, 50, 100, 250, 500, 1000, 5000, 10000]
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"]
ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"]
ALLOWED_MEDIA_TYPES = ALLOWED_IMAGE_TYPES + ALLOWED_VIDEO_TYPES + ALLOWED_AUDIO_TYPES

# ID validation pattern (alphanumeric with underscores)
ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,50}$')

ROOT_DIR = Path(__file__).parent

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

# Setup Prometheus metrics
setup_metrics(app)

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

# ============ DATABASE INDEXES ============

async def create_indexes():
    """
    Create MongoDB indexes for optimized queries.
    These indexes significantly improve performance for:
    - User search
    - Feed queries
    - Message lookups
    - Notification queries
    """
    logger.info("Creating database indexes...")
    indexes_created = 0
    indexes_skipped = 0
    
    # Helper function to safely create index
    async def safe_create_index(collection, keys, **kwargs):
        nonlocal indexes_created, indexes_skipped
        try:
            await collection.create_index(keys, **kwargs)
            indexes_created += 1
        except Exception as e:
            # Index might already exist with same or different options
            indexes_skipped += 1
            logger.debug(f"Index creation skipped for {collection.name}: {e}")
    
    # ========== USERS COLLECTION ==========
    await safe_create_index(db.users, "user_id", unique=True, background=True, name="users_user_id_unique")
    await safe_create_index(db.users, "email", unique=True, background=True, name="users_email_unique")
    await safe_create_index(db.users, [("name", "text")], background=True, name="users_name_text")
    await safe_create_index(db.users, "is_premium", background=True, name="users_is_premium")
    
    # ========== POSTS COLLECTION ==========
    await safe_create_index(db.posts, "post_id", unique=True, background=True, name="posts_post_id_unique")
    await safe_create_index(db.posts, [("user_id", 1), ("created_at", -1)], background=True, name="posts_user_created")
    await safe_create_index(db.posts, [("created_at", -1)], background=True, name="posts_created_desc")
    await safe_create_index(db.posts, [("likes_count", -1), ("created_at", -1)], background=True, name="posts_popular")
    await safe_create_index(db.posts, [("user_id", 1), ("media_type", 1), ("created_at", -1)], background=True, name="posts_user_media")
    await safe_create_index(db.posts, "original_post_id", background=True, sparse=True, name="posts_original_post")
    
    # ========== LIKES COLLECTION ==========
    await safe_create_index(db.likes, [("post_id", 1), ("user_id", 1)], unique=True, background=True, name="likes_post_user_unique")
    await safe_create_index(db.likes, "post_id", background=True, name="likes_post_id")
    await safe_create_index(db.likes, [("user_id", 1), ("created_at", -1)], background=True, name="likes_user_created")
    
    # ========== DISLIKES COLLECTION ==========
    await safe_create_index(db.dislikes, [("post_id", 1), ("user_id", 1)], unique=True, background=True, name="dislikes_post_user_unique")
    await safe_create_index(db.dislikes, "post_id", background=True, name="dislikes_post_id")
    
    # ========== COMMENTS COLLECTION ==========
    await safe_create_index(db.comments, "comment_id", unique=True, background=True, name="comments_comment_id_unique")
    await safe_create_index(db.comments, [("post_id", 1), ("created_at", -1)], background=True, name="comments_post_created")
    await safe_create_index(db.comments, [("user_id", 1), ("created_at", -1)], background=True, name="comments_user_created")
    await safe_create_index(db.comments, "parent_id", background=True, sparse=True, name="comments_parent")
    
    # ========== FOLLOWERS COLLECTION ==========
    await safe_create_index(db.followers, [("follower_id", 1), ("following_id", 1)], unique=True, background=True, name="followers_unique")
    await safe_create_index(db.followers, "following_id", background=True, name="followers_following")
    await safe_create_index(db.followers, "follower_id", background=True, name="followers_follower")
    
    # ========== MESSAGES COLLECTION ==========
    await safe_create_index(db.messages, "message_id", unique=True, background=True, name="messages_message_id_unique")
    await safe_create_index(db.messages, [("conversation_id", 1), ("created_at", -1)], background=True, name="messages_conv_created")
    await safe_create_index(db.messages, [("conversation_id", 1), ("read", 1)], background=True, name="messages_conv_read")
    
    # ========== CONVERSATIONS COLLECTION ==========
    await safe_create_index(db.conversations, "conversation_id", unique=True, background=True, name="conversations_id_unique")
    await safe_create_index(db.conversations, "participants", background=True, name="conversations_participants")
    await safe_create_index(db.conversations, [("participants", 1), ("updated_at", -1)], background=True, name="conversations_participants_updated")
    
    # ========== NOTIFICATIONS COLLECTION ==========
    await safe_create_index(db.notifications, "notification_id", unique=True, background=True, name="notifications_id_unique")
    await safe_create_index(db.notifications, [("user_id", 1), ("created_at", -1)], background=True, name="notifications_user_created")
    await safe_create_index(db.notifications, [("user_id", 1), ("read", 1), ("created_at", -1)], background=True, name="notifications_user_unread")
    
    # ========== STORIES COLLECTION ==========
    await safe_create_index(db.stories, "story_id", unique=True, background=True, name="stories_story_id_unique")
    await safe_create_index(db.stories, [("user_id", 1), ("expires_at", 1)], background=True, name="stories_user_expires")
    await safe_create_index(db.stories, "expires_at", expireAfterSeconds=0, background=True, name="stories_ttl")
    
    # ========== SAVED POSTS COLLECTION ==========
    await safe_create_index(db.saved_posts, [("user_id", 1), ("post_id", 1)], unique=True, background=True, name="saved_posts_unique")
    await safe_create_index(db.saved_posts, [("user_id", 1), ("created_at", -1)], background=True, name="saved_posts_user_created")
    
    # ========== COLLECTIONS COLLECTION ==========
    await safe_create_index(db.collections, "collection_id", unique=True, background=True, name="collections_id_unique")
    await safe_create_index(db.collections, [("user_id", 1), ("created_at", -1)], background=True, name="collections_user_created")
    
    # ========== PRODUCTS COLLECTION ==========
    await safe_create_index(db.products, "product_id", unique=True, background=True, name="products_id_unique")
    await safe_create_index(db.products, [("seller_id", 1), ("created_at", -1)], background=True, name="products_seller_created")
    await safe_create_index(db.products, [("title", "text"), ("description", "text")], background=True, name="products_text_search")
    await safe_create_index(db.products, [("category", 1), ("created_at", -1)], background=True, name="products_category_created")
    
    # ========== LIVE STREAMS COLLECTION ==========
    await safe_create_index(db.live_streams, "stream_id", unique=True, background=True, name="streams_id_unique")
    await safe_create_index(db.live_streams, [("host_id", 1), ("created_at", -1)], background=True, name="streams_host_created")
    await safe_create_index(db.live_streams, [("status", 1), ("viewer_count", -1)], background=True, name="streams_active_popular")
    
    # ========== COMMUNITIES COLLECTION ==========
    await safe_create_index(db.communities, "community_id", unique=True, background=True, name="communities_id_unique")
    await safe_create_index(db.communities, "members", background=True, name="communities_members")
    await safe_create_index(db.communities, [("name", "text"), ("description", "text")], background=True, name="communities_text_search")
    
    # ========== SESSIONS COLLECTION ==========
    await safe_create_index(db.sessions, "session_token", unique=True, background=True, name="sessions_token_unique")
    await safe_create_index(db.sessions, "user_id", background=True, name="sessions_user")
    await safe_create_index(db.sessions, "expires_at", expireAfterSeconds=0, background=True, name="sessions_ttl")
    
    logger.info(f"Database indexes: {indexes_created} created, {indexes_skipped} already exist")

@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    await create_indexes()
    # Initialize Redis cache
    cache_connected = await init_cache()
    if cache_connected:
        logger.info("Redis cache connected")
    else:
        logger.warning("Redis cache not available - running without caching")
    logger.info("Application startup complete")

# ============ HEALTH CHECK ENDPOINT ============

@api_router.get("/health")
async def health_check():
    """
    Health check endpoint for deployment monitoring.
    Returns status of all services.
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "services": {}
    }
    
    # Check MongoDB connection
    try:
        await db.command("ping")
        health_status["services"]["mongodb"] = {"status": "connected"}
    except Exception as e:
        health_status["services"]["mongodb"] = {"status": "disconnected", "error": str(e)}
        health_status["status"] = "degraded"
    
    # Check Cloudinary configuration
    health_status["services"]["cloudinary"] = {
        "status": "configured" if CLOUDINARY_CONFIGURED else "not_configured"
    }
    
    # Check Agora configuration
    health_status["services"]["agora"] = {
        "status": "available" if AGORA_AVAILABLE else "not_available"
    }
    
    # Check PayPal configuration
    paypal_configured = bool(os.getenv("PAYPAL_CLIENT_ID") and os.getenv("PAYPAL_CLIENT_SECRET"))
    health_status["services"]["paypal"] = {
        "status": "configured" if paypal_configured else "not_configured"
    }
    
    # Check Redis cache status
    health_status["services"]["redis"] = {
        "status": "connected" if cache.connected else "not_connected"
    }
    
    return health_status

@api_router.get("/ready")
async def readiness_check():
    """
    Readiness check for Kubernetes/deployment.
    Returns 200 only if all critical services are available.
    """
    try:
        # Must have MongoDB connection
        await db.command("ping")
        return {"status": "ready"}
    except Exception:
        raise HTTPException(status_code=503, detail="Service not ready")

# ============ HELPER FUNCTIONS ============

def generate_notification_id() -> str:
    return f"notif_{uuid.uuid4().hex[:12]}"

def normalize_datetime(value: Optional[datetime]) -> Optional[datetime]:
    """Normalize naive datetimes to UTC-aware values."""
    if value and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value

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
            "notification_id": generate_notification_id(),
            "user_id": user_id,
            "type": notification_type,
            "content": content,
            "read": False,
            "created_at": datetime.now(timezone.utc)
        }
        if related_id:
            notification_data["related_id"] = related_id
        
        await db.notifications.insert_one(notification_data)
        await emit_activity_event(user_id, {
            "notification_id": notification_data["notification_id"],
            "type": notification_type,
            "content": content,
            "related_id": related_id,
            "created_at": notification_data["created_at"].isoformat(),
        })


async def emit_to_user(user_id: str, event: str, payload: dict):
    """Emit a socket event to a specific user room."""
    if not user_id:
        return
    await sio.emit(event, payload, room=f"user_{user_id}")


def is_follower_milestone(count: int) -> bool:
    return count in FOLLOWER_MILESTONES


async def build_live_metrics(user_id: str) -> dict:
    """Build live metrics payload for sockets."""
    followers_count = await db.follows.count_documents({"following_id": user_id})

    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_posts": {"$sum": 1},
            "total_likes": {"$sum": "$likes_count"},
            "total_comments": {"$sum": "$comments_count"},
            "total_shares": {"$sum": "$shares_count"},
        }}
    ]
    aggregates = await db.posts.aggregate(pipeline).to_list(1)
    totals = aggregates[0] if aggregates else {}

    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "total_earnings": 1, "earnings_balance": 1}
    )
    total_revenue = (user or {}).get("total_earnings", 0)
    earnings_balance = (user or {}).get("earnings_balance", 0)

    return {
        "user_id": user_id,
        "followers_count": followers_count,
        "total_posts": totals.get("total_posts", 0),
        "total_likes": totals.get("total_likes", 0),
        "total_comments": totals.get("total_comments", 0),
        "total_shares": totals.get("total_shares", 0),
        "total_revenue": total_revenue,
        "earnings_balance": earnings_balance,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


async def emit_live_metrics(user_id: str, reason: str = None):
    payload = await build_live_metrics(user_id)
    if reason:
        payload["reason"] = reason
    await emit_to_user(user_id, "live_metrics", payload)


async def emit_activity_event(user_id: str, payload: dict):
    await emit_to_user(user_id, "activity_event", payload)


async def emit_follower_milestone(user_id: str, follower_count: int):
    if not is_follower_milestone(follower_count):
        return
    await emit_to_user(user_id, "milestone", {
        "type": "followers",
        "value": follower_count,
        "message": f"You reached {follower_count} followers!",
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def emit_message_deleted(conversation_id: Optional[str], message_id: str, deleted_at: datetime):
    if not conversation_id:
        return
    await sio.emit("message_deleted", {
        "message_id": message_id,
        "conversation_id": conversation_id,
        "deleted_for_everyone": True,
        "deleted_at": deleted_at.isoformat(),
        "content": "Message deleted",
        "is_deleted": True
    }, room=f"conversation_{conversation_id}")

# ============ MODELS ============

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = ""
    is_premium: bool = False
    is_private: bool = False
    monetization_enabled: bool = False  # Creator monetization toggle (tips, subscriptions, paid content)
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
    edited_at: Optional[datetime] = None
    edit_history: Optional[List[dict]] = None
    deleted_for: List[str] = []
    deleted_for_everyone: bool = False
    deleted_at: Optional[datetime] = None

class MessageEdit(BaseModel):
    content: str

class MessageDelete(BaseModel):
    delete_for_everyone: bool = False

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
                    "monetization_enabled": False,  # Monetization OFF by default
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
    monetization_enabled: Optional[bool] = None,  # Creator monetization toggle
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
    if monetization_enabled is not None:
        update_data["monetization_enabled"] = bool(monetization_enabled)
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
        await emit_live_metrics(user_id, reason="followers")
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
        
        followers_count = await db.follows.count_documents({"following_id": user_id})
        await emit_live_metrics(user_id, reason="followers")
        await emit_follower_milestone(user_id, followers_count)
        
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
    
    if not posts:
        return posts
    
    # BATCH OPTIMIZATION: Collect all IDs needed for batch queries
    post_ids = [p["post_id"] for p in posts]
    user_ids = list(set(p["user_id"] for p in posts))
    original_post_ids = [p["original_post_id"] for p in posts if p.get("is_repost") and p.get("original_post_id")]
    
    # Batch fetch all users
    users_list = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0}).to_list(len(user_ids))
    users_map = {u["user_id"]: u for u in users_list}
    
    # Batch fetch original posts for reposts
    original_posts_map = {}
    if original_post_ids:
        original_posts = await db.posts.find({"post_id": {"$in": original_post_ids}}, {"_id": 0}).to_list(len(original_post_ids))
        original_user_ids = list(set(op["user_id"] for op in original_posts))
        original_users = await db.users.find({"user_id": {"$in": original_user_ids}}, {"_id": 0}).to_list(len(original_user_ids))
        original_users_map = {u["user_id"]: u for u in original_users}
        for op in original_posts:
            op["user"] = original_users_map.get(op["user_id"])
            original_posts_map[op["post_id"]] = op
    
    # Batch fetch user reactions
    reactions_list = await db.reactions.find({
        "user_id": current_user.user_id,
        "post_id": {"$in": post_ids}
    }).to_list(len(post_ids))
    reactions_map = {r["post_id"]: r["reaction_type"] for r in reactions_list}
    
    # Batch fetch dislikes
    dislikes_list = await db.dislikes.find({
        "user_id": current_user.user_id,
        "post_id": {"$in": post_ids}
    }).to_list(len(post_ids))
    dislikes_set = {d["post_id"] for d in dislikes_list}
    
    # Batch fetch saved posts
    saved_list = await db.saved_posts.find({
        "user_id": current_user.user_id,
        "post_id": {"$in": post_ids}
    }).to_list(len(post_ids))
    saved_set = {s["post_id"] for s in saved_list}
    
    # Batch fetch reposts by current user
    reposts_list = await db.posts.find({
        "user_id": current_user.user_id,
        "is_repost": True,
        "original_post_id": {"$in": post_ids}
    }, {"original_post_id": 1}).to_list(len(post_ids))
    reposted_set = {r["original_post_id"] for r in reposts_list}
    
    # Populate posts with batched data
    for post in posts:
        post_id = post["post_id"]
        post["user"] = users_map.get(post["user_id"])
        
        # Original post for reposts
        if post.get("is_repost") and post.get("original_post_id"):
            post["original_post"] = original_posts_map.get(post["original_post_id"])
        
        # User interactions
        post["user_reaction"] = reactions_map.get(post_id)
        post["liked"] = reactions_map.get(post_id) == "like"
        post["disliked"] = post_id in dislikes_set
        post["saved"] = post_id in saved_set
        post["reposted"] = post_id in reposted_set
    
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
    
    if not posts:
        return posts
    
    # BATCH OPTIMIZATION: Collect all IDs needed for batch queries
    post_ids = [p["post_id"] for p in posts]
    user_ids = list(set(p["user_id"] for p in posts))
    original_post_ids = [p["original_post_id"] for p in posts if p.get("is_repost") and p.get("original_post_id")]
    
    # Batch fetch all users
    users_list = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0}).to_list(len(user_ids))
    users_map = {u["user_id"]: u for u in users_list}
    
    # Batch fetch original posts for reposts
    original_posts_map = {}
    if original_post_ids:
        original_posts = await db.posts.find({"post_id": {"$in": original_post_ids}}, {"_id": 0}).to_list(len(original_post_ids))
        original_user_ids = list(set(op["user_id"] for op in original_posts))
        original_users = await db.users.find({"user_id": {"$in": original_user_ids}}, {"_id": 0}).to_list(len(original_user_ids))
        original_users_map = {u["user_id"]: u for u in original_users}
        for op in original_posts:
            op["user"] = original_users_map.get(op["user_id"])
            original_posts_map[op["post_id"]] = op
    
    # Batch fetch user reactions
    reactions_list = await db.reactions.find({
        "user_id": current_user.user_id,
        "post_id": {"$in": post_ids}
    }).to_list(len(post_ids))
    reactions_map = {r["post_id"]: r["reaction_type"] for r in reactions_list}
    
    # Batch fetch dislikes
    dislikes_list = await db.dislikes.find({
        "user_id": current_user.user_id,
        "post_id": {"$in": post_ids}
    }).to_list(len(post_ids))
    dislikes_set = {d["post_id"] for d in dislikes_list}
    
    # Batch fetch saved posts
    saved_list = await db.saved_posts.find({
        "user_id": current_user.user_id,
        "post_id": {"$in": post_ids}
    }).to_list(len(post_ids))
    saved_set = {s["post_id"] for s in saved_list}
    
    # Batch fetch reposts by current user
    reposts_list = await db.posts.find({
        "user_id": current_user.user_id,
        "is_repost": True,
        "original_post_id": {"$in": post_ids}
    }, {"original_post_id": 1}).to_list(len(post_ids))
    reposted_set = {r["original_post_id"] for r in reposts_list}
    
    # Populate posts with batched data
    for post in posts:
        post_id = post["post_id"]
        post["user"] = users_map.get(post["user_id"])
        
        # Original post for reposts
        if post.get("is_repost") and post.get("original_post_id"):
            post["original_post"] = original_posts_map.get(post["original_post_id"])
        
        # User interactions
        post["user_reaction"] = reactions_map.get(post_id)
        post["liked"] = reactions_map.get(post_id) == "like"
        post["disliked"] = post_id in dislikes_set
        post["saved"] = post_id in saved_set
        post["reposted"] = post_id in reposted_set
    
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
            await emit_live_metrics(post["user_id"], reason="engagement")
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
            await emit_live_metrics(post["user_id"], reason="engagement")
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
        
        await emit_live_metrics(post["user_id"], reason="engagement")
        
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
    
    await emit_live_metrics(post["user_id"], reason="engagement")

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
    
    await emit_live_metrics(original_post["user_id"], reason="engagement")

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
    """Get saved posts - OPTIMIZED"""
    saved = await db.saved_posts.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    post_ids = [s["post_id"] for s in saved]
    posts = await db.posts.find(
        {"post_id": {"$in": post_ids}},
        {"_id": 0}
    ).to_list(100)
    
    if not posts:
        return posts
    
    # BATCH OPTIMIZATION
    user_ids = list(set(p["user_id"] for p in posts))
    
    # Batch fetch users
    users_map = await batch_fetch_users(db, user_ids)
    
    # Batch fetch reactions
    reactions = await db.reactions.find({
        "user_id": current_user.user_id,
        "post_id": {"$in": post_ids}
    }).to_list(len(post_ids))
    reactions_map = {r["post_id"]: r["reaction_type"] for r in reactions}
    
    # Batch fetch dislikes
    dislikes = await db.dislikes.find({
        "user_id": current_user.user_id,
        "post_id": {"$in": post_ids}
    }).to_list(len(post_ids))
    dislikes_set = {d["post_id"] for d in dislikes}
    
    # Enrich posts
    for post in posts:
        post["user"] = users_map.get(post["user_id"])
        post["user_reaction"] = reactions_map.get(post["post_id"])
        post["liked"] = reactions_map.get(post["post_id"]) == "like"
        post["disliked"] = post["post_id"] in dislikes_set
        post["saved"] = True
    
    return posts

@api_router.get("/mentions")
async def get_mentions(current_user: User = Depends(require_auth)):
    """Get posts where the current user has been mentioned/tagged - OPTIMIZED"""
    posts = await db.posts.find(
        {"tagged_users": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    if not posts:
        return posts
    
    # BATCH OPTIMIZATION
    post_ids = [p["post_id"] for p in posts]
    user_ids = list(set(p["user_id"] for p in posts))
    
    # Batch fetch users
    users_map = await batch_fetch_users(db, user_ids)
    
    # Batch fetch reactions
    reactions = await db.reactions.find({
        "user_id": current_user.user_id,
        "post_id": {"$in": post_ids}
    }).to_list(len(post_ids))
    reactions_map = {r["post_id"]: r["reaction_type"] for r in reactions}
    
    # Enrich posts
    for post in posts:
        post["user"] = users_map.get(post["user_id"])
        post["user_reaction"] = reactions_map.get(post["post_id"])
        post["is_liked"] = reactions_map.get(post["post_id"]) == "like"
        post["liked"] = post["is_liked"]
    
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
    content: Optional[str] = None,
    visibility: Optional[str] = None,
    is_pinned: Optional[bool] = None,
    tags: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """Update a post - supports content, visibility, pinned status, and tags"""
    validate_id(post_id, "post_id")
    
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if content is not None:
        update_data["content"] = sanitize_string(content, 5000, "content")
        # Re-extract hashtags if content changed
        import re
        hashtags = re.findall(r'#(\w+)', content)
        if hashtags:
            update_data["tags"] = list(set(hashtags))[:10]
    
    if visibility is not None:
        if visibility not in ["public", "followers", "private"]:
            raise HTTPException(status_code=400, detail="Invalid visibility. Must be: public, followers, or private")
        update_data["visibility"] = visibility
    
    if is_pinned is not None:
        update_data["is_pinned"] = bool(is_pinned)
    
    if tags is not None:
        # Parse comma-separated tags
        tag_list = [t.strip().lower() for t in tags.split(",") if t.strip()]
        update_data["tags"] = tag_list[:10]  # Max 10 tags
    
    await db.posts.update_one({"post_id": post_id}, {"$set": update_data})
    
    # Invalidate cache if using Redis
    await cache.invalidate_post(post_id)
    
    updated_post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return {"message": "Post updated", "post": updated_post}

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
    """Get all comments for a post (only top-level, not replies) - OPTIMIZED"""
    comments = await db.comments.find(
        {"post_id": post_id, "parent_comment_id": None},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    if not comments:
        return comments
    
    # BATCH OPTIMIZATION: Collect all needed IDs
    comment_ids = [c["comment_id"] for c in comments]
    user_ids = list(set(c["user_id"] for c in comments))
    
    # Batch fetch users
    users_map = await batch_fetch_users(db, user_ids)
    
    # Batch fetch likes
    likes = await db.comment_likes.find({
        "user_id": current_user.user_id,
        "comment_id": {"$in": comment_ids}
    }).to_list(len(comment_ids))
    liked_set = {l["comment_id"] for l in likes}
    
    # Enrich comments
    for comment in comments:
        comment["user"] = users_map.get(comment["user_id"])
        comment["liked"] = comment["comment_id"] in liked_set
    
    return comments

@api_router.get("/comments/{comment_id}/replies")
async def get_comment_replies(comment_id: str, current_user: User = Depends(require_auth)):
    """Get all replies to a comment - OPTIMIZED"""
    replies = await db.comments.find(
        {"parent_comment_id": comment_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    if not replies:
        return replies
    
    # BATCH OPTIMIZATION: Collect all needed IDs
    reply_ids = [r["comment_id"] for r in replies]
    user_ids = list(set(r["user_id"] for r in replies))
    
    # Batch fetch users
    users_map = await batch_fetch_users(db, user_ids)
    
    # Batch fetch likes
    likes = await db.comment_likes.find({
        "user_id": current_user.user_id,
        "comment_id": {"$in": reply_ids}
    }).to_list(len(reply_ids))
    liked_set = {l["comment_id"] for l in likes}
    
    # Enrich replies
    for reply in replies:
        reply["user"] = users_map.get(reply["user_id"])
        reply["liked"] = reply["comment_id"] in liked_set
    
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
    
    await emit_live_metrics(post["user_id"], reason="engagement")

    return {"comment_id": comment_id, "message": "Comment created"}

@api_router.post("/comments/{comment_id}/like")
async def like_comment(comment_id: str, current_user: User = Depends(require_auth)):
    """Like or unlike a comment"""
    comment = await db.comments.find_one({"comment_id": comment_id}, {"_id": 0})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    target_user_id = comment.get("user_id")
    
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
        await emit_live_metrics(target_user_id, reason="engagement")
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
            notification_id = generate_notification_id()
            await db.notifications.insert_one({
                "notification_id": notification_id,
                "user_id": comment["user_id"],
                "type": "comment_like",
                "content": f"{current_user.name} liked your comment",
                "read": False,
                "created_at": datetime.now(timezone.utc)
            })
            await emit_activity_event(comment["user_id"], {
                "notification_id": notification_id,
                "type": "comment_like",
                "content": f"{current_user.name} liked your comment",
                "related_id": comment_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        
        await emit_live_metrics(target_user_id, reason="engagement")
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
    name: Optional[str] = None,
    description: Optional[str] = None,
    price: Optional[float] = None,
    stock: Optional[int] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    sale_price: Optional[float] = None,
    sku: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """Update a product - supports name, description, price, stock, category, active status, sale price, and SKU"""
    validate_id(product_id, "product_id")
    
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if name is not None:
        update_data["name"] = sanitize_string(name, 200, "name")
    if description is not None:
        update_data["description"] = sanitize_string(description, 2000, "description")
    if price is not None:
        if price < 0:
            raise HTTPException(status_code=400, detail="Price cannot be negative")
        update_data["price"] = round(price, 2)
    if stock is not None:
        if stock < 0:
            raise HTTPException(status_code=400, detail="Stock cannot be negative")
        update_data["stock"] = stock
    if category is not None:
        update_data["category"] = sanitize_string(category, 100, "category")
    if is_active is not None:
        update_data["is_active"] = bool(is_active)
    if sale_price is not None:
        if sale_price < 0:
            raise HTTPException(status_code=400, detail="Sale price cannot be negative")
        if price is not None and sale_price >= price:
            raise HTTPException(status_code=400, detail="Sale price must be less than regular price")
        update_data["sale_price"] = round(sale_price, 2)
    if sku is not None:
        update_data["sku"] = sanitize_string(sku, 50, "sku")
    
    await db.products.update_one({"product_id": product_id}, {"$set": update_data})
    
    updated_product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    return {"message": "Product updated", "product": updated_product}

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
    """Execute a PayPal payment after user approval (5% platform fee for products)"""
    result = execute_payment(payment_id, payer_id)
    
    if result["success"]:
        # Get product details
        product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Get seller info
        seller = await db.users.find_one({"user_id": product["user_id"]}, {"_id": 0})
        
        # Calculate platform fee using standard revenue share (5% for products)
        split = calculate_revenue_split(product["price"], "products")
        platform_fee = split["platform_fee"]
        seller_amount = split["creator_payout"]
        
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
    notification_id = generate_notification_id()
    await db.notifications.insert_one({
        "notification_id": notification_id,
        "user_id": product["user_id"],
        "type": "purchase",
        "content": f"{current_user.name} purchased {product['name']}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    await emit_activity_event(product["user_id"], {
        "notification_id": notification_id,
        "type": "purchase",
        "content": f"{current_user.name} purchased {product['name']}",
        "related_id": order_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
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
    
    filtered_messages = []
    for message in messages:
        if current_user.user_id in message.get("deleted_for", []):
            continue
        if message.get("deleted_for_everyone"):
            message["content"] = "Message deleted"
            message["is_deleted"] = True
        filtered_messages.append(message)

    # Mark as read
    await db.messages.update_many(
        {
            "conversation_id": conv["conversation_id"],
            "sender_id": user_id,
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    return {"conversation_id": conv["conversation_id"], "messages": filtered_messages}

@api_router.patch("/messages/{message_id}")
async def edit_message(
    message_id: str,
    payload: MessageEdit,
    current_user: User = Depends(require_auth)
):
    """Edit a message within the allowed edit window."""
    validate_id(message_id, "message_id")
    new_content = sanitize_string(payload.content, MAX_INPUT_LENGTH, "message content")
    if not new_content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    message = await db.messages.find_one({"message_id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.get("sender_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this message")
    if message.get("deleted_for_everyone"):
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")

    created_at = normalize_datetime(message.get("created_at"))
    if not created_at:
        raise HTTPException(status_code=400, detail="Message timestamp missing")

    now = datetime.now(timezone.utc)
    if now - created_at > MESSAGE_EDIT_WINDOW:
        raise HTTPException(status_code=400, detail="Edit window expired")

    previous_edit_timestamp = message.get("edited_at") or created_at
    update_ops = {
        "$set": {"content": new_content, "edited_at": now},
        "$push": {
            "edit_history": {
                "content": message.get("content", ""),
                # Timestamp when the replaced content was last set (created or edited)
                "last_modified_at": previous_edit_timestamp,
                "replaced_at": now
            }
        }
    }
    await db.messages.update_one({"message_id": message_id}, update_ops)

    conversation_id = message.get("conversation_id")
    if conversation_id:
        conversation = await db.conversations.find_one(
            {"conversation_id": conversation_id},
            {"_id": 0, "last_message": 1}
        )
        if conversation and conversation.get("last_message") == message.get("content"):
            await db.conversations.update_one(
                {"conversation_id": conversation_id},
                {"$set": {"last_message": new_content}}
            )

        message_data = {
            "message_id": message_id,
            "conversation_id": conversation_id,
            "sender_id": current_user.user_id,
            "content": new_content,
            "created_at": created_at.isoformat(),
            "edited_at": now.isoformat()
        }
        await sio.emit("message_edited", message_data, room=f"conversation_{conversation_id}")

    return {
        "message_id": message_id,
        "content": new_content,
        "edited_at": now
    }

@api_router.post("/messages/{message_id}/delete")
async def delete_message(
    message_id: str,
    payload: MessageDelete,
    current_user: User = Depends(require_auth)
):
    """Delete a message for self or everyone."""
    validate_id(message_id, "message_id")
    message = await db.messages.find_one({"message_id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if payload.delete_for_everyone:
        if message.get("sender_id") != current_user.user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete for everyone")
        if message.get("deleted_for_everyone"):
            deleted_at = message.get("deleted_at")
            return {
                "message_id": message_id,
                "deleted_for_everyone": True,
                "deleted_at": deleted_at.isoformat() if deleted_at else None
            }

        created_at = normalize_datetime(message.get("created_at"))
        if not created_at or datetime.now(timezone.utc) - created_at > MESSAGE_DELETE_WINDOW:
            raise HTTPException(status_code=400, detail="Cannot delete for everyone: delete window expired")
        if message.get("read") is True:
            raise HTTPException(status_code=400, detail="Cannot delete for everyone: message has been read")
        if message.get("edited_at") is not None:
            raise HTTPException(status_code=400, detail="Cannot delete for everyone: message has been edited")

        deleted_at = datetime.now(timezone.utc)
        await db.messages.update_one(
            {"message_id": message_id},
            {"$set": {"deleted_for_everyone": True, "deleted_at": deleted_at}}
        )

        conversation_id = message.get("conversation_id")
        if conversation_id:
            conversation = await db.conversations.find_one(
                {"conversation_id": conversation_id},
                {"_id": 0, "last_message": 1}
            )
            if conversation and conversation.get("last_message") == message.get("content"):
                await db.conversations.update_one(
                    {"conversation_id": conversation_id},
                    {"$set": {"last_message": "Message deleted"}}
                )

            await emit_message_deleted(conversation_id, message_id, deleted_at)

        return {
            "message_id": message_id,
            "deleted_for_everyone": True,
            "deleted_at": deleted_at.isoformat()
        }

    await db.messages.update_one(
        {"message_id": message_id},
        {"$addToSet": {"deleted_for": current_user.user_id}}
    )
    return {"message_id": message_id, "deleted_for_everyone": False}

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
        "created_at": datetime.now(timezone.utc),
        "deleted_for": [],
        "deleted_for_everyone": False,
        "deleted_at": None
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
        "created_at": datetime.now(timezone.utc),
        "deleted_for": [],
        "deleted_for_everyone": False,
        "deleted_at": None
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
        "created_at": datetime.now(timezone.utc),
        "deleted_for": [],
        "deleted_for_everyone": False,
        "deleted_at": None
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
        "created_at": datetime.now(timezone.utc),
        "deleted_for": [],
        "deleted_for_everyone": False,
        "deleted_at": None
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
    type_filter: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """
    Get notifications with optional filtering.
    
    type_filter options:
    - likes: like notifications
    - comments: comment and reply notifications
    - follows: follow notifications
    - mentions: mention notifications
    - messages: message notifications
    - sales: sales and transaction notifications
    - streams: live stream notifications
    - all: all notifications (default)
    """
    query = {"user_id": current_user.user_id}
    
    if unread_only:
        query["read"] = False
    
    # Apply type filter
    if type_filter and type_filter != "all":
        type_mapping = {
            "likes": ["like", "reaction"],
            "comments": ["comment", "reply", "comment_like"],
            "follows": ["follow", "follow_request"],
            "mentions": ["mention", "tag"],
            "messages": ["message", "dm"],
            "sales": ["sale", "purchase", "tip", "subscription", "payout"],
            "streams": ["stream_live", "scheduled_stream", "super_chat"],
        }
        
        notification_types = type_mapping.get(type_filter, [type_filter])
        query["type"] = {"$in": notification_types}
    
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get total count for pagination
    total = await db.notifications.count_documents(query)
    
    # Get unread count
    unread_count = await db.notifications.count_documents({
        "user_id": current_user.user_id,
        "read": False
    })
    
    return {
        "notifications": notifications,
        "total": total,
        "unread_count": unread_count,
        "has_more": skip + len(notifications) < total
    }

@api_router.get("/notifications/count")
async def get_notifications_count(current_user: User = Depends(require_auth)):
    """Get unread notification counts by type"""
    pipeline = [
        {"$match": {"user_id": current_user.user_id, "read": False}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
    ]
    
    results = await db.notifications.aggregate(pipeline).to_list(100)
    
    # Build count by category
    counts = {
        "total": 0,
        "likes": 0,
        "comments": 0,
        "follows": 0,
        "mentions": 0,
        "messages": 0,
        "sales": 0,
        "streams": 0,
        "other": 0,
    }
    
    type_to_category = {
        "like": "likes", "reaction": "likes",
        "comment": "comments", "reply": "comments", "comment_like": "comments",
        "follow": "follows", "follow_request": "follows",
        "mention": "mentions", "tag": "mentions",
        "message": "messages", "dm": "messages",
        "sale": "sales", "purchase": "sales", "tip": "sales", "subscription": "sales", "payout": "sales",
        "stream_live": "streams", "scheduled_stream": "streams", "super_chat": "streams",
    }
    
    for result in results:
        notification_type = result["_id"]
        count = result["count"]
        category = type_to_category.get(notification_type, "other")
        counts[category] += count
        counts["total"] += count
    
    return counts

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


# ============ PUSH NOTIFICATIONS ENDPOINTS ============

class PushTokenData(BaseModel):
    token: str
    platform: str = "unknown"  # "ios", "android", "web"

@api_router.post("/push/register")
async def register_push_token(
    data: PushTokenData,
    current_user: User = Depends(require_auth)
):
    """Register a device push notification token"""
    # Upsert the push token for this user/device
    await db.push_tokens.update_one(
        {"user_id": current_user.user_id, "token": data.token},
        {"$set": {
            "user_id": current_user.user_id,
            "token": data.token,
            "platform": data.platform,
            "updated_at": datetime.now(timezone.utc),
            "active": True
        }},
        upsert=True
    )
    
    logger.info(f"Push token registered for user {current_user.user_id}")
    return {"message": "Push token registered"}


@api_router.delete("/push/unregister")
async def unregister_push_token(
    token: str,
    current_user: User = Depends(require_auth)
):
    """Unregister a device push notification token"""
    await db.push_tokens.update_one(
        {"user_id": current_user.user_id, "token": token},
        {"$set": {"active": False}}
    )
    return {"message": "Push token unregistered"}


async def send_push_notification(
    user_id: str,
    title: str,
    body: str,
    data: dict = None,
    channel: str = "default"
):
    """
    Send push notification to a user via Expo Push Notifications
    
    Requires EXPO_ACCESS_TOKEN environment variable for production
    """
    import httpx
    
    # Get user's active push tokens
    tokens = await db.push_tokens.find(
        {"user_id": user_id, "active": True},
        {"token": 1, "_id": 0}
    ).to_list(10)
    
    if not tokens:
        return {"sent": 0, "reason": "No active push tokens"}
    
    # Prepare Expo push messages
    messages = []
    for token_doc in tokens:
        token = token_doc["token"]
        if not token.startswith("ExponentPushToken"):
            continue
            
        message = {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "channelId": channel,
        }
        if data:
            message["data"] = data
        messages.append(message)
    
    if not messages:
        return {"sent": 0, "reason": "No valid Expo push tokens"}
    
    # Send via Expo Push API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                }
            )
            result = response.json()
            logger.info(f"Push notification sent to {user_id}: {result}")
            return {"sent": len(messages), "result": result}
    except Exception as e:
        logger.error(f"Push notification failed: {e}")
        return {"sent": 0, "error": str(e)}


# Helper function to send notification and push
async def create_and_send_notification(
    user_id: str,
    notification_type: str,
    content: str,
    related_id: str = None,
    actor_id: str = None,
    send_push: bool = True
):
    """Create in-app notification and optionally send push notification"""
    notification_id = generate_notification_id()
    
    notification_data = {
        "notification_id": notification_id,
        "user_id": user_id,
        "type": notification_type,
        "content": content,
        "related_id": related_id,
        "actor_id": actor_id,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.notifications.insert_one(notification_data)
    await emit_activity_event(user_id, {
        "notification_id": notification_id,
        "type": notification_type,
        "content": content,
        "related_id": related_id,
        "actor_id": actor_id,
        "created_at": notification_data["created_at"].isoformat(),
    })
    
    # Send push notification
    if send_push:
        # Get actor name for push title
        actor_name = "Someone"
        if actor_id:
            actor = await db.users.find_one({"user_id": actor_id}, {"name": 1})
            if actor:
                actor_name = actor.get("name", "Someone")
        
        # Build push notification
        push_title = actor_name
        push_body = content
        push_channel = "social"
        
        if notification_type == "message":
            push_channel = "messages"
        elif notification_type in ("follow", "like", "comment"):
            push_channel = "social"
        
        await send_push_notification(
            user_id=user_id,
            title=push_title,
            body=push_body,
            data={"type": notification_type, "related_id": related_id},
            channel=push_channel
        )
    
    return notification_id


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


# ============ SCHEDULED POST PROCESSING ============

async def process_scheduled_posts():
    """
    Background task to publish scheduled posts when their time arrives.
    This should be called periodically (e.g., every minute via a cron job or scheduler)
    """
    now = datetime.now(timezone.utc)
    
    # Find all scheduled posts that are due
    due_posts = await db.scheduled_posts.find({
        "status": "scheduled",
        "scheduled_time": {"$lte": now}
    }).to_list(100)
    
    published_count = 0
    
    for scheduled_post in due_posts:
        try:
            # Create the actual post
            post_id = f"post_{uuid.uuid4().hex[:12]}"
            
            post_data = {
                "post_id": post_id,
                "user_id": scheduled_post["user_id"],
                "content": scheduled_post["content"],
                "media_url": scheduled_post.get("media_url"),
                "media_type": scheduled_post.get("media_type"),
                "likes_count": 0,
                "dislikes_count": 0,
                "comments_count": 0,
                "repost_count": 0,
                "tagged_users": scheduled_post.get("tagged_users", []),
                "location": scheduled_post.get("location"),
                "created_at": now,  # Use current time as creation time
            }
            
            # Handle poll if present
            if scheduled_post.get("has_poll"):
                post_data["has_poll"] = True
                post_data["poll_question"] = scheduled_post.get("poll_question")
                post_data["poll_options"] = scheduled_post.get("poll_options")
                post_data["poll_votes"] = {str(i): 0 for i in range(len(scheduled_post.get("poll_options", [])))}
                
                poll_hours = scheduled_post.get("poll_duration_hours", 24)
                post_data["poll_expires_at"] = now + timedelta(hours=poll_hours)
            
            # Insert the post
            await db.posts.insert_one(post_data)
            
            # Update scheduled post status
            await db.scheduled_posts.update_one(
                {"scheduled_post_id": scheduled_post["scheduled_post_id"]},
                {
                    "$set": {
                        "status": "published",
                        "published_post_id": post_id,
                        "published_at": now
                    }
                }
            )
            
            published_count += 1
            logger.info(f"Published scheduled post {scheduled_post['scheduled_post_id']} as {post_id}")
            
            # Send push notification to the user
            await send_push_notification(
                user_id=scheduled_post["user_id"],
                title="Post Published",
                body="Your scheduled post has been published!",
                data={"type": "scheduled_post_published", "post_id": post_id}
            )
            
        except Exception as e:
            logger.error(f"Failed to publish scheduled post {scheduled_post['scheduled_post_id']}: {e}")
            await db.scheduled_posts.update_one(
                {"scheduled_post_id": scheduled_post["scheduled_post_id"]},
                {"$set": {"status": "failed", "error": str(e)}}
            )
    
    return {"published": published_count}


@api_router.post("/admin/process-scheduled-posts")
async def trigger_scheduled_posts_processing(current_user: User = Depends(require_auth)):
    """
    Manually trigger processing of scheduled posts.
    In production, this should be called by a cron job every minute.
    """
    result = await process_scheduled_posts()
    return result


# Add to startup to process scheduled posts periodically
import asyncio

async def scheduled_posts_worker():
    """Background worker to process scheduled posts every minute"""
    while True:
        try:
            await process_scheduled_posts()
        except Exception as e:
            logger.error(f"Scheduled posts worker error: {e}")
        await asyncio.sleep(60)  # Check every minute


# Start the worker on app startup
@app.on_event("startup")
async def start_scheduled_posts_worker():
    """Start the scheduled posts background worker"""
    asyncio.create_task(scheduled_posts_worker())
    logger.info("Scheduled posts worker started")


# ============ TIPS/DONATIONS ENDPOINTS ============

# Revenue Share Configuration
# Platform takes a percentage, creator receives the rest
REVENUE_SHARE = {
    "tips": {"platform": 0.05, "creator": 0.95},           # 5% Grover, 95% Creator
    "super_chat": {"platform": 0.10, "creator": 0.90},     # 10% Grover, 90% Creator
    "subscriptions": {"platform": 0.15, "creator": 0.85}, # 15% Grover, 85% Creator
    "products": {"platform": 0.05, "creator": 0.95},       # 5% Grover, 95% Creator
    "paid_content": {"platform": 0.10, "creator": 0.90},  # 10% Grover, 90% Creator
}

async def check_monetization_enabled(user_id: str, feature_name: str = "monetization"):
    """Check if a creator has monetization enabled. Raises HTTPException if not."""
    creator = await db.users.find_one({"user_id": user_id}, {"monetization_enabled": 1})
    if not creator:
        raise HTTPException(status_code=404, detail="User not found")
    if not creator.get("monetization_enabled", False):
        raise HTTPException(
            status_code=403, 
            detail=f"This creator has not enabled {feature_name}. They must enable monetization in their settings first."
        )
    return True

def calculate_revenue_split(amount: float, revenue_type: str) -> dict:
    """Calculate the platform fee and creator payout"""
    share = REVENUE_SHARE.get(revenue_type, {"platform": 0.10, "creator": 0.90})
    platform_fee = round(amount * share["platform"], 2)
    creator_payout = round(amount * share["creator"], 2)
    
    # Ensure amounts add up correctly
    if platform_fee + creator_payout != amount:
        creator_payout = round(amount - platform_fee, 2)
    
    return {
        "gross_amount": amount,
        "platform_fee": platform_fee,
        "platform_rate": share["platform"],
        "creator_payout": creator_payout,
        "creator_rate": share["creator"],
    }


async def record_transaction(
    transaction_type: str,
    amount: float,
    from_user_id: str,
    to_user_id: str,
    related_id: str = None,
    metadata: dict = None
):
    """Record a financial transaction with revenue split"""
    split = calculate_revenue_split(amount, transaction_type)
    
    transaction = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "type": transaction_type,
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "related_id": related_id,
        "gross_amount": split["gross_amount"],
        "platform_fee": split["platform_fee"],
        "creator_payout": split["creator_payout"],
        "platform_rate": split["platform_rate"],
        "status": "completed",
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc),
    }
    
    await db.transactions.insert_one(transaction)
    
    # Update creator's earnings balance
    await db.users.update_one(
        {"user_id": to_user_id},
        {
            "$inc": {
                "earnings_balance": split["creator_payout"],
                "total_earnings": split["creator_payout"],
            }
        }
    )
    
    await emit_live_metrics(to_user_id, reason="revenue")
    await emit_activity_event(to_user_id, {
        "transaction_id": transaction["transaction_id"],
        "type": "revenue",
        "content": f"Received ${transaction['creator_payout']:.2f} ({transaction_type})",
        "amount": transaction["creator_payout"],
        "created_at": transaction["created_at"].isoformat(),
    })
    
    return transaction


@api_router.post("/users/{user_id}/tip")
async def send_tip(
    user_id: str,
    amount: float,
    message: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """Send a tip/donation to a creator (5% platform fee)"""
    if amount < 1:
        raise HTTPException(status_code=400, detail="Minimum tip is $1")
    
    # Check if recipient has monetization enabled
    await check_monetization_enabled(user_id, "tips")
    
    recipient = await db.users.find_one({"user_id": user_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate revenue split
    split = calculate_revenue_split(amount, "tips")
    
    # In production, process PayPal payment here
    tip_id = f"tip_{uuid.uuid4().hex[:12]}"
    
    await db.tips.insert_one({
        "tip_id": tip_id,
        "from_user_id": current_user.user_id,
        "to_user_id": user_id,
        "amount": amount,
        "platform_fee": split["platform_fee"],
        "creator_payout": split["creator_payout"],
        "message": message,
        "status": "completed",
        "created_at": datetime.now(timezone.utc)
    })
    
    # Record transaction
    await record_transaction(
        "tips",
        amount,
        current_user.user_id,
        user_id,
        tip_id,
        {"message": message}
    )
    
    # Notify recipient
    await create_and_send_notification(
        user_id,
        "tip",
        f"{current_user.name} sent you ${split['creator_payout']:.2f}!" + (f" '{message}'" if message else ""),
        tip_id,
        current_user.user_id
    )
    
    return {
        "tip_id": tip_id,
        "message": "Tip sent successfully",
        "amount": amount,
        "platform_fee": split["platform_fee"],
        "creator_receives": split["creator_payout"],
    }

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


# ============ CREATOR SUBSCRIPTIONS ENDPOINTS ============

class CreatorSubscriptionTier(BaseModel):
    name: str = "Supporter"
    price: float = 4.99
    description: Optional[str] = None
    benefits: List[str] = []

@api_router.post("/creators/{user_id}/subscription-tiers")
async def create_subscription_tier(
    user_id: str,
    tier: CreatorSubscriptionTier,
    current_user: User = Depends(require_auth)
):
    """Create a subscription tier for your profile"""
    if user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Can only create tiers for your own profile")
    
    # Check if creator has monetization enabled
    if not current_user.monetization_enabled:
        raise HTTPException(
            status_code=403, 
            detail="You must enable monetization in your profile settings before creating subscription tiers."
        )
    
    tier_id = f"tier_{uuid.uuid4().hex[:12]}"
    
    await db.subscription_tiers.insert_one({
        "tier_id": tier_id,
        "creator_id": user_id,
        "name": tier.name,
        "price": tier.price,
        "description": tier.description,
        "benefits": tier.benefits,
        "active": True,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"tier_id": tier_id, "message": "Subscription tier created"}


@api_router.get("/creators/{user_id}/subscription-tiers")
async def get_subscription_tiers(user_id: str, current_user: User = Depends(require_auth)):
    """Get subscription tiers for a creator"""
    tiers = await db.subscription_tiers.find(
        {"creator_id": user_id, "active": True},
        {"_id": 0}
    ).to_list(10)
    return tiers


@api_router.post("/creators/{user_id}/subscribe/{tier_id}")
async def subscribe_to_creator(
    user_id: str,
    tier_id: str,
    current_user: User = Depends(require_auth)
):
    """Subscribe to a creator (15% platform fee)"""
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot subscribe to yourself")
    
    # Check if creator has monetization enabled
    await check_monetization_enabled(user_id, "subscriptions")
    
    tier = await db.subscription_tiers.find_one({"tier_id": tier_id, "creator_id": user_id, "active": True})
    if not tier:
        raise HTTPException(status_code=404, detail="Subscription tier not found")
    
    # Check if already subscribed
    existing = await db.creator_subscriptions.find_one({
        "subscriber_id": current_user.user_id,
        "creator_id": user_id,
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already subscribed to this creator")
    
    # Calculate revenue split (15% platform, 85% creator)
    split = calculate_revenue_split(tier["price"], "subscriptions")
    
    subscription_id = f"sub_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    await db.creator_subscriptions.insert_one({
        "subscription_id": subscription_id,
        "subscriber_id": current_user.user_id,
        "creator_id": user_id,
        "tier_id": tier_id,
        "amount": tier["price"],
        "platform_fee": split["platform_fee"],
        "creator_payout": split["creator_payout"],
        "status": "active",
        "started_at": now,
        "next_billing": now + timedelta(days=30),
        "created_at": now
    })
    
    # Record transaction
    await record_transaction(
        "subscriptions",
        tier["price"],
        current_user.user_id,
        user_id,
        subscription_id,
        {"tier_id": tier_id, "tier_name": tier["name"]}
    )
    
    # Notify creator
    await create_and_send_notification(
        user_id,
        "subscription",
        f"{current_user.name} subscribed to your {tier['name']} tier! (+${split['creator_payout']:.2f})",
        subscription_id,
        current_user.user_id
    )
    
    return {
        "subscription_id": subscription_id,
        "message": f"Subscribed to {tier['name']}",
        "amount": tier["price"],
        "platform_fee": split["platform_fee"],
        "creator_receives": split["creator_payout"],
        "next_billing": (now + timedelta(days=30)).isoformat()
    }


@api_router.delete("/subscriptions/{subscription_id}")
async def cancel_subscription(subscription_id: str, current_user: User = Depends(require_auth)):
    """Cancel a subscription"""
    subscription = await db.creator_subscriptions.find_one({
        "subscription_id": subscription_id,
        "subscriber_id": current_user.user_id
    })
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    await db.creator_subscriptions.update_one(
        {"subscription_id": subscription_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Subscription cancelled"}


@api_router.get("/subscriptions/my-subscriptions")
async def get_my_subscriptions(current_user: User = Depends(require_auth)):
    """Get subscriptions I've made to creators"""
    subscriptions = await db.creator_subscriptions.find(
        {"subscriber_id": current_user.user_id, "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    for sub in subscriptions:
        creator = await db.users.find_one({"user_id": sub["creator_id"]}, {"_id": 0, "name": 1, "picture": 1})
        sub["creator"] = creator
        tier = await db.subscription_tiers.find_one({"tier_id": sub["tier_id"]}, {"_id": 0})
        sub["tier"] = tier
    
    return subscriptions


@api_router.get("/subscriptions/my-subscribers")
async def get_my_subscribers(current_user: User = Depends(require_auth)):
    """Get people subscribed to me"""
    subscriptions = await db.creator_subscriptions.find(
        {"creator_id": current_user.user_id, "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    for sub in subscriptions:
        subscriber = await db.users.find_one({"user_id": sub["subscriber_id"]}, {"_id": 0, "name": 1, "picture": 1})
        sub["subscriber"] = subscriber
        tier = await db.subscription_tiers.find_one({"tier_id": sub["tier_id"]}, {"_id": 0})
        sub["tier"] = tier
    
    return subscriptions


# ============ PAID CONTENT ENDPOINTS ============

@api_router.post("/posts/{post_id}/set-paid")
async def set_post_as_paid(
    post_id: str,
    price: float,
    preview_content: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """Set a post as paid content (10% platform fee on purchases)"""
    # Check if creator has monetization enabled
    if not current_user.monetization_enabled:
        raise HTTPException(
            status_code=403, 
            detail="You must enable monetization in your profile settings before creating paid content."
        )
    
    if price < 0.99:
        raise HTTPException(status_code=400, detail="Minimum price is $0.99")
    
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your post")
    
    await db.posts.update_one(
        {"post_id": post_id},
        {"$set": {
            "is_paid": True,
            "price": price,
            "preview_content": preview_content,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Post set as paid content", "price": price}


@api_router.post("/posts/{post_id}/purchase")
async def purchase_paid_content(post_id: str, current_user: User = Depends(require_auth)):
    """Purchase access to paid content (10% platform fee)"""
    post = await db.posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if not post.get("is_paid"):
        raise HTTPException(status_code=400, detail="This post is not paid content")
    
    if post["user_id"] == current_user.user_id:
        raise HTTPException(status_code=400, detail="You own this content")
    
    # Check if already purchased
    existing = await db.content_purchases.find_one({
        "post_id": post_id,
        "user_id": current_user.user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already purchased")
    
    # Calculate revenue split (10% platform, 90% creator)
    split = calculate_revenue_split(post["price"], "paid_content")
    
    purchase_id = f"purchase_{uuid.uuid4().hex[:12]}"
    
    await db.content_purchases.insert_one({
        "purchase_id": purchase_id,
        "post_id": post_id,
        "user_id": current_user.user_id,
        "creator_id": post["user_id"],
        "amount": post["price"],
        "platform_fee": split["platform_fee"],
        "creator_payout": split["creator_payout"],
        "created_at": datetime.now(timezone.utc)
    })
    
    # Record transaction
    await record_transaction(
        "paid_content",
        post["price"],
        current_user.user_id,
        post["user_id"],
        purchase_id,
        {"post_id": post_id}
    )
    
    # Notify creator
    await create_and_send_notification(
        post["user_id"],
        "content_purchase",
        f"{current_user.name} purchased your content! (+${split['creator_payout']:.2f})",
        post_id,
        current_user.user_id
    )
    
    return {
        "purchase_id": purchase_id,
        "message": "Content unlocked",
        "amount": post["price"],
        "platform_fee": split["platform_fee"],
        "creator_receives": split["creator_payout"],
    }


@api_router.get("/posts/{post_id}/purchased")
async def check_if_purchased(post_id: str, current_user: User = Depends(require_auth)):
    """Check if current user has purchased a post"""
    post = await db.posts.find_one({"post_id": post_id}, {"user_id": 1, "is_paid": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Creator owns all their content
    if post["user_id"] == current_user.user_id:
        return {"purchased": True, "is_owner": True}
    
    # Not paid content = everyone has access
    if not post.get("is_paid"):
        return {"purchased": True, "is_free": True}
    
    # Check purchase record
    purchase = await db.content_purchases.find_one({
        "post_id": post_id,
        "user_id": current_user.user_id
    })
    
    return {"purchased": purchase is not None}


# ============ EARNINGS/PAYOUT ENDPOINTS ============

@api_router.get("/earnings")
async def get_earnings(current_user: User = Depends(require_auth)):
    """Get creator earnings summary"""
    user = await db.users.find_one({"user_id": current_user.user_id})
    
    # Get breakdown by type
    pipeline = [
        {"$match": {"to_user_id": current_user.user_id, "status": "completed"}},
        {"$group": {
            "_id": "$type",
            "total": {"$sum": "$creator_payout"},
            "count": {"$sum": 1}
        }}
    ]
    
    breakdown = await db.transactions.aggregate(pipeline).to_list(10)
    
    earnings_by_type = {item["_id"]: {"total": item["total"], "count": item["count"]} for item in breakdown}
    
    return {
        "balance": user.get("earnings_balance", 0),
        "total_earned": user.get("total_earnings", 0),
        "breakdown": {
            "tips": earnings_by_type.get("tips", {"total": 0, "count": 0}),
            "super_chat": earnings_by_type.get("super_chat", {"total": 0, "count": 0}),
            "subscriptions": earnings_by_type.get("subscriptions", {"total": 0, "count": 0}),
            "products": earnings_by_type.get("products", {"total": 0, "count": 0}),
            "paid_content": earnings_by_type.get("paid_content", {"total": 0, "count": 0}),
        },
        "revenue_rates": REVENUE_SHARE
    }


@api_router.get("/transactions")
async def get_transactions(
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get transaction history"""
    transactions = await db.transactions.find(
        {"$or": [
            {"to_user_id": current_user.user_id},
            {"from_user_id": current_user.user_id}
        ]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return transactions


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


# ============ ENHANCED SEARCH ENDPOINTS ============

@api_router.get("/search/users")
async def search_users(
    q: str,
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Search for users by name or username"""
    users = await db.users.find(
        {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": f"^{q}", "$options": "i"}},
            {"bio": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0, "session_token": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    # Add follower counts
    for user in users:
        user["followers_count"] = await db.follows.count_documents({"following_id": user["user_id"]})
        user["is_following"] = await db.follows.count_documents({
            "follower_id": current_user.user_id,
            "following_id": user["user_id"]
        }) > 0
    
    return users


@api_router.get("/search/hashtags")
async def search_hashtags(
    q: str,
    limit: int = 20,
    current_user: User = Depends(require_auth)
):
    """Search for hashtags and get their post counts"""
    import re
    
    # Clean the query
    tag = q.lstrip('#').lower()
    
    # Aggregate to find matching hashtags and their counts
    pipeline = [
        {"$match": {"content": {"$regex": f"#{tag}", "$options": "i"}}},
        {"$project": {
            "hashtags": {
                "$regexFindAll": {
                    "input": "$content",
                    "regex": "#(\\w+)",
                    "options": "i"
                }
            }
        }},
        {"$unwind": "$hashtags"},
        {"$group": {
            "_id": {"$toLower": "$hashtags.match"},
            "count": {"$sum": 1}
        }},
        {"$match": {"_id": {"$regex": f"^#{tag}", "$options": "i"}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    results = await db.posts.aggregate(pipeline).to_list(limit)
    
    hashtags = [
        {
            "tag": result["_id"],
            "post_count": result["count"]
        }
        for result in results
    ]
    
    return hashtags


@api_router.get("/search/hashtag/{tag}/posts")
async def get_hashtag_posts(
    tag: str,
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get posts containing a specific hashtag"""
    clean_tag = tag.lstrip('#')
    
    posts = await db.posts.find(
        {"content": {"$regex": f"#{clean_tag}\\b", "$options": "i"}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user data and interaction status
    for post in posts:
        user = await db.users.find_one({"user_id": post["user_id"]}, {"_id": 0, "session_token": 0})
        post["user"] = user
        post["liked"] = await db.reactions.count_documents({
            "post_id": post["post_id"],
            "user_id": current_user.user_id,
            "reaction_type": "like"
        }) > 0
        post["saved"] = await db.saved_posts.count_documents({
            "post_id": post["post_id"],
            "user_id": current_user.user_id
        }) > 0
    
    return posts


@api_router.get("/trending/tags")
async def get_trending_tags(
    limit: int = 20,
    current_user: User = Depends(require_auth)
):
    """Get trending hashtags based on recent usage"""
    # Look at posts from the last 7 days
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$project": {
            "hashtags": {
                "$regexFindAll": {
                    "input": "$content",
                    "regex": "#(\\w+)",
                    "options": "i"
                }
            },
            "likes_count": 1
        }},
        {"$unwind": "$hashtags"},
        {"$group": {
            "_id": {"$toLower": "$hashtags.match"},
            "post_count": {"$sum": 1},
            "total_likes": {"$sum": "$likes_count"}
        }},
        {"$addFields": {
            "score": {"$add": [
                {"$multiply": ["$post_count", 2]},
                "$total_likes"
            ]}
        }},
        {"$sort": {"score": -1}},
        {"$limit": limit}
    ]
    
    results = await db.posts.aggregate(pipeline).to_list(limit)
    
    trending = [
        {
            "tag": result["_id"],
            "post_count": result["post_count"],
            "total_likes": result["total_likes"],
            "trending_score": result["score"]
        }
        for result in results
    ]
    
    return trending


@api_router.get("/trending/creators")
async def get_trending_creators(
    limit: int = 10,
    current_user: User = Depends(require_auth)
):
    """Get trending creators based on recent engagement"""
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    # Find creators with most engagement in the last week
    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {
            "_id": "$user_id",
            "post_count": {"$sum": 1},
            "total_likes": {"$sum": "$likes_count"},
            "total_comments": {"$sum": "$comments_count"}
        }},
        {"$addFields": {
            "engagement_score": {"$add": [
                {"$multiply": ["$total_likes", 1]},
                {"$multiply": ["$total_comments", 2]},
                {"$multiply": ["$post_count", 3]}
            ]}
        }},
        {"$sort": {"engagement_score": -1}},
        {"$limit": limit}
    ]
    
    results = await db.posts.aggregate(pipeline).to_list(limit)
    
    creators = []
    for result in results:
        user = await db.users.find_one({"user_id": result["_id"]}, {"_id": 0, "session_token": 0})
        if user:
            user["post_count"] = result["post_count"]
            user["total_likes"] = result["total_likes"]
            user["engagement_score"] = result["engagement_score"]
            user["followers_count"] = await db.follows.count_documents({"following_id": user["user_id"]})
            user["is_following"] = await db.follows.count_documents({
                "follower_id": current_user.user_id,
                "following_id": user["user_id"]
            }) > 0
            creators.append(user)
    
    return creators

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

@api_router.get("/stories/me")
async def get_my_stories(current_user: User = Depends(require_auth)):
    """Get current user's stories (both active and expired)"""
    stories = await db.stories.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add view counts and viewer info
    for story in stories:
        view_count = await db.story_views.count_documents({"story_id": story["story_id"]})
        story["view_count"] = view_count
        story["is_expired"] = story.get("expires_at", datetime.now(timezone.utc)) < datetime.now(timezone.utc)
    
    return {"stories": stories, "total": len(stories)}

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


@api_router.get("/stories/analytics")
async def get_story_analytics(current_user: User = Depends(require_auth)):
    """Get analytics for user's stories"""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    # Get user's recent stories (past 7 days, including expired)
    stories = await db.stories.find(
        {"user_id": current_user.user_id, "created_at": {"$gte": week_ago}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_views = 0
    total_reactions = 0
    total_stories = len(stories)
    
    story_details = []
    for story in stories:
        views = story.get("views_count", 0)
        reactions = story.get("reactions_count", 0)
        total_views += views
        total_reactions += reactions
        
        # Calculate if story is still active
        is_active = story.get("expires_at", now) > now
        time_remaining = None
        if is_active:
            remaining = story["expires_at"] - now
            hours_remaining = remaining.total_seconds() / 3600
            time_remaining = f"{hours_remaining:.1f}h"
        
        story_details.append({
            "story_id": story["story_id"],
            "views_count": views,
            "reactions_count": reactions,
            "is_active": is_active,
            "time_remaining": time_remaining,
            "created_at": story["created_at"],
            "expires_at": story.get("expires_at"),
        })
    
    # Calculate averages
    avg_views = total_views / total_stories if total_stories > 0 else 0
    avg_reactions = total_reactions / total_stories if total_stories > 0 else 0
    
    # Get top viewers (users who view your stories most)
    top_viewers_pipeline = [
        {"$match": {"story_id": {"$in": [s["story_id"] for s in stories]}}},
        {"$group": {"_id": "$user_id", "view_count": {"$sum": 1}}},
        {"$sort": {"view_count": -1}},
        {"$limit": 10}
    ]
    
    top_viewers_data = await db.story_views.aggregate(top_viewers_pipeline).to_list(10)
    
    top_viewers = []
    for viewer in top_viewers_data:
        user = await db.users.find_one(
            {"user_id": viewer["_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
        )
        if user:
            top_viewers.append({
                "user": user,
                "view_count": viewer["view_count"]
            })
    
    return {
        "total_stories": total_stories,
        "total_views": total_views,
        "total_reactions": total_reactions,
        "average_views": round(avg_views, 1),
        "average_reactions": round(avg_reactions, 1),
        "stories": story_details,
        "top_viewers": top_viewers
    }


@api_router.delete("/stories/{story_id}")
async def delete_story(story_id: str, current_user: User = Depends(require_auth)):
    """Delete a story"""
    story = await db.stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this story")
    
    # Delete associated views and reactions
    await db.story_views.delete_many({"story_id": story_id})
    await db.story_reactions.delete_many({"story_id": story_id})
    
    # Delete the story
    await db.stories.delete_one({"story_id": story_id})
    
    return {"message": "Story deleted"}

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
        "created_at": datetime.now(timezone.utc),
        "deleted_for": [],
        "deleted_for_everyone": False,
        "deleted_at": None
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
    """Send a paid super chat message (10% platform fee)"""
    if amount < 1:
        raise HTTPException(status_code=400, detail="Minimum super chat is $1")
    
    stream = await db.streams.find_one({"stream_id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    if not stream.get("enable_super_chat"):
        raise HTTPException(status_code=400, detail="Super chat not enabled")
    
    # Check if streamer has monetization enabled
    await check_monetization_enabled(stream["user_id"], "super chat")
    
    # Calculate revenue split (10% platform, 90% creator)
    split = calculate_revenue_split(amount, "super_chat")
    
    # In production, process PayPal payment here
    super_chat_id = f"superchat_{uuid.uuid4().hex[:12]}"
    
    await db.super_chats.insert_one({
        "super_chat_id": super_chat_id,
        "stream_id": stream_id,
        "user_id": current_user.user_id,
        "host_id": stream["user_id"],
        "amount": amount,
        "platform_fee": split["platform_fee"],
        "creator_payout": split["creator_payout"],
        "message": message,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Record transaction
    await record_transaction(
        "super_chat",
        amount,
        current_user.user_id,
        stream["user_id"],
        super_chat_id,
        {"stream_id": stream_id, "message": message}
    )
    
    # Notify streamer via push
    await create_and_send_notification(
        stream["user_id"],
        "super_chat",
        f"{current_user.name} sent ${split['creator_payout']:.2f}: {message}",
        super_chat_id,
        current_user.user_id
    )
    
    return {
        "message": "Super chat sent",
        "super_chat_id": super_chat_id,
        "amount": amount,
        "platform_fee": split["platform_fee"],
        "creator_receives": split["creator_payout"],
    }

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
    reminder_minutes: int = Form(30),
    current_user: User = Depends(require_auth)
):
    """
    Schedule a future live stream with enhanced date validation.
    
    - scheduled_time: ISO 8601 format (e.g., "2024-01-15T14:00:00Z")
    - reminder_minutes: Send reminder notification X minutes before (default 30)
    - Must be at least 15 minutes in the future
    - Cannot be more than 30 days in the future
    """
    # Parse scheduled time
    try:
        # Handle various datetime formats
        scheduled_time_clean = scheduled_time.replace('Z', '+00:00')
        if '+' not in scheduled_time_clean and '-' not in scheduled_time_clean[-6:]:
            scheduled_time_clean += '+00:00'
        scheduled_dt = datetime.fromisoformat(scheduled_time_clean)
        
        # Ensure timezone aware
        if scheduled_dt.tzinfo is None:
            scheduled_dt = scheduled_dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid datetime format. Use ISO 8601 format (e.g., 2024-01-15T14:00:00Z). Error: {str(e)}"
        )
    
    now = datetime.now(timezone.utc)
    min_schedule_time = now + timedelta(minutes=15)
    max_schedule_time = now + timedelta(days=30)
    
    if scheduled_dt <= min_schedule_time:
        raise HTTPException(
            status_code=400, 
            detail="Scheduled time must be at least 15 minutes in the future"
        )
    
    if scheduled_dt > max_schedule_time:
        raise HTTPException(
            status_code=400, 
            detail="Scheduled time cannot be more than 30 days in the future"
        )
    
    # Validate reminder_minutes
    if reminder_minutes < 5 or reminder_minutes > 1440:  # 5 minutes to 24 hours
        raise HTTPException(
            status_code=400,
            detail="Reminder must be between 5 minutes and 24 hours (1440 minutes)"
        )
    
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
        "reminder_minutes": reminder_minutes,
        "reminder_sent": False,
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
        "reminder_time": (scheduled_dt - timedelta(minutes=reminder_minutes)).isoformat(),
        "message": "Stream scheduled successfully"
    }

@api_router.get("/streams/scheduled")
async def get_scheduled_streams(
    limit: int = 20,
    skip: int = 0,
    user_id: Optional[str] = None,
    current_user: User = Depends(require_auth)
):
    """Get upcoming scheduled streams"""
    query = {
        "status": "scheduled",
        "scheduled_time": {"$gt": datetime.now(timezone.utc)}
    }
    
    if user_id:
        query["user_id"] = user_id
    
    streams = await db.scheduled_streams.find(
        query,
        {"_id": 0}
    ).sort("scheduled_time", 1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user data
    user_ids = list(set(s["user_id"] for s in streams))
    users_map = await batch_fetch_users(db, user_ids)
    
    for stream in streams:
        stream["user"] = users_map.get(stream["user_id"])
    
    return {"streams": streams, "total": len(streams)}

@api_router.delete("/streams/scheduled/{stream_id}")
async def cancel_scheduled_stream(stream_id: str, current_user: User = Depends(require_auth)):
    """Cancel a scheduled stream"""
    stream = await db.scheduled_streams.find_one({"stream_id": stream_id})
    
    if not stream:
        raise HTTPException(status_code=404, detail="Scheduled stream not found")
    
    if stream["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if stream["status"] != "scheduled":
        raise HTTPException(status_code=400, detail="Stream is not in scheduled status")
    
    await db.scheduled_streams.update_one(
        {"stream_id": stream_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Scheduled stream cancelled"}

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
active_users_lock = asyncio.Lock()
active_sids = {}
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
    async with active_users_lock:
        user_id_to_remove = active_sids.pop(sid, None)
        if user_id_to_remove and active_users.get(user_id_to_remove) == sid:
            del active_users[user_id_to_remove]

@sio.event
async def register_user(sid, data):
    """Register a user room for live metrics and activity updates."""
    user_id = data.get("user_id")
    if user_id:
        try:
            validate_id(user_id, "user_id")
        except HTTPException:
            return
        user = await db.users.find_one({"user_id": user_id}, {"_id": 1})
        if not user:
            return
        async with active_users_lock:
            old_sid = active_users.get(user_id)
            if old_sid and old_sid != sid:
                active_sids.pop(old_sid, None)
            active_users[user_id] = sid
            active_sids[sid] = user_id
            sio.enter_room(sid, f"user_{user_id}")
        await emit_live_metrics(user_id, reason="connection")

@sio.event
async def join_conversation(sid, data):
    conversation_id = data.get("conversation_id")
    user_id = data.get("user_id")
    
    if conversation_id and user_id:
        try:
            validate_id(user_id, "user_id")
        except HTTPException:
            return
        user = await db.users.find_one({"user_id": user_id}, {"_id": 1})
        if not user:
            return
        async with active_users_lock:
            old_sid = active_users.get(user_id)
            if old_sid and old_sid != sid:
                active_sids.pop(old_sid, None)
            active_users[user_id] = sid
            active_sids[sid] = user_id
            sio.enter_room(sid, f"conversation_{conversation_id}")
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
        "created_at": datetime.now(timezone.utc),
        "deleted_for": [],
        "deleted_for_everyone": False,
        "deleted_at": None
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
        "created_at": datetime.now(timezone.utc).isoformat(),
        "deleted_for_everyone": False,
        "is_deleted": False
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

# Manual metrics endpoint (Prometheus)
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

@api_router.get("/metrics", include_in_schema=True, tags=["Monitoring"])
async def metrics_endpoint():
    """Prometheus metrics endpoint for monitoring."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Include router
app.include_router(api_router)

# Wrap with Socket.IO
app_with_socketio = socketio.ASGIApp(sio, app)

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_cache()
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app_with_socketio, host="0.0.0.0", port=8001)
