"""
Notifications Router - Notification endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
import logging

from core.database import db
from core.dependencies import require_auth
from schemas.users import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth)
):
    """Get notifications for current user"""
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    notifications = await db.notifications.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return notifications


@router.post("/mark-read")
async def mark_all_read(current_user: User = Depends(require_auth)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(require_auth)
):
    """Mark a specific notification as read"""
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": current_user.user_id},
        {"$set": {"read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}
