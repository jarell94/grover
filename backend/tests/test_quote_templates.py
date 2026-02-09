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
    posts = MagicMock()
    posts.insert_one = AsyncMock()

    mock = MagicMock()
    mock.posts = posts
    monkeypatch.setattr(server, "db", mock)
    return mock


@pytest.mark.asyncio
async def test_create_post_with_template(override_auth, mock_db):
    payload = {
        "content": "Celebrating today!",
        "template_type": "celebration",
        "template_style": '{"background_color":"#111111","text_color":"#ffffff","font_family":"serif"}',
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/posts", data=payload)

    assert response.status_code == 200
    inserted = mock_db.posts.insert_one.call_args.args[0]
    assert inserted["template_type"] == "celebration"
    assert inserted["template_style"]["background_color"] == "#111111"


@pytest.mark.asyncio
async def test_create_post_invalid_template_type(override_auth, mock_db):
    payload = {"content": "Test", "template_type": "invalid"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/posts", data=payload)

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_post_invalid_template_style(override_auth, mock_db):
    payload = {
        "content": "Test",
        "template_type": "announcement",
        "template_style": "{not-json}",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/posts", data=payload)

    assert response.status_code == 400
