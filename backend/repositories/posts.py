"""
Post Repository - Data access layer for post operations
"""
from typing import Optional, Dict, Any, List
from repositories.base import BaseRepository


class PostRepository(BaseRepository):
    """Repository for post data access"""
    
    async def get_by_post_id(self, post_id: str) -> Optional[Dict[str, Any]]:
        """Get post by post_id"""
        return await self.find_one({"post_id": post_id})
    
    async def get_user_posts(
        self, 
        user_id: str, 
        skip: int = 0, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get posts by user"""
        return await self.find_many(
            {"user_id": user_id},
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)]
        )
    
    async def get_feed_posts(
        self, 
        skip: int = 0, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get posts for feed"""
        return await self.find_many(
            {},
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)]
        )
    
    async def create_post(self, post_data: Dict[str, Any]) -> Any:
        """Create a new post"""
        return await self.insert_one(post_data)
    
    async def update_post(self, post_id: str, update_data: Dict[str, Any]) -> bool:
        """Update post data"""
        return await self.update_one(
            {"post_id": post_id},
            {"$set": update_data}
        )
    
    async def delete_post(self, post_id: str) -> bool:
        """Delete a post"""
        return await self.delete_one({"post_id": post_id})
    
    async def increment_field(self, post_id: str, field: str, value: int = 1) -> bool:
        """Increment a numeric field (likes, comments, etc.)"""
        return await self.update_one(
            {"post_id": post_id},
            {"$inc": {field: value}}
        )
    
    async def count_user_posts(self, user_id: str) -> int:
        """Count posts by user"""
        return await self.count_documents({"user_id": user_id})
