import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_auth_me_without_token(client: AsyncClient):
    """Test /auth/me without authentication."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_logout_without_token(client: AsyncClient):
    """Test logout without authentication."""
    response = await client.post("/api/auth/logout")
    # Logout should work even without auth (idempotent)
    assert response.status_code in [200, 401]
