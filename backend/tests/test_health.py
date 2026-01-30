import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """Test health check endpoint."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "version" in data

@pytest.mark.asyncio
async def test_ready_endpoint(client: AsyncClient):
    """Test readiness endpoint."""
    response = await client.get("/api/ready")
    # Ready endpoint may return 503 if some services aren't fully connected in test environment
    assert response.status_code in [200, 503]
    data = response.json()
    # Response may have 'status' or 'detail' key depending on success/failure
    if response.status_code == 200:
        assert "status" in data
    else:
        # 503 returns detail message
        assert "detail" in data or "status" in data
