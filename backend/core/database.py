"""
Database Module - MongoDB client initialization and database access
"""
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from typing import Optional

from core.config import MONGO_URL, DB_NAME

logger = logging.getLogger(__name__)

# MongoDB client singleton
_client: Optional[AsyncIOMotorClient] = None
_db = None


def get_database():
    """Get the database instance"""
    global _client, _db
    
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URL)
        _db = _client[DB_NAME]
        logger.info(f"MongoDB client initialized for database: {DB_NAME}")
    
    return _db


# For backwards compatibility and convenience
db = get_database()


async def close_database():
    """Close the database connection"""
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB client closed")
