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
    monkeypatch.setattr(server.sio, "emit", AsyncMock())
    return mock


@pytest.mark.asyncio
async def test_delete_for_everyone_success(mock_db, override_auth):
    mock_db.messages.find_one.return_value = {
        "message_id": "msg_123",
        "conversation_id": "conv_123",
        "sender_id": override_auth.user_id,
        "content": "Hello",
        "read": False,
        "created_at": datetime.now(timezone.utc) - timedelta(minutes=10),
    }
    mock_db.conversations.find_one.return_value = {"last_message": "Hello"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/messages/msg_123/delete", json={"delete_for_everyone": True})

    assert response.status_code == 200
    mock_db.messages.update_one.assert_awaited()
    args, _kwargs = mock_db.messages.update_one.await_args
    assert args[0] == {"message_id": "msg_123"}
    assert args[1]["$set"]["deleted_for_everyone"] is True


@pytest.mark.asyncio
async def test_delete_for_everyone_blocked_when_read(mock_db, override_auth):
    mock_db.messages.find_one.return_value = {
        "message_id": "msg_123",
        "conversation_id": "conv_123",
        "sender_id": override_auth.user_id,
        "content": "Hello",
        "read": True,
        "created_at": datetime.now(timezone.utc) - timedelta(minutes=5),
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/messages/msg_123/delete", json={"delete_for_everyone": True})

    assert response.status_code == 400
    mock_db.messages.update_one.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_for_self(mock_db, override_auth):
    mock_db.messages.find_one.return_value = {
        "message_id": "msg_456",
        "sender_id": "other_user",
        "content": "Hello",
        "created_at": datetime.now(timezone.utc),
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/messages/msg_456/delete", json={"delete_for_everyone": False})

    assert response.status_code == 200
    args, _kwargs = mock_db.messages.update_one.await_args
    assert args[1]["$addToSet"]["deleted_for"] == override_auth.user_id


@pytest.mark.asyncio
async def test_delete_for_everyone_requires_sender(mock_db, override_auth):
    mock_db.messages.find_one.return_value = {
        "message_id": "msg_789",
        "conversation_id": "conv_123",
        "sender_id": "other_user",
        "content": "Hello",
        "created_at": datetime.now(timezone.utc),
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/messages/msg_789/delete", json={"delete_for_everyone": True})

    assert response.status_code == 403
    mock_db.messages.update_one.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_for_everyone_expired(mock_db, override_auth):
    mock_db.messages.find_one.return_value = {
        "message_id": "msg_999",
        "conversation_id": "conv_123",
        "sender_id": override_auth.user_id,
        "content": "Hello",
        "read": False,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=2),
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/messages/msg_999/delete", json={"delete_for_everyone": True})

    assert response.status_code == 400
    mock_db.messages.update_one.assert_not_awaited()
