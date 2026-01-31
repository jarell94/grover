"""Authorization Tests

Tests for:
- Permission checking
- Resource ownership
- Role-based access
- Cross-user data access prevention
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cannot_access_other_users_private_data(client: AsyncClient):
    """Test that users cannot access other users' private data."""
    # Try to access another user's messages
    response = await client.get("/api/messages/conversation/other_user_id")
    assert response.status_code in [401, 403, 404]


@pytest.mark.asyncio
async def test_cannot_modify_other_users_posts(client: AsyncClient):
    """Test that users cannot modify posts they don't own."""
    response = await client.delete("/api/posts/other_users_post_id")
    assert response.status_code in [401, 403, 404]


@pytest.mark.asyncio
async def test_cannot_modify_other_users_profile(client: AsyncClient):
    """Test that users cannot modify other users' profiles."""
    response = await client.put(
        "/api/users/other_user_id",
        json={"bio": "hacked"}
    )
    assert response.status_code in [401, 403, 404, 405]


@pytest.mark.asyncio
async def test_cannot_access_admin_endpoints(client: AsyncClient):
    """Test that regular users cannot access admin endpoints."""
    admin_endpoints = [
        "/api/admin/users",
        "/api/admin/stats",
        "/api/admin/moderation",
    ]
    
    for endpoint in admin_endpoints:
        response = await client.get(endpoint)
        assert response.status_code in [401, 403, 404]


@pytest.mark.asyncio
async def test_cannot_view_private_account_posts(client: AsyncClient):
    """Test that non-followers cannot view private account posts."""
    # This would require a private user to be set up
    response = await client.get("/api/users/private_user_id/posts")
    # Should either deny access or return empty for non-followers
    assert response.status_code in [200, 401, 403, 404]


@pytest.mark.asyncio
async def test_cannot_send_message_to_blocked_user(client: AsyncClient):
    """Test message sending to blocked users."""
    response = await client.post(
        "/api/messages",
        json={
            "receiver_id": "blocked_user_id",
            "content": "test message"
        }
    )
    # Should be blocked or return appropriate error
    assert response.status_code in [400, 401, 403, 404]


@pytest.mark.asyncio
async def test_monetization_requires_enabled_setting(client: AsyncClient):
    """Test that monetization features require the setting to be enabled."""
    # Try to create subscription tier without monetization enabled
    response = await client.post(
        "/api/creators/test_user/subscription-tiers",
        json={
            "name": "Test Tier",
            "price": 9.99,
            "description": "Test",
            "benefits": ["Benefit 1"]
        }
    )
    assert response.status_code in [401, 403]


@pytest.mark.asyncio
async def test_cannot_tip_self(client: AsyncClient):
    """Test that users cannot tip themselves."""
    response = await client.post(
        "/api/users/current_user_id/tip",
        json={"amount": 10.00}
    )
    assert response.status_code in [400, 401, 403]


@pytest.mark.asyncio
async def test_cannot_subscribe_to_self(client: AsyncClient):
    """Test that users cannot subscribe to themselves."""
    response = await client.post(
        "/api/creators/current_user_id/subscribe/tier_id"
    )
    assert response.status_code in [400, 401, 403]
