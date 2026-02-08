import pytest
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock

import server
from server import app, require_auth, User


class DummyCursor:
    def __init__(self, results):
        self._results = results

    def sort(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    async def to_list(self, _limit):
        return self._results


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
    conversations = MagicMock()
    conversations.find = MagicMock(return_value=DummyCursor([
        {"conversation_id": "conv_123", "participants": ["user_123", "user_456"]},
    ]))

    users = MagicMock()
    users.find = MagicMock(return_value=DummyCursor([
        {"user_id": "user_456", "name": "Other User", "picture": None},
    ]))

    messages = MagicMock()
    messages.find = MagicMock(return_value=DummyCursor([
        {
            "message_id": "msg_1",
            "conversation_id": "conv_123",
            "sender_id": "user_456",
            "content": "Hello there",
            "created_at": datetime.now(timezone.utc),
        }
    ]))

    mock = MagicMock()
    mock.conversations = conversations
    mock.users = users
    mock.messages = messages

    monkeypatch.setattr(server, "db", mock)
    return mock


@pytest.mark.asyncio
async def test_search_messages_filters(mock_db, override_auth):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/messages/search",
            params={
                "q": "hello",
                "sender_id": "user_456",
                "start_date": "2026-02-01T00:00:00+00:00",
                "end_date": "2026-02-10T00:00:00+00:00",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data[0]["other_user"]["user_id"] == "user_456"
    query = mock_db.messages.find.call_args[0][0]
    assert query["sender_id"] == "user_456"
    assert "$regex" in query["content"]
    assert "$gte" in query["created_at"]
    assert "$lte" in query["created_at"]
