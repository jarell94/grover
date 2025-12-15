#!/usr/bin/env python3

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import uuid
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

async def setup_test_data():
    """Setup test data for reactions testing"""
    
    # MongoDB connection
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Create test user
    test_user = {
        "user_id": "test_user_123",
        "email": "test@example.com",
        "name": "Test User",
        "picture": None,
        "bio": "Test user for reactions",
        "is_premium": False,
        "is_private": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Insert or update test user
    await db.users.update_one(
        {"user_id": test_user["user_id"]},
        {"$set": test_user},
        upsert=True
    )
    
    # Create test session
    test_session = {
        "user_id": "test_user_123",
        "session_token": "test_token_123",
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.user_sessions.update_one(
        {"session_token": test_session["session_token"]},
        {"$set": test_session},
        upsert=True
    )
    
    # Create test post
    test_post = {
        "post_id": "test_post_123",
        "user_id": "test_user_123",
        "content": "This is a test post for reactions! 🎉",
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
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.posts.update_one(
        {"post_id": test_post["post_id"]},
        {"$set": test_post},
        upsert=True
    )
    
    print("✅ Test data setup complete!")
    print(f"Test user: {test_user['user_id']}")
    print(f"Test session token: {test_session['session_token']}")
    print(f"Test post: {test_post['post_id']}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_test_data())