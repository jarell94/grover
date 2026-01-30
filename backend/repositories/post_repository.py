"""
Post repository for database operations.
Provides data access layer for post-related operations.
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Dict, Any
from datetime import datetime

from schemas.post import Post, PostCreate, PostUpdate


class PostRepository:
    """Repository for post data access operations."""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.posts
    
    async def create_post(self, user_id: str, post_data: PostCreate) -> Post:
        """Create a new post."""
        post_dict = post_data.model_dump()
        post_dict['user_id'] = user_id
        post_dict['post_id'] = f"post_{datetime.now().timestamp()}_{user_id}"
        post_dict['likes_count'] = 0
        post_dict['dislikes_count'] = 0
        post_dict['shares_count'] = 0
        post_dict['comments_count'] = 0
        post_dict['repost_count'] = 0
        post_dict['reaction_counts'] = {}
        post_dict['is_repost'] = False
        post_dict['created_at'] = datetime.now()
        
        await self.collection.insert_one(post_dict)
        return Post(**post_dict)
    
    async def get_post_by_id(self, post_id: str) -> Optional[Post]:
        """Get post by ID."""
        post_data = await self.collection.find_one(
            {"post_id": post_id},
            {"_id": 0}
        )
        if post_data:
            return Post(**post_data)
        return None
    
    async def update_post(
        self, 
        post_id: str, 
        post_update: PostUpdate
    ) -> Optional[Post]:
        """Update a post."""
        update_data = post_update.model_dump(exclude_unset=True)
        
        if not update_data:
            return await self.get_post_by_id(post_id)
        
        result = await self.collection.update_one(
            {"post_id": post_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            return await self.get_post_by_id(post_id)
        return None
    
    async def delete_post(self, post_id: str) -> bool:
        """Delete a post."""
        result = await self.collection.delete_one({"post_id": post_id})
        return result.deleted_count > 0
    
    async def get_user_posts(
        self, 
        user_id: str,
        limit: int = 20,
        skip: int = 0
    ) -> List[Post]:
        """Get posts by a specific user."""
        cursor = self.collection.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit)
        
        posts = []
        async for post_data in cursor:
            posts.append(Post(**post_data))
        
        return posts
    
    async def get_feed_posts(
        self,
        user_ids: List[str],
        limit: int = 20,
        skip: int = 0
    ) -> List[Post]:
        """Get posts from a list of users (for feed)."""
        cursor = self.collection.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit)
        
        posts = []
        async for post_data in cursor:
            posts.append(Post(**post_data))
        
        return posts
    
    async def get_explore_posts(
        self,
        limit: int = 20,
        skip: int = 0
    ) -> List[Post]:
        """Get posts for explore page (sorted by likes)."""
        cursor = self.collection.find(
            {},
            {"_id": 0}
        ).sort("likes_count", -1).skip(skip).limit(limit)
        
        posts = []
        async for post_data in cursor:
            posts.append(Post(**post_data))
        
        return posts
    
    async def like_post(self, post_id: str, user_id: str) -> bool:
        """Like a post."""
        # Check if already liked
        existing = await self.db.likes.find_one({
            "post_id": post_id,
            "user_id": user_id
        })
        
        if existing:
            return False
        
        # Add like
        await self.db.likes.insert_one({
            "post_id": post_id,
            "user_id": user_id,
            "created_at": datetime.now()
        })
        
        # Increment like count
        await self.collection.update_one(
            {"post_id": post_id},
            {"$inc": {"likes_count": 1}}
        )
        
        return True
    
    async def unlike_post(self, post_id: str, user_id: str) -> bool:
        """Unlike a post."""
        result = await self.db.likes.delete_one({
            "post_id": post_id,
            "user_id": user_id
        })
        
        if result.deleted_count > 0:
            # Decrement like count
            await self.collection.update_one(
                {"post_id": post_id},
                {"$inc": {"likes_count": -1}}
            )
            return True
        
        return False
    
    async def is_post_liked(self, post_id: str, user_id: str) -> bool:
        """Check if post is liked by user."""
        like = await self.db.likes.find_one({
            "post_id": post_id,
            "user_id": user_id
        })
        return like is not None
    
    async def add_reaction(
        self, 
        post_id: str, 
        user_id: str, 
        reaction_type: str
    ) -> bool:
        """Add a reaction to a post."""
        # Remove any existing reaction from this user
        await self.db.reactions.delete_many({
            "post_id": post_id,
            "user_id": user_id
        })
        
        # Add new reaction
        await self.db.reactions.insert_one({
            "post_id": post_id,
            "user_id": user_id,
            "reaction_type": reaction_type,
            "created_at": datetime.now()
        })
        
        # Update reaction counts
        reaction_counts = await self.get_reaction_counts(post_id)
        await self.collection.update_one(
            {"post_id": post_id},
            {"$set": {"reaction_counts": reaction_counts}}
        )
        
        return True
    
    async def remove_reaction(self, post_id: str, user_id: str) -> bool:
        """Remove reaction from a post."""
        result = await self.db.reactions.delete_one({
            "post_id": post_id,
            "user_id": user_id
        })
        
        if result.deleted_count > 0:
            # Update reaction counts
            reaction_counts = await self.get_reaction_counts(post_id)
            await self.collection.update_one(
                {"post_id": post_id},
                {"$set": {"reaction_counts": reaction_counts}}
            )
            return True
        
        return False
    
    async def get_reaction_counts(self, post_id: str) -> Dict[str, int]:
        """Get reaction counts for a post."""
        pipeline = [
            {"$match": {"post_id": post_id}},
            {"$group": {
                "_id": "$reaction_type",
                "count": {"$sum": 1}
            }}
        ]
        
        reaction_counts = {}
        async for doc in self.db.reactions.aggregate(pipeline):
            reaction_counts[doc["_id"]] = doc["count"]
        
        return reaction_counts
    
    async def save_post(self, post_id: str, user_id: str) -> bool:
        """Save/bookmark a post."""
        try:
            await self.db.saved_posts.insert_one({
                "post_id": post_id,
                "user_id": user_id,
                "created_at": datetime.now()
            })
            return True
        except Exception:
            return False
    
    async def unsave_post(self, post_id: str, user_id: str) -> bool:
        """Unsave/unbookmark a post."""
        result = await self.db.saved_posts.delete_one({
            "post_id": post_id,
            "user_id": user_id
        })
        return result.deleted_count > 0
    
    async def get_saved_posts(
        self,
        user_id: str,
        limit: int = 20,
        skip: int = 0
    ) -> List[Post]:
        """Get user's saved posts."""
        # Get saved post IDs
        cursor = self.db.saved_posts.find(
            {"user_id": user_id},
            {"post_id": 1, "_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit)
        
        post_ids = []
        async for doc in cursor:
            post_ids.append(doc["post_id"])
        
        # Get actual posts
        posts = []
        for post_id in post_ids:
            post = await self.get_post_by_id(post_id)
            if post:
                posts.append(post)
        
        return posts
    
    async def increment_share_count(self, post_id: str) -> bool:
        """Increment share count for a post."""
        result = await self.collection.update_one(
            {"post_id": post_id},
            {"$inc": {"shares_count": 1}}
        )
        return result.modified_count > 0
    
    async def search_posts(
        self,
        query: str,
        limit: int = 20,
        skip: int = 0
    ) -> List[Post]:
        """Search posts by content."""
        cursor = self.collection.find(
            {"content": {"$regex": query, "$options": "i"}},
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit)
        
        posts = []
        async for post_data in cursor:
            posts.append(Post(**post_data))
        
        return posts
