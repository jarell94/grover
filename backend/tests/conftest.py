"""
Test Configuration and Fixtures

This module provides pytest fixtures and configuration for testing the application.
"""
import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os

# Test database settings
TEST_DB_NAME = os.getenv("TEST_DB_NAME", "test_grover_db")
TEST_MONGO_URL = os.getenv("TEST_MONGO_URL", "mongodb://localhost:27017")


@pytest_asyncio.fixture
async def test_db():
    """
    Provide a test database instance.
    Creates a fresh database for each test and cleans up after.
    """
    client = AsyncIOMotorClient(TEST_MONGO_URL)
    db = client[TEST_DB_NAME]
    
    # Clear all collections before test
    collections = await db.list_collection_names()
    for collection in collections:
        await db[collection].delete_many({})
    
    yield db
    
    # Cleanup: Drop test database after test
    await client.drop_database(TEST_DB_NAME)
    client.close()


@pytest_asyncio.fixture
async def test_user(test_db):
    """Create a test user in the database"""
    user_data = {
        "user_id": "test_user_123",
        "email": "test@example.com",
        "name": "Test User",
        "picture": None,
        "bio": "Test bio",
        "is_premium": False,
        "is_private": False,
        "notify_followers": True,
        "notify_likes": True,
        "notify_comments": True,
        "notify_messages": True,
        "notify_sales": True,
        "notify_mentions": True,
        "notify_reposts": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    await test_db.users.insert_one(user_data)
    return user_data


@pytest_asyncio.fixture
async def test_post(test_db, test_user):
    """Create a test post in the database"""
    post_data = {
        "post_id": "test_post_123",
        "user_id": test_user["user_id"],
        "content": "Test post content",
        "media_url": None,
        "media_type": None,
        "likes_count": 0,
        "dislikes_count": 0,
        "shares_count": 0,
        "comments_count": 0,
        "repost_count": 0,
        "reaction_counts": {},
        "tagged_users": [],
        "created_at": datetime.now(timezone.utc)
    }
    
    await test_db.posts.insert_one(post_data)
    return post_data


@pytest_asyncio.fixture
async def test_session(test_db, test_user):
    """Create a test session for authentication"""
    from datetime import timedelta
    
    session_data = {
        "session_token": "test_session_token_123",
        "user_id": test_user["user_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    
    await test_db.user_sessions.insert_one(session_data)
    return session_data
