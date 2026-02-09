import pytest
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock

import server
from server import app, require_auth, User


@pytest.fixture
def override_auth():
    user = User(
        user_id="user_123",
        email="user@example.com",
        name="Test User",
        created_at=datetime.now(timezone.utc),
    )
    app.dependency_overrides[require_auth] = lambda: user
    yield user
    app.dependency_overrides.pop(require_auth, None)


@pytest.fixture
def mock_db(monkeypatch):
    users = MagicMock()
    users.update_one = AsyncMock()
    mock = MagicMock()
    mock.users = users
    monkeypatch.setattr(server, "db", mock)
    return mock


@pytest.mark.asyncio
async def test_update_profile_social_links(override_auth, mock_db):
    payload = {
        "github": "octocat",
        "youtube": "@channel",
        "tiktok": "tiktokuser",
        "facebook": "fbuser",
        "snapchat": "snapuser",
        "discord": "123456789",
        "twitch": "twitchuser",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Endpoint accepts query parameters for profile fields.
        response = await client.put("/api/users/me", params=payload)

    assert response.status_code == 200
    update_doc = mock_db.users.update_one.call_args.args[1]["$set"]
    assert update_doc["github"] == "octocat"
    assert update_doc["youtube"] == "@channel"
    assert update_doc["tiktok"] == "tiktokuser"
    assert update_doc["facebook"] == "fbuser"
    assert update_doc["snapchat"] == "snapuser"
    assert update_doc["discord"] == "123456789"
    assert update_doc["twitch"] == "twitchuser"
