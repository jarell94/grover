"""
User repository for database operations.
Provides data access layer for user-related operations.
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Dict, Any
from datetime import datetime

from schemas.user import User, UserCreate, UserUpdate, NotificationSettings


class UserRepository:
    """Repository for user data access operations."""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.users
    
    async def create_user(self, user_data: UserCreate) -> User:
        """Create a new user."""
        user_dict = user_data.model_dump()
        user_dict['created_at'] = datetime.now()
        user_dict['is_premium'] = False
        user_dict['is_private'] = False
        
        # Set default notification preferences
        user_dict['notify_followers'] = True
        user_dict['notify_likes'] = True
        user_dict['notify_comments'] = True
        user_dict['notify_messages'] = True
        user_dict['notify_sales'] = True
        user_dict['notify_mentions'] = True
        user_dict['notify_reposts'] = True
        
        await self.collection.insert_one(user_dict)
        return User(**user_dict)
    
    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        user_data = await self.collection.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        if user_data:
            return User(**user_data)
        return None
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        user_data = await self.collection.find_one(
            {"email": email},
            {"_id": 0}
        )
        if user_data:
            return User(**user_data)
        return None
    
    async def update_user(
        self, 
        user_id: str, 
        user_update: UserUpdate
    ) -> Optional[User]:
        """Update user profile."""
        update_data = user_update.model_dump(exclude_unset=True)
        
        if not update_data:
            return await self.get_user_by_id(user_id)
        
        result = await self.collection.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            return await self.get_user_by_id(user_id)
        return None
    
    async def update_notification_settings(
        self,
        user_id: str,
        settings: NotificationSettings
    ) -> Optional[User]:
        """Update user notification settings."""
        settings_data = settings.model_dump(exclude_unset=True)
        
        if not settings_data:
            return await self.get_user_by_id(user_id)
        
        result = await self.collection.update_one(
            {"user_id": user_id},
            {"$set": settings_data}
        )
        
        if result.modified_count > 0:
            return await self.get_user_by_id(user_id)
        return None
    
    async def delete_user(self, user_id: str) -> bool:
        """Delete a user."""
        result = await self.collection.delete_one({"user_id": user_id})
        return result.deleted_count > 0
    
    async def get_user_stats(self, user_id: str) -> Dict[str, int]:
        """Get user statistics."""
        # Count followers
        followers_count = await self.db.follows.count_documents(
            {"following_id": user_id}
        )
        
        # Count following
        following_count = await self.db.follows.count_documents(
            {"follower_id": user_id}
        )
        
        # Count posts
        posts_count = await self.db.posts.count_documents(
            {"user_id": user_id}
        )
        
        # Count products
        products_count = await self.db.products.count_documents(
            {"user_id": user_id}
        )
        
        return {
            "followers_count": followers_count,
            "following_count": following_count,
            "posts_count": posts_count,
            "products_count": products_count
        }
    
    async def search_users(
        self, 
        query: str, 
        limit: int = 20,
        skip: int = 0
    ) -> List[User]:
        """Search users by name."""
        cursor = self.collection.find(
            {"name": {"$regex": query, "$options": "i"}},
            {"_id": 0}
        ).skip(skip).limit(limit)
        
        users = []
        async for user_data in cursor:
            users.append(User(**user_data))
        
        return users
    
    async def follow_user(self, follower_id: str, following_id: str) -> bool:
        """Follow a user."""
        try:
            await self.db.follows.insert_one({
                "follower_id": follower_id,
                "following_id": following_id,
                "created_at": datetime.now()
            })
            return True
        except Exception:
            # Already following or error
            return False
    
    async def unfollow_user(self, follower_id: str, following_id: str) -> bool:
        """Unfollow a user."""
        result = await self.db.follows.delete_one({
            "follower_id": follower_id,
            "following_id": following_id
        })
        return result.deleted_count > 0
    
    async def is_following(self, follower_id: str, following_id: str) -> bool:
        """Check if user is following another user."""
        follow = await self.db.follows.find_one({
            "follower_id": follower_id,
            "following_id": following_id
        })
        return follow is not None
    
    async def get_followers(
        self, 
        user_id: str, 
        limit: int = 50,
        skip: int = 0
    ) -> List[str]:
        """Get list of user's followers."""
        cursor = self.db.follows.find(
            {"following_id": user_id},
            {"follower_id": 1, "_id": 0}
        ).skip(skip).limit(limit)
        
        followers = []
        async for doc in cursor:
            followers.append(doc["follower_id"])
        
        return followers
    
    async def get_following(
        self, 
        user_id: str, 
        limit: int = 50,
        skip: int = 0
    ) -> List[str]:
        """Get list of users that this user is following."""
        cursor = self.db.follows.find(
            {"follower_id": user_id},
            {"following_id": 1, "_id": 0}
        ).skip(skip).limit(limit)
        
        following = []
        async for doc in cursor:
            following.append(doc["following_id"])
        
        return following
