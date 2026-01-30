"""
Unit tests for UserService.
"""
import pytest
from datetime import datetime

from repositories.user_repository import UserRepository
from services.user_service import UserService
from schemas.user import UserCreate, UserUpdate, NotificationSettings


@pytest.mark.unit
@pytest.mark.service
class TestUserService:
    """Test suite for UserService."""
    
    @pytest.fixture
    async def user_service(self, test_db):
        """Create a UserService instance with test database."""
        user_repo = UserRepository(test_db)
        return UserService(user_repo)
    
    @pytest.mark.asyncio
    async def test_get_user(self, user_service, sample_user):
        """Test getting a user by ID."""
        user = await user_service.get_user(sample_user['user_id'])
        
        assert user is not None
        assert user.user_id == sample_user['user_id']
        assert user.email == sample_user['email']
        assert user.name == sample_user['name']
    
    @pytest.mark.asyncio
    async def test_get_user_not_found(self, user_service):
        """Test getting a non-existent user."""
        user = await user_service.get_user("nonexistent_user")
        assert user is None
    
    @pytest.mark.asyncio
    async def test_update_profile(self, user_service, sample_user):
        """Test updating user profile."""
        update_data = UserUpdate(
            name="Updated Name",
            bio="Updated bio"
        )
        
        updated_user = await user_service.update_profile(
            sample_user['user_id'],
            update_data
        )
        
        assert updated_user is not None
        assert updated_user.name == "Updated Name"
        assert updated_user.bio == "Updated bio"
    
    @pytest.mark.asyncio
    async def test_follow_user(self, user_service, test_db):
        """Test following a user."""
        # Create two users
        user1_data = {
            "user_id": "user1",
            "email": "user1@example.com",
            "name": "User 1",
            "created_at": datetime.now()
        }
        user2_data = {
            "user_id": "user2",
            "email": "user2@example.com",
            "name": "User 2",
            "created_at": datetime.now()
        }
        
        await test_db.users.insert_one(user1_data)
        await test_db.users.insert_one(user2_data)
        
        # User1 follows User2
        result = await user_service.follow_user("user1", "user2")
        assert result["status"] == "followed"
        
        # Check if following
        is_following = await user_service.is_following("user1", "user2")
        assert is_following is True
    
    @pytest.mark.asyncio
    async def test_follow_user_already_following(self, user_service, test_db):
        """Test following a user that is already followed."""
        # Create two users
        user1_data = {
            "user_id": "user1",
            "email": "user1@example.com",
            "name": "User 1",
            "created_at": datetime.now()
        }
        user2_data = {
            "user_id": "user2",
            "email": "user2@example.com",
            "name": "User 2",
            "created_at": datetime.now()
        }
        
        await test_db.users.insert_one(user1_data)
        await test_db.users.insert_one(user2_data)
        
        # Follow once
        await user_service.follow_user("user1", "user2")
        
        # Try to follow again
        result = await user_service.follow_user("user1", "user2")
        assert result["status"] == "already_following"
    
    @pytest.mark.asyncio
    async def test_follow_self(self, user_service, sample_user):
        """Test that user cannot follow themselves."""
        with pytest.raises(ValueError, match="Cannot follow yourself"):
            await user_service.follow_user(
                sample_user['user_id'],
                sample_user['user_id']
            )
    
    @pytest.mark.asyncio
    async def test_unfollow_user(self, user_service, test_db):
        """Test unfollowing a user."""
        # Create two users
        user1_data = {
            "user_id": "user1",
            "email": "user1@example.com",
            "name": "User 1",
            "created_at": datetime.now()
        }
        user2_data = {
            "user_id": "user2",
            "email": "user2@example.com",
            "name": "User 2",
            "created_at": datetime.now()
        }
        
        await test_db.users.insert_one(user1_data)
        await test_db.users.insert_one(user2_data)
        
        # Follow first
        await user_service.follow_user("user1", "user2")
        
        # Then unfollow
        result = await user_service.unfollow_user("user1", "user2")
        assert result["status"] == "unfollowed"
        
        # Check if still following
        is_following = await user_service.is_following("user1", "user2")
        assert is_following is False
    
    @pytest.mark.asyncio
    async def test_get_user_stats(self, user_service, sample_user, test_db):
        """Test getting user statistics."""
        # Create a post for the user
        post_data = {
            "post_id": "post1",
            "user_id": sample_user['user_id'],
            "content": "Test post",
            "created_at": datetime.now()
        }
        await test_db.posts.insert_one(post_data)
        
        # Get stats
        stats = await user_service.get_user_stats(sample_user['user_id'])
        
        assert stats is not None
        assert "followers_count" in stats
        assert "following_count" in stats
        assert "posts_count" in stats
        assert stats["posts_count"] == 1
    
    @pytest.mark.asyncio
    async def test_update_notification_settings(self, user_service, sample_user):
        """Test updating notification settings."""
        settings = NotificationSettings(
            notify_followers=False,
            notify_likes=False
        )
        
        updated_user = await user_service.update_notification_settings(
            sample_user['user_id'],
            settings
        )
        
        assert updated_user is not None
        assert updated_user.notify_followers is False
        assert updated_user.notify_likes is False
        # Other settings should remain unchanged
        assert updated_user.notify_comments is True
