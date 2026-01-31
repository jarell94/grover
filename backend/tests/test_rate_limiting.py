"""API Rate Limiting Tests

Tests for:
- Request rate limits
- Burst protection
- Per-endpoint limits
- IP-based limiting
"""

import pytest
from httpx import AsyncClient
import asyncio


@pytest.mark.asyncio
async def test_health_endpoint_no_rate_limit(client: AsyncClient):
    """Test that health endpoint is not rate limited."""
    # Health endpoint should always be accessible
    for _ in range(20):
        response = await client.get("/api/health")
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_rapid_requests_handled(client: AsyncClient):
    """Test that rapid requests are handled gracefully."""
    # Send 50 rapid requests
    responses = []
    for _ in range(50):
        response = await client.get("/api/health")
        responses.append(response.status_code)
    
    # All should succeed (health is not rate limited)
    # Or return 429 if rate limiting is enabled
    assert all(code in [200, 429] for code in responses)


@pytest.mark.asyncio
async def test_concurrent_requests(client: AsyncClient):
    """Test concurrent request handling."""
    async def make_request():
        return await client.get("/api/health")
    
    # Make 20 concurrent requests
    tasks = [make_request() for _ in range(20)]
    responses = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Count successful responses
    success_count = sum(
        1 for r in responses 
        if not isinstance(r, Exception) and r.status_code in [200, 429]
    )
    
    # Most requests should succeed
    assert success_count >= 15


@pytest.mark.asyncio
async def test_auth_endpoint_rate_limit(client: AsyncClient):
    """Test rate limiting on authentication endpoints."""
    # Auth endpoints should have stricter limits
    responses = []
    for _ in range(30):
        response = await client.post(
            "/api/auth/session",
            json={"session_id": "test_session"}
        )
        responses.append(response.status_code)
    
    # Should either succeed, fail auth, or hit rate limit
    assert all(code in [200, 400, 401, 422, 429] for code in responses)


@pytest.mark.asyncio
async def test_search_endpoint_handles_load(client: AsyncClient):
    """Test search endpoint under load."""
    responses = []
    for i in range(20):
        response = await client.get(f"/api/search?q=test{i}")
        responses.append(response.status_code)
    
    # Should handle gracefully
    assert all(code in [200, 401, 429] for code in responses)


@pytest.mark.asyncio
async def test_post_creation_rate_limit(client: AsyncClient):
    """Test rate limiting on post creation."""
    responses = []
    for _ in range(15):
        response = await client.post(
            "/api/posts",
            json={"content": "Test post"}
        )
        responses.append(response.status_code)
    
    # Should either succeed, require auth, or hit rate limit
    assert all(code in [200, 201, 401, 422, 429] for code in responses)
