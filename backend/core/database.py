"""
Database connection and initialization.
Provides MongoDB client and database instances.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

from .config import settings

logger = logging.getLogger(__name__)


class Database:
    """MongoDB database manager."""
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
    
    async def connect(self):
        """Connect to MongoDB."""
        try:
            self.client = AsyncIOMotorClient(settings.MONGO_URL)
            self.db = self.client[settings.DB_NAME]
            logger.info(f"Connected to MongoDB database: {settings.DB_NAME}")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from MongoDB."""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")
    
    async def create_indexes(self):
        """Create database indexes for optimal performance."""
        if not self.db:
            raise RuntimeError("Database not connected")
        
        # User indexes
        await self.db.users.create_index("user_id", unique=True)
        await self.db.users.create_index("email", unique=True)
        await self.db.users.create_index("name")
        await self.db.users.create_index("followers")
        await self.db.users.create_index("premium")
        
        # Session indexes
        await self.db.user_sessions.create_index("session_id", unique=True)
        await self.db.user_sessions.create_index("user_id")
        await self.db.user_sessions.create_index("expires_at")
        
        # Post indexes
        await self.db.posts.create_index("post_id", unique=True)
        await self.db.posts.create_index("user_id")
        await self.db.posts.create_index("created_at")
        await self.db.posts.create_index("likes")
        await self.db.posts.create_index([("created_at", -1)])
        await self.db.posts.create_index([("likes", -1)])
        await self.db.posts.create_index("hashtags")
        await self.db.posts.create_index("mentions")
        await self.db.posts.create_index("location")
        await self.db.posts.create_index("is_paid")
        
        # Comment indexes
        await self.db.comments.create_index("comment_id", unique=True)
        await self.db.comments.create_index("post_id")
        await self.db.comments.create_index("user_id")
        await self.db.comments.create_index("parent_comment_id")
        await self.db.comments.create_index("created_at")
        
        # Follow indexes
        await self.db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
        await self.db.follows.create_index("follower_id")
        await self.db.follows.create_index("following_id")
        
        # Notification indexes
        await self.db.notifications.create_index("user_id")
        await self.db.notifications.create_index("read")
        await self.db.notifications.create_index([("created_at", -1)])
        
        # Product indexes
        await self.db.products.create_index("product_id", unique=True)
        await self.db.products.create_index("seller_id")
        await self.db.products.create_index("created_at")
        
        # Order indexes
        await self.db.orders.create_index("order_id", unique=True)
        await self.db.orders.create_index("buyer_id")
        await self.db.orders.create_index("seller_id")
        
        # Message indexes
        await self.db.messages.create_index("message_id", unique=True)
        await self.db.messages.create_index("sender_id")
        await self.db.messages.create_index("recipient_id")
        await self.db.messages.create_index("created_at")
        
        # Collection indexes
        await self.db.collections.create_index("collection_id", unique=True)
        await self.db.collections.create_index("user_id")
        await self.db.collections.create_index("is_public")
        
        # Story indexes
        await self.db.stories.create_index("story_id", unique=True)
        await self.db.stories.create_index("user_id")
        await self.db.stories.create_index("expires_at")
        
        logger.info("Database indexes created successfully")


# Global database instance
database = Database()


def get_database() -> AsyncIOMotorDatabase:
    """
    Dependency to get database instance.
    Used with FastAPI's Depends.
    """
    if not database.db:
        raise RuntimeError("Database not connected")
    return database.db
