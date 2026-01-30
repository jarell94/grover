"""
Post service for business logic related to posts.
"""
from typing import Optional, List, Dict

from repositories.post_repository import PostRepository
from repositories.user_repository import UserRepository
from schemas.post import Post, PostCreate, PostUpdate


class PostService:
    """Service for post business logic."""
    
    def __init__(
        self, 
        post_repo: PostRepository,
        user_repo: UserRepository
    ):
        self.post_repo = post_repo
        self.user_repo = user_repo
    
    async def create_post(self, user_id: str, post_data: PostCreate) -> Post:
        """Create a new post."""
        return await self.post_repo.create_post(user_id, post_data)
    
    async def get_post(self, post_id: str) -> Optional[Post]:
        """Get post by ID."""
        return await self.post_repo.get_post_by_id(post_id)
    
    async def update_post(
        self, 
        post_id: str, 
        user_id: str,
        post_update: PostUpdate
    ) -> Optional[Post]:
        """
        Update a post.
        
        Args:
            post_id: Post ID
            user_id: User ID (must be post owner)
            post_update: Update data
            
        Returns:
            Updated post or None
            
        Raises:
            ValueError: If user is not the post owner
        """
        # Check ownership
        post = await self.post_repo.get_post_by_id(post_id)
        if not post:
            return None
        
        if post.user_id != user_id:
            raise ValueError("Not authorized to update this post")
        
        return await self.post_repo.update_post(post_id, post_update)
    
    async def delete_post(self, post_id: str, user_id: str) -> bool:
        """
        Delete a post.
        
        Args:
            post_id: Post ID
            user_id: User ID (must be post owner)
            
        Returns:
            True if deleted, False otherwise
            
        Raises:
            ValueError: If user is not the post owner
        """
        # Check ownership
        post = await self.post_repo.get_post_by_id(post_id)
        if not post:
            return False
        
        if post.user_id != user_id:
            raise ValueError("Not authorized to delete this post")
        
        return await self.post_repo.delete_post(post_id)
    
    async def get_user_posts(
        self, 
        user_id: str,
        limit: int = 20,
        skip: int = 0
    ) -> List[Post]:
        """Get posts by a specific user."""
        return await self.post_repo.get_user_posts(user_id, limit, skip)
    
    async def get_feed(
        self,
        user_id: str,
        limit: int = 20,
        skip: int = 0
    ) -> List[Post]:
        """
        Get personalized feed for user.
        Shows posts from users they follow.
        """
        # Get list of users that the current user follows
        following_ids = await self.user_repo.get_following(user_id, limit=1000)
        
        # Include user's own posts in feed
        following_ids.append(user_id)
        
        # Get posts from followed users
        return await self.post_repo.get_feed_posts(following_ids, limit, skip)
    
    async def get_explore(
        self,
        limit: int = 20,
        skip: int = 0
    ) -> List[Post]:
        """Get posts for explore page (sorted by popularity)."""
        return await self.post_repo.get_explore_posts(limit, skip)
    
    async def like_post(self, post_id: str, user_id: str) -> Dict[str, str]:
        """
        Like a post.
        
        Returns:
            Dict with status message
        """
        success = await self.post_repo.like_post(post_id, user_id)
        if success:
            return {"status": "liked"}
        else:
            return {"status": "already_liked"}
    
    async def unlike_post(self, post_id: str, user_id: str) -> Dict[str, str]:
        """
        Unlike a post.
        
        Returns:
            Dict with status message
        """
        success = await self.post_repo.unlike_post(post_id, user_id)
        if success:
            return {"status": "unliked"}
        else:
            return {"status": "not_liked"}
    
    async def is_post_liked(self, post_id: str, user_id: str) -> bool:
        """Check if post is liked by user."""
        return await self.post_repo.is_post_liked(post_id, user_id)
    
    async def add_reaction(
        self, 
        post_id: str, 
        user_id: str, 
        reaction_type: str
    ) -> Dict[str, str]:
        """
        Add a reaction to a post.
        Replaces any existing reaction from this user.
        
        Returns:
            Dict with status message
        """
        success = await self.post_repo.add_reaction(post_id, user_id, reaction_type)
        if success:
            return {"status": "reacted", "reaction_type": reaction_type}
        else:
            raise ValueError("Failed to add reaction")
    
    async def remove_reaction(self, post_id: str, user_id: str) -> Dict[str, str]:
        """
        Remove reaction from a post.
        
        Returns:
            Dict with status message
        """
        success = await self.post_repo.remove_reaction(post_id, user_id)
        if success:
            return {"status": "removed"}
        else:
            return {"status": "no_reaction"}
    
    async def save_post(self, post_id: str, user_id: str) -> Dict[str, str]:
        """
        Save/bookmark a post.
        
        Returns:
            Dict with status message
        """
        # Check if post exists
        post = await self.post_repo.get_post_by_id(post_id)
        if not post:
            raise ValueError("Post not found")
        
        success = await self.post_repo.save_post(post_id, user_id)
        if success:
            return {"status": "saved"}
        else:
            return {"status": "already_saved"}
    
    async def unsave_post(self, post_id: str, user_id: str) -> Dict[str, str]:
        """
        Unsave/unbookmark a post.
        
        Returns:
            Dict with status message
        """
        success = await self.post_repo.unsave_post(post_id, user_id)
        if success:
            return {"status": "unsaved"}
        else:
            return {"status": "not_saved"}
    
    async def get_saved_posts(
        self,
        user_id: str,
        limit: int = 20,
        skip: int = 0
    ) -> List[Post]:
        """Get user's saved posts."""
        return await self.post_repo.get_saved_posts(user_id, limit, skip)
    
    async def share_post(self, post_id: str) -> Dict[str, str]:
        """
        Share a post (increment share count).
        
        Returns:
            Dict with status message
        """
        success = await self.post_repo.increment_share_count(post_id)
        if success:
            return {"status": "shared"}
        else:
            raise ValueError("Failed to share post")
    
    async def search_posts(
        self,
        query: str,
        limit: int = 20,
        skip: int = 0
    ) -> List[Post]:
        """Search posts by content."""
        return await self.post_repo.search_posts(query, limit, skip)
