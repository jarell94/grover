"""
Posts router for handling post-related endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from core.database import get_database
from repositories.post_repository import PostRepository
from repositories.user_repository import UserRepository
from services.post_service import PostService
from schemas.post import Post, PostCreate, PostUpdate, Reaction
from schemas.user import User
from routers.auth import require_auth

router = APIRouter(prefix="/posts", tags=["Posts"])


async def get_post_service(db=Depends(get_database)) -> PostService:
    """Dependency to get post service."""
    post_repo = PostRepository(db)
    user_repo = UserRepository(db)
    return PostService(post_repo, user_repo)


@router.post("/")
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Create a new post.
    
    Args:
        post_data: Post creation data
        
    Returns:
        Created post
    """
    post = await post_service.create_post(current_user.user_id, post_data)
    return post


@router.get("/{post_id}")
async def get_post(
    post_id: str,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Get post by ID.
    
    Args:
        post_id: Post ID
        
    Returns:
        Post data
    """
    post = await post_service.get_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.put("/{post_id}")
async def update_post(
    post_id: str,
    post_update: PostUpdate,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Update a post.
    
    Args:
        post_id: Post ID
        post_update: Post update data
        
    Returns:
        Updated post
    """
    try:
        post = await post_service.update_post(
            post_id, 
            current_user.user_id, 
            post_update
        )
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        return post
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.delete("/{post_id}")
async def delete_post(
    post_id: str,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Delete a post.
    
    Args:
        post_id: Post ID
        
    Returns:
        Success message
    """
    try:
        success = await post_service.delete_post(post_id, current_user.user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Post not found")
        return {"message": "Post deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/user/{user_id}")
async def get_user_posts(
    user_id: str,
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
) -> List[Post]:
    """
    Get posts by a specific user.
    
    Args:
        user_id: User ID
        limit: Maximum number of results
        skip: Number of results to skip
        
    Returns:
        List of posts
    """
    posts = await post_service.get_user_posts(user_id, limit, skip)
    return posts


@router.get("/feed/me")
async def get_feed(
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
) -> List[Post]:
    """
    Get personalized feed for current user.
    Shows posts from users they follow.
    
    Args:
        limit: Maximum number of results
        skip: Number of results to skip
        
    Returns:
        List of posts
    """
    posts = await post_service.get_feed(current_user.user_id, limit, skip)
    return posts


@router.get("/explore/all")
async def get_explore(
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
) -> List[Post]:
    """
    Get posts for explore page (sorted by popularity).
    
    Args:
        limit: Maximum number of results
        skip: Number of results to skip
        
    Returns:
        List of posts
    """
    posts = await post_service.get_explore(limit, skip)
    return posts


@router.post("/{post_id}/like")
async def like_post(
    post_id: str,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Like a post.
    
    Args:
        post_id: Post ID
        
    Returns:
        Success message
    """
    result = await post_service.like_post(post_id, current_user.user_id)
    return result


@router.delete("/{post_id}/like")
async def unlike_post(
    post_id: str,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Unlike a post.
    
    Args:
        post_id: Post ID
        
    Returns:
        Success message
    """
    result = await post_service.unlike_post(post_id, current_user.user_id)
    return result


@router.post("/{post_id}/react")
async def react_to_post(
    post_id: str,
    reaction: Reaction,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Add a reaction to a post.
    Replaces any existing reaction from this user.
    
    Args:
        post_id: Post ID
        reaction: Reaction data
        
    Returns:
        Success message
    """
    try:
        result = await post_service.add_reaction(
            post_id, 
            current_user.user_id, 
            reaction.reaction_type
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{post_id}/react")
async def remove_reaction(
    post_id: str,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Remove reaction from a post.
    
    Args:
        post_id: Post ID
        
    Returns:
        Success message
    """
    result = await post_service.remove_reaction(post_id, current_user.user_id)
    return result


@router.post("/{post_id}/save")
async def save_post(
    post_id: str,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Save/bookmark a post.
    
    Args:
        post_id: Post ID
        
    Returns:
        Success message
    """
    try:
        result = await post_service.save_post(post_id, current_user.user_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{post_id}/save")
async def unsave_post(
    post_id: str,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Unsave/unbookmark a post.
    
    Args:
        post_id: Post ID
        
    Returns:
        Success message
    """
    result = await post_service.unsave_post(post_id, current_user.user_id)
    return result


@router.get("/saved/me")
async def get_saved_posts(
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
) -> List[Post]:
    """
    Get current user's saved posts.
    
    Args:
        limit: Maximum number of results
        skip: Number of results to skip
        
    Returns:
        List of saved posts
    """
    posts = await post_service.get_saved_posts(current_user.user_id, limit, skip)
    return posts


@router.post("/{post_id}/share")
async def share_post(
    post_id: str,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
):
    """
    Share a post (increment share count).
    
    Args:
        post_id: Post ID
        
    Returns:
        Success message
    """
    try:
        result = await post_service.share_post(post_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search/{query}")
async def search_posts(
    query: str,
    limit: int = 20,
    skip: int = 0,
    current_user: User = Depends(require_auth),
    post_service: PostService = Depends(get_post_service)
) -> List[Post]:
    """
    Search posts by content.
    
    Args:
        query: Search query
        limit: Maximum number of results
        skip: Number of results to skip
        
    Returns:
        List of matching posts
    """
    posts = await post_service.search_posts(query, limit, skip)
    return posts
