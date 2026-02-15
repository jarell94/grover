from __future__ import annotations

"""
Redis Caching Service for Grover Backend

Provides caching for:
- User profiles
- Post data
- Following lists
- Frequently accessed data

Cache invalidation strategies:
- TTL-based expiration
- Event-based invalidation (on updates)
"""

import os
import json
import logging
from typing import Optional, Any, List, Dict
from datetime import timedelta
import asyncio

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

logger = logging.getLogger(__name__)

# Cache TTLs
CACHE_TTL = {
    "user_profile": 300,          # 5 minutes
    "user_followers": 60,         # 1 minute
    "user_following": 60,         # 1 minute
    "post": 120,                  # 2 minutes
    "trending_tags": 300,         # 5 minutes
    "feed": 30,                   # 30 seconds
    "explore": 60,                # 1 minute
    "notifications_count": 30,    # 30 seconds
    "conversation_list": 30,      # 30 seconds
}

class CacheService:
    """
    Async Redis cache service with connection pooling and automatic reconnection.
    Falls back to no-op if Redis is unavailable.
    """
    
    def __init__(self):
        self.redis: Optional["redis.Redis"] = None
        self.connected = False
        self.connection_lock = asyncio.Lock()
        
    async def connect(self):
        """Connect to Redis with automatic reconnection."""
        if not REDIS_AVAILABLE:
            logger.warning("Redis library not available - caching disabled")
            return False
            
        async with self.connection_lock:
            if self.connected:
                return True
                
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            
            try:
                self.redis = redis.from_url(
                    redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_timeout=5,
                    socket_connect_timeout=5,
                    retry_on_timeout=True,
                )
                # Test connection
                await self.redis.ping()
                self.connected = True
                logger.info(f"Connected to Redis at {redis_url}")
                return True
            except Exception as e:
                logger.warning(f"Failed to connect to Redis: {e} - caching disabled")
                self.redis = None
                self.connected = False
                return False
    
    async def disconnect(self):
        """Disconnect from Redis."""
        if self.redis:
            await self.redis.close()
            self.connected = False
            logger.info("Disconnected from Redis")
    
    async def get(self, key: str) -> Optional[Any]:
        """Get a value from cache."""
        if not self.connected or not self.redis:
            return None
            
        try:
            value = await self.redis.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.debug(f"Cache get error for {key}: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set a value in cache with TTL."""
        if not self.connected or not self.redis:
            return False
            
        try:
            await self.redis.set(key, json.dumps(value, default=str), ex=ttl)
            return True
        except Exception as e:
            logger.debug(f"Cache set error for {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        if not self.connected or not self.redis:
            return False
            
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.debug(f"Cache delete error for {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern."""
        if not self.connected or not self.redis:
            return 0
            
        try:
            count = 0
            async for key in self.redis.scan_iter(match=pattern):
                await self.redis.delete(key)
                count += 1
            return count
        except Exception as e:
            logger.debug(f"Cache delete pattern error for {pattern}: {e}")
            return 0
    
    async def mget(self, keys: List[str]) -> Dict[str, Any]:
        """Get multiple values from cache."""
        if not self.connected or not self.redis or not keys:
            return {}
            
        try:
            values = await self.redis.mget(keys)
            result = {}
            for key, value in zip(keys, values):
                if value:
                    result[key] = json.loads(value)
            return result
        except Exception as e:
            logger.debug(f"Cache mget error: {e}")
            return {}
    
    async def mset(self, items: Dict[str, Any], ttl: int = 300) -> bool:
        """Set multiple values in cache with TTL."""
        if not self.connected or not self.redis or not items:
            return False
            
        try:
            pipe = self.redis.pipeline()
            for key, value in items.items():
                pipe.set(key, json.dumps(value, default=str), ex=ttl)
            await pipe.execute()
            return True
        except Exception as e:
            logger.debug(f"Cache mset error: {e}")
            return False
    
    # ============ HIGH-LEVEL CACHING METHODS ============
    
    def _user_key(self, user_id: str) -> str:
        return f"user:{user_id}"
    
    def _post_key(self, post_id: str) -> str:
        return f"post:{post_id}"
    
    def _following_key(self, user_id: str) -> str:
        return f"following:{user_id}"
    
    def _followers_key(self, user_id: str) -> str:
        return f"followers:{user_id}"
    
    async def get_user(self, user_id: str) -> Optional[dict]:
        """Get cached user profile."""
        return await self.get(self._user_key(user_id))
    
    async def set_user(self, user_id: str, user_data: dict) -> bool:
        """Cache user profile."""
        return await self.set(
            self._user_key(user_id), 
            user_data, 
            CACHE_TTL["user_profile"]
        )
    
    async def invalidate_user(self, user_id: str) -> bool:
        """Invalidate user cache on profile update."""
        return await self.delete(self._user_key(user_id))
    
    async def get_users_batch(self, user_ids: List[str]) -> Dict[str, dict]:
        """Get multiple users from cache."""
        if not user_ids:
            return {}
        keys = [self._user_key(uid) for uid in user_ids]
        cached = await self.mget(keys)
        return {
            uid: cached.get(self._user_key(uid))
            for uid in user_ids
            if self._user_key(uid) in cached
        }
    
    async def set_users_batch(self, users: Dict[str, dict]) -> bool:
        """Cache multiple users."""
        if not users:
            return False
        items = {self._user_key(uid): data for uid, data in users.items()}
        return await self.mset(items, CACHE_TTL["user_profile"])
    
    async def get_following_ids(self, user_id: str) -> Optional[List[str]]:
        """Get cached following list."""
        return await self.get(self._following_key(user_id))
    
    async def set_following_ids(self, user_id: str, following_ids: List[str]) -> bool:
        """Cache following list."""
        return await self.set(
            self._following_key(user_id),
            following_ids,
            CACHE_TTL["user_following"]
        )
    
    async def invalidate_following(self, user_id: str) -> bool:
        """Invalidate following cache on follow/unfollow."""
        return await self.delete(self._following_key(user_id))
    
    async def get_post(self, post_id: str) -> Optional[dict]:
        """Get cached post."""
        return await self.get(self._post_key(post_id))
    
    async def set_post(self, post_id: str, post_data: dict) -> bool:
        """Cache post."""
        return await self.set(
            self._post_key(post_id),
            post_data,
            CACHE_TTL["post"]
        )
    
    async def invalidate_post(self, post_id: str) -> bool:
        """Invalidate post cache on update."""
        return await self.delete(self._post_key(post_id))
    
    async def get_trending_tags(self) -> Optional[List[dict]]:
        """Get cached trending tags."""
        return await self.get("trending_tags")
    
    async def set_trending_tags(self, tags: List[dict]) -> bool:
        """Cache trending tags."""
        return await self.set("trending_tags", tags, CACHE_TTL["trending_tags"])
    
    async def get_notifications_count(self, user_id: str) -> Optional[int]:
        """Get cached unread notifications count."""
        return await self.get(f"notif_count:{user_id}")
    
    async def set_notifications_count(self, user_id: str, count: int) -> bool:
        """Cache unread notifications count."""
        return await self.set(
            f"notif_count:{user_id}",
            count,
            CACHE_TTL["notifications_count"]
        )
    
    async def invalidate_notifications(self, user_id: str) -> bool:
        """Invalidate notifications cache."""
        return await self.delete(f"notif_count:{user_id}")


# Global cache instance
cache = CacheService()


async def init_cache():
    """Initialize cache connection on startup."""
    return await cache.connect()


async def close_cache():
    """Close cache connection on shutdown."""
    await cache.disconnect()


# ============ QUERY OPTIMIZATION HELPERS ============

async def batch_fetch_users(db, user_ids: List[str]) -> Dict[str, dict]:
    """
    Fetch users in batch with caching.
    Returns a dict mapping user_id to user data.
    """
    if not user_ids:
        return {}
    
    # Deduplicate
    user_ids = list(set(user_ids))
    result = {}
    missing_ids = []
    
    # Check cache first
    cached = await cache.get_users_batch(user_ids)
    for uid in user_ids:
        if uid in cached and cached[uid]:
            result[uid] = cached[uid]
        else:
            missing_ids.append(uid)
    
    # Fetch missing from DB
    if missing_ids:
        users = await db.users.find(
            {"user_id": {"$in": missing_ids}},
            {"_id": 0, "password": 0}
        ).to_list(len(missing_ids))
        
        to_cache = {}
        for user in users:
            uid = user["user_id"]
            result[uid] = user
            to_cache[uid] = user
        
        # Cache fetched users
        if to_cache:
            await cache.set_users_batch(to_cache)
    
    return result


async def enrich_posts_with_users(db, posts: List[dict], current_user_id: str = None) -> List[dict]:
    """
    Enrich a list of posts with user data and interaction status.
    Eliminates N+1 queries by batching.
    """
    if not posts:
        return posts
    
    # Collect all needed IDs
    post_ids = [p["post_id"] for p in posts]
    user_ids = list(set(p["user_id"] for p in posts))
    original_post_ids = [
        p["original_post_id"] 
        for p in posts 
        if p.get("is_repost") and p.get("original_post_id")
    ]
    
    # Batch fetch users
    users_map = await batch_fetch_users(db, user_ids)
    
    # Batch fetch original posts for reposts
    original_posts_map = {}
    if original_post_ids:
        original_posts = await db.posts.find(
            {"post_id": {"$in": original_post_ids}},
            {"_id": 0}
        ).to_list(len(original_post_ids))
        
        # Get original post users
        orig_user_ids = list(set(op["user_id"] for op in original_posts))
        orig_users_map = await batch_fetch_users(db, orig_user_ids)
        
        for op in original_posts:
            op["user"] = orig_users_map.get(op["user_id"])
            original_posts_map[op["post_id"]] = op
    
    # Batch fetch user interactions if current_user provided
    reactions_map = {}
    dislikes_set = set()
    saved_set = set()
    reposted_set = set()
    
    if current_user_id:
        # Reactions
        reactions = await db.reactions.find({
            "user_id": current_user_id,
            "post_id": {"$in": post_ids}
        }).to_list(len(post_ids))
        reactions_map = {r["post_id"]: r["reaction_type"] for r in reactions}
        
        # Dislikes
        dislikes = await db.dislikes.find({
            "user_id": current_user_id,
            "post_id": {"$in": post_ids}
        }).to_list(len(post_ids))
        dislikes_set = {d["post_id"] for d in dislikes}
        
        # Saved
        saved = await db.saved_posts.find({
            "user_id": current_user_id,
            "post_id": {"$in": post_ids}
        }).to_list(len(post_ids))
        saved_set = {s["post_id"] for s in saved}
        
        # Reposts
        reposts = await db.posts.find({
            "user_id": current_user_id,
            "is_repost": True,
            "original_post_id": {"$in": post_ids}
        }, {"original_post_id": 1}).to_list(len(post_ids))
        reposted_set = {r["original_post_id"] for r in reposts}
    
    # Enrich posts
    for post in posts:
        post_id = post["post_id"]
        post["user"] = users_map.get(post["user_id"])
        
        if post.get("is_repost") and post.get("original_post_id"):
            post["original_post"] = original_posts_map.get(post["original_post_id"])
        
        if current_user_id:
            post["user_reaction"] = reactions_map.get(post_id)
            post["liked"] = reactions_map.get(post_id) == "like"
            post["disliked"] = post_id in dislikes_set
            post["saved"] = post_id in saved_set
            post["reposted"] = post_id in reposted_set
    
    return posts


async def enrich_comments_with_users(db, comments: List[dict]) -> List[dict]:
    """
    Enrich comments with user data, eliminating N+1 queries.
    Also enriches nested replies.
    """
    if not comments:
        return comments
    
    # Collect all user IDs from comments and replies
    user_ids = set()
    for comment in comments:
        user_ids.add(comment["user_id"])
        for reply in comment.get("replies", []):
            user_ids.add(reply["user_id"])
    
    # Batch fetch users
    users_map = await batch_fetch_users(db, list(user_ids))
    
    # Enrich comments
    for comment in comments:
        comment["user"] = users_map.get(comment["user_id"])
        for reply in comment.get("replies", []):
            reply["user"] = users_map.get(reply["user_id"])
    
    return comments
