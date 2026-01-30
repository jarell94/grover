"""
User Repository - Data access layer for user operations
"""
from typing import Optional, Dict, Any
from repositories.base import BaseRepository


class UserRepository(BaseRepository):
    """Repository for user data access"""
    
    async def get_by_user_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by user_id"""
        return await self.find_one({"user_id": user_id})
    
    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        return await self.find_one({"email": email})
    
    async def create_user(self, user_data: Dict[str, Any]) -> Any:
        """Create a new user"""
        return await self.insert_one(user_data)
    
    async def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update user data"""
        return await self.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
    
    async def update_notification_settings(
        self, 
        user_id: str, 
        settings: Dict[str, bool]
    ) -> bool:
        """Update user notification settings"""
        return await self.update_user(user_id, settings)
