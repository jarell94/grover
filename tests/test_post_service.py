"""
Unit tests for PostService.
"""
import pytest
from datetime import datetime

from repositories.post_repository import PostRepository
from repositories.user_repository import UserRepository
from services.post_service import PostService
from schemas.post import PostCreate, PostUpdate


@pytest.mark.unit
@pytest.mark.service
class TestPostService:
    """Test suite for PostService."""
    
    @pytest.fixture
    async def post_service(self, test_db):
        """Create a PostService instance with test database."""
        post_repo = PostRepository(test_db)
        user_repo = UserRepository(test_db)
        return PostService(post_repo, user_repo)
    
    @pytest.mark.asyncio
    async def test_create_post(self, post_service, sample_user):
        """Test creating a post."""
        post_data = PostCreate(
            content="Test post content",
            media_url=None,
            media_type=None,
            tagged_users=[],
            location=None
        )
        
        post = await post_service.create_post(
            sample_user['user_id'],
            post_data
        )
        
        assert post is not None
        assert post.user_id == sample_user['user_id']
        assert post.content == "Test post content"
        assert post.likes_count == 0
    
    @pytest.mark.asyncio
    async def test_get_post(self, post_service, sample_post):
        """Test getting a post by ID."""
        post = await post_service.get_post(sample_post['post_id'])
        
        assert post is not None
        assert post.post_id == sample_post['post_id']
        assert post.content == sample_post['content']
    
    @pytest.mark.asyncio
    async def test_get_post_not_found(self, post_service):
        """Test getting a non-existent post."""
        post = await post_service.get_post("nonexistent_post")
        assert post is None
    
    @pytest.mark.asyncio
    async def test_update_post(self, post_service, sample_post):
        """Test updating a post."""
        update_data = PostUpdate(
            content="Updated content"
        )
        
        updated_post = await post_service.update_post(
            sample_post['post_id'],
            sample_post['user_id'],
            update_data
        )
        
        assert updated_post is not None
        assert updated_post.content == "Updated content"
    
    @pytest.mark.asyncio
    async def test_update_post_unauthorized(self, post_service, sample_post, test_db):
        """Test updating a post by non-owner."""
        # Create another user
        other_user_data = {
            "user_id": "other_user",
            "email": "other@example.com",
            "name": "Other User",
            "created_at": datetime.now()
        }
        await test_db.users.insert_one(other_user_data)
        
        update_data = PostUpdate(content="Updated content")
        
        with pytest.raises(ValueError, match="Not authorized"):
            await post_service.update_post(
                sample_post['post_id'],
                other_user_data['user_id'],
                update_data
            )
    
    @pytest.mark.asyncio
    async def test_delete_post(self, post_service, sample_post):
        """Test deleting a post."""
        success = await post_service.delete_post(
            sample_post['post_id'],
            sample_post['user_id']
        )
        
        assert success is True
        
        # Verify post is deleted
        post = await post_service.get_post(sample_post['post_id'])
        assert post is None
    
    @pytest.mark.asyncio
    async def test_delete_post_unauthorized(self, post_service, sample_post, test_db):
        """Test deleting a post by non-owner."""
        # Create another user
        other_user_data = {
            "user_id": "other_user",
            "email": "other@example.com",
            "name": "Other User",
            "created_at": datetime.now()
        }
        await test_db.users.insert_one(other_user_data)
        
        with pytest.raises(ValueError, match="Not authorized"):
            await post_service.delete_post(
                sample_post['post_id'],
                other_user_data['user_id']
            )
    
    @pytest.mark.asyncio
    async def test_like_post(self, post_service, sample_post, sample_user):
        """Test liking a post."""
        result = await post_service.like_post(
            sample_post['post_id'],
            sample_user['user_id']
        )
        
        assert result["status"] == "liked"
        
        # Check if liked
        is_liked = await post_service.is_post_liked(
            sample_post['post_id'],
            sample_user['user_id']
        )
        assert is_liked is True
    
    @pytest.mark.asyncio
    async def test_like_post_already_liked(self, post_service, sample_post, sample_user):
        """Test liking a post that is already liked."""
        # Like once
        await post_service.like_post(
            sample_post['post_id'],
            sample_user['user_id']
        )
        
        # Try to like again
        result = await post_service.like_post(
            sample_post['post_id'],
            sample_user['user_id']
        )
        assert result["status"] == "already_liked"
    
    @pytest.mark.asyncio
    async def test_unlike_post(self, post_service, sample_post, sample_user):
        """Test unliking a post."""
        # Like first
        await post_service.like_post(
            sample_post['post_id'],
            sample_user['user_id']
        )
        
        # Then unlike
        result = await post_service.unlike_post(
            sample_post['post_id'],
            sample_user['user_id']
        )
        assert result["status"] == "unliked"
        
        # Check if still liked
        is_liked = await post_service.is_post_liked(
            sample_post['post_id'],
            sample_user['user_id']
        )
        assert is_liked is False
    
    @pytest.mark.asyncio
    async def test_save_post(self, post_service, sample_post, sample_user):
        """Test saving a post."""
        result = await post_service.save_post(
            sample_post['post_id'],
            sample_user['user_id']
        )
        
        assert result["status"] == "saved"
    
    @pytest.mark.asyncio
    async def test_save_post_not_found(self, post_service, sample_user):
        """Test saving a non-existent post."""
        with pytest.raises(ValueError, match="Post not found"):
            await post_service.save_post(
                "nonexistent_post",
                sample_user['user_id']
            )
    
    @pytest.mark.asyncio
    async def test_get_saved_posts(self, post_service, sample_post, sample_user):
        """Test getting saved posts."""
        # Save a post
        await post_service.save_post(
            sample_post['post_id'],
            sample_user['user_id']
        )
        
        # Get saved posts
        saved_posts = await post_service.get_saved_posts(
            sample_user['user_id']
        )
        
        assert len(saved_posts) == 1
        assert saved_posts[0].post_id == sample_post['post_id']
    
    @pytest.mark.asyncio
    async def test_add_reaction(self, post_service, sample_post, sample_user):
        """Test adding a reaction to a post."""
        result = await post_service.add_reaction(
            sample_post['post_id'],
            sample_user['user_id'],
            "love"
        )
        
        assert result["status"] == "reacted"
        assert result["reaction_type"] == "love"
    
    @pytest.mark.asyncio
    async def test_share_post(self, post_service, sample_post):
        """Test sharing a post."""
        result = await post_service.share_post(sample_post['post_id'])
        assert result["status"] == "shared"
