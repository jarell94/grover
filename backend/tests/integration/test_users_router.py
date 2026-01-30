"""
Integration Tests for User Router

Tests the user endpoints with a test FastAPI client.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

# We need to create a test app with the user router
from routers.users import router as users_router


@pytest.fixture
def test_app():
    """Create a test FastAPI app"""
    app = FastAPI()
    app.include_router(users_router)
    return app


@pytest.mark.asyncio
async def test_get_user_endpoint(test_app, test_db, test_user, test_session):
    """Test GET /users/{user_id} endpoint"""
    # Arrange
    from core import database
    database._db = test_db  # Override database for testing
    
    headers = {"Authorization": f"Bearer {test_session['session_token']}"}
    
    # Act
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test"
    ) as client:
        response = await client.get(
            f"/users/{test_user['user_id']}", 
            headers=headers
        )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == test_user["user_id"]
    assert data["email"] == test_user["email"]
    assert data["name"] == test_user["name"]


@pytest.mark.asyncio
async def test_get_user_stats_endpoint(test_app, test_db, test_user, test_session):
    """Test GET /users/{user_id}/stats endpoint"""
    # Arrange
    from core import database
    database._db = test_db
    
    headers = {"Authorization": f"Bearer {test_session['session_token']}"}
    
    # Act
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test"
    ) as client:
        response = await client.get(
            f"/users/{test_user['user_id']}/stats", 
            headers=headers
        )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "posts" in data
    assert "followers" in data
    assert "following" in data
    assert data["posts"] == 0  # No posts in test fixture
    assert data["followers"] == 0
    assert data["following"] == 0


@pytest.mark.asyncio
async def test_update_profile_endpoint(test_app, test_db, test_user, test_session):
    """Test PUT /users/me endpoint"""
    # Arrange
    from core import database
    database._db = test_db
    
    headers = {"Authorization": f"Bearer {test_session['session_token']}"}
    update_data = {
        "name": "Updated Name",
        "bio": "Updated bio"
    }
    
    # Act
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test"
    ) as client:
        response = await client.put(
            "/users/me",
            params=update_data,
            headers=headers
        )
    
    # Assert
    assert response.status_code == 200
    assert response.json()["message"] == "Profile updated"
    
    # Verify changes in database
    updated_user = await test_db.users.find_one({"user_id": test_user["user_id"]})
    assert updated_user["name"] == update_data["name"]
    assert updated_user["bio"] == update_data["bio"]
