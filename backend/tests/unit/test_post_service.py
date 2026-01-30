"""
Unit Tests for Post Service

Tests the business logic in the post service layer.
"""
import pytest
from datetime import datetime, timezone

from services.posts import PostService
from repositories.posts import PostRepository


@pytest.mark.asyncio
async def test_get_post(test_db, test_post):
    """Test getting a post by ID"""
    # Arrange
    post_repo = PostRepository(test_db.posts)
    post_service = PostService(post_repo)
    
    # Act
    post = await post_service.get_post(test_post["post_id"])
    
    # Assert
    assert post is not None
    assert post.post_id == test_post["post_id"]
    assert post.user_id == test_post["user_id"]
    assert post.content == test_post["content"]


@pytest.mark.asyncio
async def test_get_post_not_found(test_db):
    """Test getting a non-existent post"""
    # Arrange
    post_repo = PostRepository(test_db.posts)
    post_service = PostService(post_repo)
    
    # Act
    post = await post_service.get_post("nonexistent_post")
    
    # Assert
    assert post is None


@pytest.mark.asyncio
async def test_get_user_posts(test_db, test_user, test_post):
    """Test getting posts by user"""
    # Arrange
    post_repo = PostRepository(test_db.posts)
    post_service = PostService(post_repo)
    
    # Act
    posts = await post_service.get_user_posts(test_user["user_id"])
    
    # Assert
    assert len(posts) == 1
    assert posts[0].post_id == test_post["post_id"]
    assert posts[0].user_id == test_user["user_id"]


@pytest.mark.asyncio
async def test_create_post(test_db, test_user):
    """Test creating a new post"""
    # Arrange
    post_repo = PostRepository(test_db.posts)
    post_service = PostService(post_repo)
    
    post_data = {
        "user_id": test_user["user_id"],
        "content": "New test post",
        "media_url": None,
        "media_type": None
    }
    
    # Act
    post = await post_service.create_post(post_data)
    
    # Assert
    assert post is not None
    assert post.post_id is not None  # Should be auto-generated
    assert post.user_id == test_user["user_id"]
    assert post.content == post_data["content"]
    assert post.likes_count == 0
    assert post.comments_count == 0
    assert post.created_at is not None
    
    # Verify post was saved to database
    saved_post = await post_service.get_post(post.post_id)
    assert saved_post is not None


@pytest.mark.asyncio
async def test_update_post(test_db, test_post):
    """Test updating a post"""
    # Arrange
    post_repo = PostRepository(test_db.posts)
    post_service = PostService(post_repo)
    
    update_data = {
        "content": "Updated content"
    }
    
    # Act
    success = await post_service.update_post(test_post["post_id"], update_data)
    
    # Assert
    assert success is True
    
    # Verify changes were saved
    updated_post = await post_service.get_post(test_post["post_id"])
    assert updated_post.content == update_data["content"]


@pytest.mark.asyncio
async def test_delete_post(test_db, test_post):
    """Test deleting a post"""
    # Arrange
    post_repo = PostRepository(test_db.posts)
    post_service = PostService(post_repo)
    
    # Act
    success = await post_service.delete_post(test_post["post_id"])
    
    # Assert
    assert success is True
    
    # Verify post was deleted
    deleted_post = await post_service.get_post(test_post["post_id"])
    assert deleted_post is None


@pytest.mark.asyncio
async def test_increment_likes(test_db, test_post):
    """Test incrementing post likes"""
    # Arrange
    post_repo = PostRepository(test_db.posts)
    post_service = PostService(post_repo)
    
    # Act
    success = await post_service.increment_likes(test_post["post_id"])
    
    # Assert
    assert success is True
    
    # Verify likes count was incremented
    updated_post = await post_service.get_post(test_post["post_id"])
    assert updated_post.likes_count == 1


@pytest.mark.asyncio
async def test_count_user_posts(test_db, test_user, test_post):
    """Test counting user posts"""
    # Arrange
    post_repo = PostRepository(test_db.posts)
    post_service = PostService(post_repo)
    
    # Act
    count = await post_service.count_user_posts(test_user["user_id"])
    
    # Assert
    assert count == 1
