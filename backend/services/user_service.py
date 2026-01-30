"""
User service for business logic related to users.
"""
from typing import Optional, List, Dict

from repositories.user_repository import UserRepository
from schemas.user import User, UserCreate, UserUpdate, NotificationSettings


class UserService:
    """Service for user business logic."""
    
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
    
    async def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        return await self.user_repo.get_user_by_id(user_id)
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        return await self.user_repo.get_user_by_email(email)
    
    async def update_profile(
        self, 
        user_id: str, 
        user_update: UserUpdate
    ) -> Optional[User]:
        """Update user profile."""
        return await self.user_repo.update_user(user_id, user_update)
    
    async def update_notification_settings(
        self,
        user_id: str,
        settings: NotificationSettings
    ) -> Optional[User]:
        """Update user notification settings."""
        return await self.user_repo.update_notification_settings(user_id, settings)
    
    async def get_user_stats(self, user_id: str) -> Dict[str, int]:
        """Get user statistics (followers, following, posts, products)."""
        return await self.user_repo.get_user_stats(user_id)
    
    async def follow_user(
        self, 
        follower_id: str, 
        following_id: str
    ) -> Dict[str, str]:
        """
        Follow a user.
        
        Returns:
            Dict with status message
            
        Raises:
            ValueError: If trying to follow self or user doesn't exist
        """
        if follower_id == following_id:
            raise ValueError("Cannot follow yourself")
        
        # Check if target user exists
        target_user = await self.user_repo.get_user_by_id(following_id)
        if not target_user:
            raise ValueError("User not found")
        
        # Check if already following
        is_following = await self.user_repo.is_following(follower_id, following_id)
        if is_following:
            return {"status": "already_following"}
        
        success = await self.user_repo.follow_user(follower_id, following_id)
        if success:
            return {"status": "followed"}
        else:
            raise ValueError("Failed to follow user")
    
    async def unfollow_user(
        self, 
        follower_id: str, 
        following_id: str
    ) -> Dict[str, str]:
        """
        Unfollow a user.
        
        Returns:
            Dict with status message
        """
        success = await self.user_repo.unfollow_user(follower_id, following_id)
        if success:
            return {"status": "unfollowed"}
        else:
            return {"status": "not_following"}
    
    async def is_following(self, follower_id: str, following_id: str) -> bool:
        """Check if user is following another user."""
        return await self.user_repo.is_following(follower_id, following_id)
    
    async def get_followers(
        self, 
        user_id: str, 
        limit: int = 50,
        skip: int = 0
    ) -> List[User]:
        """Get list of user's followers."""
        follower_ids = await self.user_repo.get_followers(user_id, limit, skip)
        
        followers = []
        for follower_id in follower_ids:
            user = await self.user_repo.get_user_by_id(follower_id)
            if user:
                followers.append(user)
        
        return followers
    
    async def get_following(
        self, 
        user_id: str, 
        limit: int = 50,
        skip: int = 0
    ) -> List[User]:
        """Get list of users that this user is following."""
        following_ids = await self.user_repo.get_following(user_id, limit, skip)
        
        following = []
        for following_id in following_ids:
            user = await self.user_repo.get_user_by_id(following_id)
            if user:
                following.append(user)
        
        return following
    
    async def search_users(
        self, 
        query: str, 
        limit: int = 20,
        skip: int = 0
    ) -> List[User]:
        """Search users by name."""
        return await self.user_repo.search_users(query, limit, skip)
    
    async def get_user_posts_count(self, user_id: str) -> int:
        """Get count of user's posts."""
        stats = await self.user_repo.get_user_stats(user_id)
        return stats.get("posts_count", 0)
