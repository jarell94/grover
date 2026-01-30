"""
Main Application Entry Point - Refactored with modular architecture

This file now serves as a minimal entry point that wires together
the modular components:
- Core infrastructure (config, database, sentry)
- Routers (auth, users, posts, notifications)
- Services (business logic)
- Repositories (data access)
"""
from fastapi import FastAPI, APIRouter
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.cors import CORSMiddleware
import logging

# Core infrastructure
from core.config import APP_TITLE, APP_DESCRIPTION, APP_VERSION, CORS_ORIGINS
from core.sentry import init_sentry
from core.database import db

# Routers
from routers import health, auth, users, posts, notifications

# Initialize Sentry for error tracking
init_sentry()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version=APP_VERSION
)

# Add GZip compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS - configurable via environment
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


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
    await safe_create_index(db.user_sessions, "session_token", unique=True, background=True, name="sessions_token_unique")
    await safe_create_index(db.user_sessions, "user_id", background=True, name="sessions_user")
    await safe_create_index(db.user_sessions, "expires_at", expireAfterSeconds=0, background=True, name="sessions_ttl")
    
    logger.info(f"Database indexes: {indexes_created} created, {indexes_skipped} already exist")


@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    await create_indexes()
    logger.info("Application startup complete")


# ============ REGISTER ROUTERS ============

# Create API router with prefix
api_router = APIRouter(prefix="/api")

# Include modular routers
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(posts.router)
api_router.include_router(notifications.router)

# Include API router in app
app.include_router(api_router)

logger.info("Application configured with modular routers")


# For backwards compatibility with old imports
# Import from the old server for anything not yet refactored
# Note: This allows gradual migration of remaining endpoints
try:
    from server_old import (
        sio, 
        get_media_service_status,
        create_payment,
        execute_payment,
        send_payout
    )
    # Mount Socket.IO app
    import socketio
    sio_app = socketio.ASGIApp(sio, app)
    logger.info("Socket.IO handlers loaded from legacy server")
except ImportError as e:
    logger.warning(f"Could not import legacy components: {e}")
    sio_app = app
