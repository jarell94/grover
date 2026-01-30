"""
Post Service - Business logic for post operations
"""
from typing import Optional, Dict, Any, List
import logging
import uuid
from datetime import datetime, timezone

from repositories.posts import PostRepository
from schemas.posts import Post

logger = logging.getLogger(__name__)


class PostService:
    """Service for post business logic"""
    
    def __init__(self, post_repo: PostRepository):
        self.post_repo = post_repo
    
    async def get_post(self, post_id: str) -> Optional[Post]:
        """Get post by ID"""
        post_doc = await self.post_repo.get_by_post_id(post_id)
        if post_doc:
            return Post(**post_doc)
        return None
    
    async def get_user_posts(
        self, 
        user_id: str, 
        skip: int = 0, 
        limit: int = 20
    ) -> List[Post]:
        """Get posts by user"""
        posts_docs = await self.post_repo.get_user_posts(user_id, skip, limit)
        return [Post(**doc) for doc in posts_docs]
    
    async def get_feed_posts(
        self, 
        skip: int = 0, 
        limit: int = 20
    ) -> List[Post]:
        """Get posts for feed"""
        posts_docs = await self.post_repo.get_feed_posts(skip, limit)
        return [Post(**doc) for doc in posts_docs]
    
    async def create_post(self, post_data: Dict[str, Any]) -> Post:
        """Create a new post"""
        # Generate post_id if not provided
        if "post_id" not in post_data:
            post_data["post_id"] = str(uuid.uuid4())
        
        # Set created_at if not provided
        if "created_at" not in post_data:
            post_data["created_at"] = datetime.now(timezone.utc)
        
        # Initialize counters
        post_data.setdefault("likes_count", 0)
        post_data.setdefault("dislikes_count", 0)
        post_data.setdefault("shares_count", 0)
        post_data.setdefault("comments_count", 0)
        post_data.setdefault("repost_count", 0)
        post_data.setdefault("reaction_counts", {})
        post_data.setdefault("tagged_users", [])
        
        await self.post_repo.create_post(post_data)
        return Post(**post_data)
    
    async def update_post(
        self, 
        post_id: str, 
        update_data: Dict[str, Any]
    ) -> bool:
        """Update post"""
        # Only allow updating certain fields
        allowed_fields = {"content", "location", "tagged_users"}
        filtered_data = {
            k: v for k, v in update_data.items() 
            if k in allowed_fields
        }
        
        if not filtered_data:
            return False
        
        return await self.post_repo.update_post(post_id, filtered_data)
    
    async def delete_post(self, post_id: str) -> bool:
        """Delete a post"""
        return await self.post_repo.delete_post(post_id)
    
    async def increment_likes(self, post_id: str) -> bool:
        """Increment likes count"""
        return await self.post_repo.increment_field(post_id, "likes_count", 1)
    
    async def decrement_likes(self, post_id: str) -> bool:
        """Decrement likes count"""
        return await self.post_repo.increment_field(post_id, "likes_count", -1)
    
    async def increment_comments(self, post_id: str) -> bool:
        """Increment comments count"""
        return await self.post_repo.increment_field(post_id, "comments_count", 1)
    
    async def count_user_posts(self, user_id: str) -> int:
        """Count posts by user"""
        return await self.post_repo.count_user_posts(user_id)
