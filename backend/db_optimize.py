#!/usr/bin/env python3
"""
Database optimization script for Grover app
Adds indexes for better query performance
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def optimize_database():
    """Add database indexes for optimal performance"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🚀 Starting database optimization...")
    
    # Posts collection indexes
    print("📝 Optimizing posts collection...")
    await db.posts.create_index([("created_at", -1)])  # For chronological sorting
    await db.posts.create_index([("user_id", 1), ("created_at", -1)])  # For user posts
    await db.posts.create_index([("user_id", 1)])  # For user lookup
    await db.posts.create_index([("post_id", 1)], unique=True)  # Unique post lookup
    await db.posts.create_index([("is_repost", 1), ("original_post_id", 1)])  # For reposts
    await db.posts.create_index([("tagged_users", 1)])  # For tagged user queries
    
    # Users collection indexes
    print("👥 Optimizing users collection...")
    await db.users.create_index([("user_id", 1)], unique=True)
    await db.users.create_index([("email", 1)], unique=True)
    await db.users.create_index([("created_at", -1)])
    
    # Follows collection indexes
    print("🔗 Optimizing follows collection...")
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
    await db.follows.create_index([("follower_id", 1)])  # For getting followed users
    await db.follows.create_index([("following_id", 1)])  # For getting followers
    await db.follows.create_index([("created_at", -1)])
    
    # Reactions collection indexes
    print("❤️ Optimizing reactions collection...")
    await db.reactions.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    await db.reactions.create_index([("post_id", 1)])
    await db.reactions.create_index([("user_id", 1)])
    await db.reactions.create_index([("reaction_type", 1)])
    await db.reactions.create_index([("created_at", -1)])
    
    # Comments collection indexes
    print("💬 Optimizing comments collection...")
    await db.comments.create_index([("post_id", 1), ("created_at", -1)])
    await db.comments.create_index([("comment_id", 1)], unique=True)
    await db.comments.create_index([("user_id", 1)])
    await db.comments.create_index([("parent_comment_id", 1)])
    await db.comments.create_index([("created_at", -1)])
    
    # Messages collection indexes
    print("💌 Optimizing messages collection...")
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.messages.create_index([("sender_id", 1)])
    await db.messages.create_index([("receiver_id", 1)])
    await db.messages.create_index([("read", 1)])
    await db.messages.create_index([("created_at", -1)])
    
    # Conversations collection indexes
    print("🗨️ Optimizing conversations collection...")
    await db.conversations.create_index([("participants", 1)])
    await db.conversations.create_index([("conversation_id", 1)], unique=True)
    await db.conversations.create_index([("last_message_at", -1)])
    
    # Notifications collection indexes
    print("🔔 Optimizing notifications collection...")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.notifications.create_index([("notification_id", 1)], unique=True)
    await db.notifications.create_index([("created_at", -1)])
    
    # Products collection indexes
    print("🛍️ Optimizing products collection...")
    await db.products.create_index([("product_id", 1)], unique=True)
    await db.products.create_index([("user_id", 1)])
    await db.products.create_index([("created_at", -1)])
    await db.products.create_index([("price", 1)])
    
    # Orders collection indexes
    print("📦 Optimizing orders collection...")
    await db.orders.create_index([("order_id", 1)], unique=True)
    await db.orders.create_index([("buyer_id", 1), ("created_at", -1)])
    await db.orders.create_index([("seller_id", 1), ("created_at", -1)])
    await db.orders.create_index([("status", 1)])
    await db.orders.create_index([("created_at", -1)])
    
    # Stories collection indexes
    print("📸 Optimizing stories collection...")
    await db.stories.create_index([("story_id", 1)], unique=True)
    await db.stories.create_index([("user_id", 1), ("created_at", -1)])
    await db.stories.create_index([("expires_at", 1)])  # For cleanup
    await db.stories.create_index([("is_highlighted", 1)])
    
    # User sessions collection indexes
    print("🔐 Optimizing user sessions collection...")
    await db.user_sessions.create_index([("session_token", 1)], unique=True)
    await db.user_sessions.create_index([("user_id", 1)])
    await db.user_sessions.create_index([("expires_at", 1)])  # For cleanup
    
    # Saved posts collection indexes
    print("💾 Optimizing saved posts collection...")
    await db.saved_posts.create_index([("user_id", 1), ("post_id", 1)], unique=True)
    await db.saved_posts.create_index([("user_id", 1), ("created_at", -1)])
    
    # Comment likes collection indexes
    print("👍 Optimizing comment likes collection...")
    await db.comment_likes.create_index([("comment_id", 1), ("user_id", 1)], unique=True)
    await db.comment_likes.create_index([("comment_id", 1)])
    await db.comment_likes.create_index([("user_id", 1)])
    
    # Dislikes collection indexes (legacy)
    print("👎 Optimizing dislikes collection...")
    await db.dislikes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    await db.dislikes.create_index([("post_id", 1)])
    await db.dislikes.create_index([("user_id", 1)])
    
    # Likes collection indexes (legacy)
    print("❤️ Optimizing likes collection...")
    await db.likes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    await db.likes.create_index([("post_id", 1)])
    await db.likes.create_index([("user_id", 1)])
    
    # Groups collection indexes
    print("👥 Optimizing groups collection...")
    await db.groups.create_index([("group_id", 1)], unique=True)
    await db.groups.create_index([("creator_id", 1)])
    await db.groups.create_index([("member_ids", 1)])
    await db.groups.create_index([("created_at", -1)])
    
    # Group messages collection indexes
    print("💬 Optimizing group messages collection...")
    await db.group_messages.create_index([("group_id", 1), ("created_at", -1)])
    await db.group_messages.create_index([("message_id", 1)], unique=True)
    await db.group_messages.create_index([("sender_id", 1)])
    
    # Communities collection indexes
    print("🏘️ Optimizing communities collection...")
    await db.communities.create_index([("community_id", 1)], unique=True)
    await db.communities.create_index([("creator_id", 1)])
    await db.communities.create_index([("member_ids", 1)])
    await db.communities.create_index([("category", 1)])
    await db.communities.create_index([("is_private", 1)])
    await db.communities.create_index([("created_at", -1)])
    
    print("✅ Database optimization complete!")
    print("🎯 All indexes created for optimal query performance")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(optimize_database())