"""
Notification Service - Business logic for notification operations
"""
from typing import Optional, Dict, Any, List
import logging
import uuid
from datetime import datetime, timezone

from repositories.notifications import NotificationRepository
from schemas.notifications import Notification

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for notification business logic"""
    
    def __init__(self, notification_repo: NotificationRepository):
        self.notification_repo = notification_repo
    
    async def create_notification(
        self,
        user_id: str,
        notification_type: str,
        content: str,
        related_id: Optional[str] = None
    ) -> Notification:
        """Create a new notification"""
        notification_data = {
            "notification_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": notification_type,
            "content": content,
            "read": False,
            "created_at": datetime.now(timezone.utc)
        }
        
        if related_id:
            notification_data["related_id"] = related_id
        
        await self.notification_repo.create_notification(notification_data)
        return Notification(**notification_data)
    
    async def get_user_notifications(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[Notification]:
        """Get notifications for a user"""
        notifications_docs = await self.notification_repo.get_user_notifications(
            user_id, skip, limit
        )
        return [Notification(**doc) for doc in notifications_docs]
    
    async def mark_as_read(self, notification_id: str) -> bool:
        """Mark notification as read"""
        return await self.notification_repo.mark_as_read(notification_id)
    
    async def mark_all_read(self, user_id: str) -> bool:
        """Mark all notifications as read for a user"""
        return await self.notification_repo.mark_all_read(user_id)
    
    async def count_unread(self, user_id: str) -> int:
        """Count unread notifications for a user"""
        return await self.notification_repo.count_unread(user_id)
