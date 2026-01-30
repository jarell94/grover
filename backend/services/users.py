"""
User Service - Business logic for user operations
"""
from typing import Optional, Dict, Any
import logging
from datetime import datetime, timezone

from repositories.users import UserRepository
from schemas.users import User

logger = logging.getLogger(__name__)


class UserService:
    """Service for user business logic"""
    
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
    
    async def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        user_doc = await self.user_repo.get_by_user_id(user_id)
        if user_doc:
            return User(**user_doc)
        return None
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        user_doc = await self.user_repo.get_by_email(email)
        if user_doc:
            return User(**user_doc)
        return None
    
    async def create_user(self, user_data: Dict[str, Any]) -> User:
        """Create a new user"""
        # Set created_at if not provided
        if "created_at" not in user_data:
            user_data["created_at"] = datetime.now(timezone.utc)
        
        await self.user_repo.create_user(user_data)
        return User(**user_data)
    
    async def update_profile(
        self, 
        user_id: str, 
        update_data: Dict[str, Any]
    ) -> bool:
        """Update user profile"""
        # Filter out fields that shouldn't be updated directly
        allowed_fields = {
            "name", "bio", "picture", "website", 
            "twitter", "instagram", "linkedin", "paypal_email",
            "is_private"
        }
        filtered_data = {
            k: v for k, v in update_data.items() 
            if k in allowed_fields
        }
        
        if not filtered_data:
            return False
        
        return await self.user_repo.update_user(user_id, filtered_data)
    
    async def update_notification_settings(
        self, 
        user_id: str, 
        settings: Dict[str, bool]
    ) -> bool:
        """Update notification settings"""
        # Validate settings keys
        valid_keys = {
            "notify_followers", "notify_likes", "notify_comments",
            "notify_messages", "notify_sales", "notify_mentions", "notify_reposts"
        }
        filtered_settings = {
            k: v for k, v in settings.items() 
            if k in valid_keys
        }
        
        if not filtered_settings:
            return False
        
        return await self.user_repo.update_notification_settings(user_id, filtered_settings)
