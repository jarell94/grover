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
    await db.posts.create_index([("user_id", 1), ("created_at", -1)], name="posts_user_created_at_desc")
    # repost/thread lookups (optional but usually helpful)
    await db.posts.create_index([("original_post_id", 1)], name="posts_original_post_id")

    # USERS
    print("👥 users...")
    await db.users.create_index([("email", 1)], unique=True, name="users_email_unique")
    await db.users.create_index([("created_at", -1)], name="users_created_at_desc")

    # FOLLOWS
    print("🔗 follows...")
    await db.follows.create_index(
        [("follower_id", 1), ("following_id", 1)],
        unique=True,
        name="follows_unique_pair",
    )
    await db.follows.create_index([("follower_id", 1)], name="follows_follower_id")
    await db.follows.create_index([("following_id", 1)], name="follows_following_id")

    # REACTIONS
    print("❤️ reactions...")
    await db.reactions.create_index(
        [("post_id", 1), ("user_id", 1)],
        unique=True,
        name="reactions_unique_post_user",
    )
    await db.reactions.create_index([("post_id", 1)], name="reactions_post_id")
    # optional if you list a user's recent reactions
    await db.reactions.create_index([("user_id", 1), ("created_at", -1)], name="reactions_user_created_at_desc")

    # COMMENTS
    print("💬 comments...")
    await db.comments.create_index([("post_id", 1), ("created_at", -1)], name="comments_post_created_at_desc")
    await db.comments.create_index([("parent_comment_id", 1), ("created_at", -1)], name="comments_parent_created_at_desc")

    # MESSAGES (typical "latest first")
    print("💌 messages...")
    await db.messages.create_index([("conversation_id", 1), ("created_at", -1)], name="messages_conv_created_at_desc")
    await db.messages.create_index([("receiver_id", 1), ("read", 1)], name="messages_receiver_read")

    # CONVERSATIONS
    print("🗨️ conversations...")
    await db.conversations.create_index([("participants", 1)], name="conversations_participants")
    await db.conversations.create_index([("last_message_at", -1)], name="conversations_last_message_at_desc")

    # NOTIFICATIONS
    print("🔔 notifications...")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)], name="notifications_user_created_at_desc")
    await db.notifications.create_index([("user_id", 1), ("read", 1), ("created_at", -1)], name="notifications_user_read_created_at")

    # PRODUCTS
    print("🛍️ products...")
    await db.products.create_index([("user_id", 1), ("created_at", -1)], name="products_user_created_at_desc")
    await db.products.create_index([("created_at", -1)], name="products_created_at_desc")

    # ORDERS
    print("📦 orders...")
    await db.orders.create_index([("buyer_id", 1), ("created_at", -1)], name="orders_buyer_created_at_desc")
    await db.orders.create_index([("seller_id", 1), ("created_at", -1)], name="orders_seller_created_at_desc")
    await db.orders.create_index([("status", 1), ("created_at", -1)], name="orders_status_created_at_desc")

    # TTL CLEANUP
    print("⏳ TTL indexes (stories, user_sessions)...")
    await db.stories.create_index([("expires_at", 1)], expireAfterSeconds=0, name="stories_expires_ttl")
    await db.user_sessions.create_index([("expires_at", 1)], expireAfterSeconds=0, name="sessions_expires_ttl")

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
