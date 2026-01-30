"""
Users router for handling user-related endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from core.database import get_database
from repositories.user_repository import UserRepository
from services.user_service import UserService
from schemas.user import User, UserUpdate, NotificationSettings, UserPublic
from routers.auth import require_auth

router = APIRouter(prefix="/users", tags=["Users"])


async def get_user_service(db=Depends(get_database)) -> UserService:
    """Dependency to get user service."""
    user_repo = UserRepository(db)
    return UserService(user_repo)


@router.get("/me")
async def get_current_user_profile(
    current_user: User = Depends(require_auth),
    user_service: UserService = Depends(get_user_service)
):
    """
    Get current user's full profile.
    
    Returns:
        Current user profile with stats
    """
    stats = await user_service.get_user_stats(current_user.user_id)
    return {
        **current_user.model_dump(),
        **stats
    }


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: User = Depends(require_auth),
    user_service: UserService = Depends(get_user_service)
):
    """
    Get user profile by ID.
    
    Args:
        user_id: User ID to fetch
        
    Returns:
        User profile
    """
    user = await user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return public profile
    return UserPublic(**user.model_dump())


@router.get("/{user_id}/stats")
async def get_user_stats(
    user_id: str,
    current_user: User = Depends(require_auth),
    user_service: UserService = Depends(get_user_service)
):
    """
    Get user statistics.
    
    Args:
        user_id: User ID
        
    Returns:
        User statistics (followers, following, posts, products)
    """
    user = await user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    stats = await user_service.get_user_stats(user_id)
    return stats


@router.put("/profile")
async def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(require_auth),
    user_service: UserService = Depends(get_user_service)
):
    """
    Update current user's profile.
    
    Args:
        user_update: Profile update data
        
    Returns:
        Updated user profile
    """
    updated_user = await user_service.update_profile(
        current_user.user_id, 
        user_update
    )
    
    if not updated_user:
        raise HTTPException(status_code=400, detail="Failed to update profile")
    
    return updated_user


@router.put("/notification-settings")
async def update_notification_settings(
    settings: NotificationSettings,
    current_user: User = Depends(require_auth),
    user_service: UserService = Depends(get_user_service)
):
    """
    Update notification settings.
    
    Args:
        settings: Notification settings update
        
    Returns:
        Updated user with new settings
    """
    updated_user = await user_service.update_notification_settings(
        current_user.user_id,
        settings
    )
    
    if not updated_user:
        raise HTTPException(
            status_code=400, 
            detail="Failed to update notification settings"
        )
    
    return updated_user


@router.get("/notification-settings/me")
async def get_notification_settings(
    current_user: User = Depends(require_auth)
):
    """
    Get current user's notification settings.
    
    Returns:
        Notification settings
    """
    return {
        "notify_followers": current_user.notify_followers,
        "notify_likes": current_user.notify_likes,
        "notify_comments": current_user.notify_comments,
        "notify_messages": current_user.notify_messages,
        "notify_sales": current_user.notify_sales,
        "notify_mentions": current_user.notify_mentions,
        "notify_reposts": current_user.notify_reposts
    }


@router.post("/{user_id}/follow")
async def follow_user(
    user_id: str,
    current_user: User = Depends(require_auth),
    user_service: UserService = Depends(get_user_service)
):
    """
    Follow a user.
    
    Args:
        user_id: User ID to follow
        
    Returns:
        Success message
    """
    try:
        result = await user_service.follow_user(
            current_user.user_id, 
            user_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{user_id}/follow")
async def unfollow_user(
    user_id: str,
    current_user: User = Depends(require_auth),
    user_service: UserService = Depends(get_user_service)
):
    """
    Unfollow a user.
    
    Args:
        user_id: User ID to unfollow
        
    Returns:
        Success message
    """
    result = await user_service.unfollow_user(
        current_user.user_id, 
        user_id
    )
    return result


@router.get("/{user_id}/followers")
async def get_followers(
    user_id: str,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(require_auth),
    user_service: UserService = Depends(get_user_service)
) -> List[UserPublic]:
    """
    Get user's followers.
    
    Args:
        user_id: User ID
        limit: Maximum number of results
        skip: Number of results to skip
        
    Returns:
        List of followers
    """
    followers = await user_service.get_followers(user_id, limit, skip)
    return [UserPublic(**f.model_dump()) for f in followers]


@router.get("/{user_id}/following")
async def get_following(
    user_id: str,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(require_auth),
    user_service: UserService = Depends(get_user_service)
) -> List[UserPublic]:
    """
    Get users that this user is following.
    
    Args:
        user_id: User ID
        limit: Maximum number of results
        skip: Number of results to skip
        
    Returns:
        List of users being followed
    """
    following = await user_service.get_following(user_id, limit, skip)
    return [UserPublic(**f.model_dump()) for f in following]


@router.get("/search/{query}")
async def search_users(
    query: str,
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth),
    user_service: UserService = Depends(get_user_service)
) -> List[UserPublic]:
    """
    Search users by name.
    
    Args:
        query: Search query
        limit: Maximum number of results
        skip: Number of results to skip
        
    Returns:
        List of matching users
    """
    users = await user_service.search_users(query, limit, skip)
    return [UserPublic(**u.model_dump()) for u in users]
