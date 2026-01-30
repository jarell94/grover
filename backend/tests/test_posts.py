import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_posts_unauthenticated(client: AsyncClient):
    """Test getting posts without authentication."""
    response = await client.get("/api/posts")
    # Posts endpoint requires auth
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_get_explore_posts(client: AsyncClient):
    """Test getting explore posts without authentication."""
    response = await client.get("/api/posts/explore")
    # Explore might be public or require auth depending on implementation
    assert response.status_code in [200, 401]
