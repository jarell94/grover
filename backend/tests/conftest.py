import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock, AsyncMock
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Provide default environment for server imports in tests
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017/?serverSelectionTimeoutMS=50")
os.environ.setdefault("DB_NAME", "grover_test")
os.environ.setdefault("ENABLE_METRICS", "true")

# Mock MongoDB before importing server
from unittest.mock import patch

# Create mock database
mock_db = MagicMock()
mock_db.users = MagicMock()
mock_db.posts = MagicMock()
mock_db.followers = MagicMock()
mock_db.notifications = MagicMock()
mock_db.messages = MagicMock()

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def client():
    """Create async test client."""
    from server import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def mock_user():
    """Create a mock user for testing."""
    return {
        "user_id": "user_test123",
        "email": "test@example.com",
        "name": "Test User",
        "picture": "https://example.com/pic.jpg",
        "bio": "Test bio",
        "is_premium": False,
        "is_private": False,
        "monetization_enabled": False
    }

@pytest.fixture
def auth_headers():
    """Create auth headers for testing."""
    return {"Authorization": "Bearer test-token-123"}
