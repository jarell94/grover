import pytest
from datetime import datetime, timedelta, timezone
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
    app.dependency_overrides = {}


@pytest.fixture
def mock_db(monkeypatch):
    messages = MagicMock()
    messages.find_one = AsyncMock()
    messages.update_one = AsyncMock()

    conversations = MagicMock()
    conversations.find_one = AsyncMock()
    conversations.update_one = AsyncMock()

    mock = MagicMock()
    mock.messages = messages
    mock.conversations = conversations

    monkeypatch.setattr(server, "db", mock)
    return mock


@pytest.mark.asyncio
async def test_edit_message_updates_content(mock_db, override_auth):
    now = datetime.now(timezone.utc)
    mock_db.messages.find_one.return_value = {
        "message_id": "msg_123",
        "conversation_id": "conv_123",
        "sender_id": override_auth.user_id,
        "content": "Hello",
        "created_at": now - timedelta(minutes=5),
    }
    mock_db.conversations.find_one.return_value = {
        "conversation_id": "conv_123",
        "last_message": "Hello",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.patch("/api/messages/msg_123", json={"content": "Updated"})

    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Updated"
    assert data["edited_at"]
    mock_db.messages.update_one.assert_awaited()


@pytest.mark.asyncio
async def test_edit_message_rejects_expired(mock_db, override_auth):
    mock_db.messages.find_one.return_value = {
        "message_id": "msg_123",
        "conversation_id": "conv_123",
        "sender_id": override_auth.user_id,
        "content": "Hello",
        "created_at": datetime.now(timezone.utc) - timedelta(minutes=20),
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.patch("/api/messages/msg_123", json={"content": "Updated"})

    assert response.status_code == 400
    assert "Edit window expired" in response.json().get("detail", "")
    mock_db.messages.update_one.assert_not_awaited()
