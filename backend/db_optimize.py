#!/usr/bin/env python3
"""
Database optimization script for Grover app
Creates practical indexes + TTL cleanup (safe defaults)
"""

import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


async def safe_create_index(collection, keys, **kwargs):
    """Create index safely, ignoring if it already exists"""
    try:
        await collection.create_index(keys, **kwargs)
    except Exception as e:
        if "IndexOptionsConflict" in str(e) or "already exists" in str(e):
            print(f"  ⚠️ Index already exists (skipped): {kwargs.get('name', keys)}")
        else:
            raise


async def ensure_indexes(db):
    print("🚀 Starting database optimization...")

    # POSTS
    print("📝 posts...")
    await safe_create_index(db.posts, [("created_at", -1)], name="posts_created_at_desc")
    await safe_create_index(db.posts, [("user_id", 1), ("created_at", -1)], name="posts_user_created_at_desc")
    # repost/thread lookups (optional but usually helpful)
    await safe_create_index(db.posts, [("original_post_id", 1)], name="posts_original_post_id")

    # USERS
    print("👥 users...")
    await safe_create_index(db.users, [("email", 1)], unique=True, name="users_email_unique")
    await safe_create_index(db.users, [("created_at", -1)], name="users_created_at_desc")

    # FOLLOWS
    print("🔗 follows...")
    await safe_create_index(db.follows, [("follower_id", 1), ("following_id", 1)], unique=True, name="follows_unique_pair")
    await safe_create_index(db.follows, [("follower_id", 1)], name="follows_follower_id")
    await safe_create_index(db.follows, [("following_id", 1)], name="follows_following_id")

    # REACTIONS
    print("❤️ reactions...")
    await safe_create_index(db.reactions, [("post_id", 1), ("user_id", 1)], unique=True, name="reactions_unique_post_user")
    await safe_create_index(db.reactions, [("post_id", 1)], name="reactions_post_id")
    # optional if you list a user's recent reactions
    await safe_create_index(db.reactions, [("user_id", 1), ("created_at", -1)], name="reactions_user_created_at_desc")

    # COMMENTS
    print("💬 comments...")
    await safe_create_index(db.comments, [("post_id", 1), ("created_at", -1)], name="comments_post_created_at_desc")
    await safe_create_index(db.comments, [("parent_comment_id", 1), ("created_at", -1)], name="comments_parent_created_at_desc")

    # MESSAGES (typical "latest first")
    print("💌 messages...")
    await safe_create_index(db.messages, [("conversation_id", 1), ("created_at", -1)], name="messages_conv_created_at_desc")
    await safe_create_index(db.messages, [("receiver_id", 1), ("read", 1)], name="messages_receiver_read")

    # CONVERSATIONS
    print("🗨️ conversations...")
    await safe_create_index(db.conversations, [("participants", 1)], name="conversations_participants")
    await safe_create_index(db.conversations, [("last_message_at", -1)], name="conversations_last_message_at_desc")

    # NOTIFICATIONS
    print("🔔 notifications...")
    await safe_create_index(db.notifications, [("user_id", 1), ("created_at", -1)], name="notifications_user_created_at_desc")
    await safe_create_index(db.notifications, [("user_id", 1), ("read", 1), ("created_at", -1)], name="notifications_user_read_created_at")

    # PRODUCTS
    print("🛍️ products...")
    await safe_create_index(db.products, [("user_id", 1), ("created_at", -1)], name="products_user_created_at_desc")
    await safe_create_index(db.products, [("created_at", -1)], name="products_created_at_desc")

    # ORDERS
    print("📦 orders...")
    await safe_create_index(db.orders, [("buyer_id", 1), ("created_at", -1)], name="orders_buyer_created_at_desc")
    await safe_create_index(db.orders, [("seller_id", 1), ("created_at", -1)], name="orders_seller_created_at_desc")
    await safe_create_index(db.orders, [("status", 1), ("created_at", -1)], name="orders_status_created_at_desc")

    # TTL CLEANUP
    print("⏳ TTL indexes (stories, user_sessions)...")
    await safe_create_index(db.stories, [("expires_at", 1)], expireAfterSeconds=0, name="stories_expires_ttl")
    await safe_create_index(db.user_sessions, [("expires_at", 1)], expireAfterSeconds=0, name="sessions_expires_ttl")

    print("✅ Database optimization complete!")


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    try:
        await ensure_indexes(db)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
