import pytest
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock

import server
from server import app, require_auth, User


def set_auth(user: User):
    app.dependency_overrides[require_auth] = lambda: user


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides = {}


@pytest.fixture
def mock_db(monkeypatch):
    users = MagicMock()
    users.find_one = AsyncMock()

    subscription_tiers = MagicMock()
    subscription_tiers.find_one = AsyncMock()

    creator_subscriptions = MagicMock()
    creator_subscriptions.find_one = AsyncMock()
    creator_subscriptions.insert_one = AsyncMock()

    gift_subscriptions = MagicMock()
    gift_subscriptions.insert_one = AsyncMock()
    gift_subscriptions.find_one = AsyncMock()
    gift_subscriptions.update_one = AsyncMock()

    mock = MagicMock()
    mock.users = users
    mock.subscription_tiers = subscription_tiers
    mock.creator_subscriptions = creator_subscriptions
    mock.gift_subscriptions = gift_subscriptions

    monkeypatch.setattr(server, "db", mock)
    return mock


@pytest.mark.asyncio
async def test_gift_subscription_by_username(monkeypatch, mock_db):
    giver = User(
        user_id="user_giver",
        email="giver@example.com",
        name="Giver",
        created_at=datetime.now(timezone.utc),
    )
    set_auth(giver)

    monkeypatch.setattr(server, "check_monetization_enabled", AsyncMock())
    monkeypatch.setattr(server, "create_and_send_notification", AsyncMock())

    mock_db.subscription_tiers.find_one.return_value = {
        "tier_id": "tier_123",
        "creator_id": "creator_1",
        "price": 5.0,
        "name": "Supporter",
        "active": True,
    }
    mock_db.users.find_one.return_value = {
        "user_id": "recipient_1",
        "email": "recipient@example.com",
        "name": "Recipient",
    }
    mock_db.creator_subscriptions.find_one.return_value = None

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/creators/creator_1/gift-subscriptions",
            json={"tier_id": "tier_123", "recipient_username": "recipient_1", "gift_message": "Enjoy!"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "pending"
    mock_db.gift_subscriptions.insert_one.assert_awaited()


@pytest.mark.asyncio
async def test_redeem_gift_subscription(monkeypatch, mock_db):
    recipient = User(
        user_id="recipient_1",
        email="recipient@example.com",
        name="Recipient",
        created_at=datetime.now(timezone.utc),
    )
    set_auth(recipient)

    monkeypatch.setattr(server, "record_transaction", AsyncMock())
    monkeypatch.setattr(server, "create_and_send_notification", AsyncMock())

    mock_db.gift_subscriptions.find_one.return_value = {
        "gift_id": "gift_123",
        "giver_id": "user_giver",
        "creator_id": "creator_1",
        "tier_id": "tier_123",
        "recipient_user_id": "recipient_1",
        "recipient_email": "recipient@example.com",
        "status": "pending",
    }
    mock_db.subscription_tiers.find_one.return_value = {
        "tier_id": "tier_123",
        "creator_id": "creator_1",
        "price": 5.0,
        "name": "Supporter",
        "active": True,
    }
    mock_db.creator_subscriptions.find_one.return_value = None

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/subscriptions/gifts/gift_123/redeem")

    assert response.status_code == 200
    assert response.json()["status"] == "active"
    mock_db.creator_subscriptions.insert_one.assert_awaited()
    mock_db.gift_subscriptions.update_one.assert_awaited()
