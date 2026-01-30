"""
Pytest configuration and fixtures for testing.
"""
import pytest
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os

# Set test environment
os.environ['ENVIRONMENT'] = 'test'
os.environ['MONGO_URL'] = os.getenv('TEST_MONGO_URL', 'mongodb://localhost:27017')
os.environ['DB_NAME'] = os.getenv('TEST_DB_NAME', 'grover_test')


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_db_client():
    """Create a test database client."""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    yield client
    client.close()


@pytest.fixture(scope="function")
async def test_db(test_db_client):
    """
    Provide a clean test database for each test.
    Database is cleared after each test.
    """
    db_name = os.environ['DB_NAME']
    db = test_db_client[db_name]
    
    # Provide the database
    yield db
    
    # Cleanup: drop all collections after test
    for collection_name in await db.list_collection_names():
        await db[collection_name].drop()


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
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
        "created_at": datetime.now()
    }


@pytest.fixture
def sample_post_data():
    """Sample post data for testing."""
    return {
        "post_id": "test_post_123",
        "user_id": "test_user_123",
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
        "location": None,
        "is_repost": False,
        "has_poll": False,
        "created_at": datetime.now()
    }


@pytest.fixture
async def sample_user(test_db, sample_user_data):
    """Create a sample user in the test database."""
    await test_db.users.insert_one(sample_user_data)
    return sample_user_data


@pytest.fixture
async def sample_post(test_db, sample_post_data):
    """Create a sample post in the test database."""
    await test_db.posts.insert_one(sample_post_data)
    return sample_post_data
