"""
Unit Tests for User Service

Tests the business logic in the user service layer.
"""
import pytest
from datetime import datetime, timezone

from services.users import UserService
from repositories.users import UserRepository


@pytest.mark.asyncio
async def test_get_user(test_db, test_user):
    """Test getting a user by ID"""
    # Arrange
    user_repo = UserRepository(test_db.users)
    user_service = UserService(user_repo)
    
    # Act
    user = await user_service.get_user(test_user["user_id"])
    
    # Assert
    assert user is not None
    assert user.user_id == test_user["user_id"]
    assert user.email == test_user["email"]
    assert user.name == test_user["name"]


@pytest.mark.asyncio
async def test_get_user_not_found(test_db):
    """Test getting a non-existent user"""
    # Arrange
    user_repo = UserRepository(test_db.users)
    user_service = UserService(user_repo)
    
    # Act
    user = await user_service.get_user("nonexistent_user")
    
    # Assert
    assert user is None


@pytest.mark.asyncio
async def test_get_user_by_email(test_db, test_user):
    """Test getting a user by email"""
    # Arrange
    user_repo = UserRepository(test_db.users)
    user_service = UserService(user_repo)
    
    # Act
    user = await user_service.get_user_by_email(test_user["email"])
    
    # Assert
    assert user is not None
    assert user.user_id == test_user["user_id"]
    assert user.email == test_user["email"]


@pytest.mark.asyncio
async def test_create_user(test_db):
    """Test creating a new user"""
    # Arrange
    user_repo = UserRepository(test_db.users)
    user_service = UserService(user_repo)
    
    user_data = {
        "user_id": "new_user_123",
        "email": "newuser@example.com",
        "name": "New User",
        "bio": "",
        "is_premium": False,
        "is_private": False
    }
    
    # Act
    user = await user_service.create_user(user_data)
    
    # Assert
    assert user is not None
    assert user.user_id == user_data["user_id"]
    assert user.email == user_data["email"]
    assert user.created_at is not None
    
    # Verify user was saved to database
    saved_user = await user_service.get_user(user_data["user_id"])
    assert saved_user is not None
    assert saved_user.user_id == user_data["user_id"]


@pytest.mark.asyncio
async def test_update_profile(test_db, test_user):
    """Test updating user profile"""
    # Arrange
    user_repo = UserRepository(test_db.users)
    user_service = UserService(user_repo)
    
    update_data = {
        "name": "Updated Name",
        "bio": "Updated bio",
        "is_private": True
    }
    
    # Act
    success = await user_service.update_profile(test_user["user_id"], update_data)
    
    # Assert
    assert success is True
    
    # Verify changes were saved
    updated_user = await user_service.get_user(test_user["user_id"])
    assert updated_user.name == update_data["name"]
    assert updated_user.bio == update_data["bio"]
    assert updated_user.is_private == update_data["is_private"]


@pytest.mark.asyncio
async def test_update_notification_settings(test_db, test_user):
    """Test updating notification settings"""
    # Arrange
    user_repo = UserRepository(test_db.users)
    user_service = UserService(user_repo)
    
    settings = {
        "notify_followers": False,
        "notify_likes": False,
        "notify_comments": True
    }
    
    # Act
    success = await user_service.update_notification_settings(test_user["user_id"], settings)
    
    # Assert
    assert success is True
    
    # Verify changes were saved
    updated_user = await user_service.get_user(test_user["user_id"])
    assert updated_user.notify_followers is False
    assert updated_user.notify_likes is False
    assert updated_user.notify_comments is True
