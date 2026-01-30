"""
Notification Repository - Data access layer for notification operations
"""
from typing import Optional, Dict, Any, List
from repositories.base import BaseRepository


class NotificationRepository(BaseRepository):
    """Repository for notification data access"""
    
    async def get_by_notification_id(self, notification_id: str) -> Optional[Dict[str, Any]]:
        """Get notification by notification_id"""
        return await self.find_one({"notification_id": notification_id})
    
    async def get_user_notifications(
        self, 
        user_id: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get notifications for a user"""
        return await self.find_many(
            {"user_id": user_id},
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)]
        )
    
    async def create_notification(self, notification_data: Dict[str, Any]) -> Any:
        """Create a new notification"""
        return await self.insert_one(notification_data)
    
    async def mark_as_read(self, notification_id: str) -> bool:
        """Mark notification as read"""
        return await self.update_one(
            {"notification_id": notification_id},
            {"$set": {"read": True}}
        )
    
    async def mark_all_read(self, user_id: str) -> bool:
        """Mark all notifications as read for a user"""
        result = await self.collection.update_many(
            {"user_id": user_id, "read": False},
            {"$set": {"read": True}}
        )
        return result.modified_count > 0
    
    async def count_unread(self, user_id: str) -> int:
        """Count unread notifications for a user"""
        return await self.count_documents({"user_id": user_id, "read": False})
