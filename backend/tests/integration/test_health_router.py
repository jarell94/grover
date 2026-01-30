"""
Integration Tests for Health Router

Tests the health check endpoints.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

from routers.health import router as health_router


@pytest.fixture
def test_app():
    """Create a test FastAPI app"""
    app = FastAPI()
    app.include_router(health_router)
    return app


@pytest.mark.asyncio
async def test_health_check_endpoint(test_app, test_db):
    """Test GET /health endpoint"""
    # Arrange
    from core import database
    database._db = test_db
    
    # Act
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test"
    ) as client:
        response = await client.get("/health")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "timestamp" in data
    assert "version" in data
    assert "services" in data
    assert "mongodb" in data["services"]


@pytest.mark.asyncio
async def test_readiness_check_endpoint(test_app, test_db):
    """Test GET /ready endpoint"""
    # Arrange
    from core import database
    database._db = test_db
    
    # Act
    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://test"
    ) as client:
        response = await client.get("/ready")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
