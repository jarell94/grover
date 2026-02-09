import pytest
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from types import SimpleNamespace
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
    users.find_one = AsyncMock()
    users.update_one = AsyncMock()

    tiers = MagicMock()
    tiers.find_one = AsyncMock()

    gifts = MagicMock()
    gifts.insert_one = AsyncMock()
    gifts.find_one = AsyncMock()
    gifts.update_one = AsyncMock()

    subscriptions = MagicMock()
    subscriptions.find_one = AsyncMock()
    subscriptions.insert_one = AsyncMock()

    notifications = MagicMock()
    notifications.insert_one = AsyncMock()

    mock = MagicMock()
    mock.users = users
    mock.subscription_tiers = tiers
    mock.gift_subscriptions = gifts
    mock.creator_subscriptions = subscriptions
    mock.notifications = notifications

    monkeypatch.setattr(server, "db", mock)
    return mock


@pytest.mark.asyncio
async def test_gift_subscription_creates_payment_intent(monkeypatch, mock_db, override_auth):
    monkeypatch.setattr(server, "STRIPE_SECRET_KEY", "sk_test")

    async def find_user(query, _projection=None):
        if query.get("user_id") == "creator_123":
            return {
                "user_id": "creator_123",
                "stripe_account_id": "acct_123",
                "email": "creator@example.com",
                "monetization_enabled": True,
            }
        if query.get("user_id") == override_auth.user_id:
            return {"user_id": override_auth.user_id, "stripe_customer_id": "cus_123", "email": override_auth.email}
        if query.get("email"):
            return {"user_id": "recipient_123", "email": query.get("email")}
        return None

    mock_db.users.find_one.side_effect = find_user
    mock_db.subscription_tiers.find_one.return_value = {
        "tier_id": "tier_123",
        "creator_id": "creator_123",
        "active": True,
        "price": 5.0,
        "name": "Gold",
    }
    mock_db.creator_subscriptions.find_one.return_value = None

    monkeypatch.setattr(server.stripe, "PaymentIntent", SimpleNamespace(
        create=lambda **_kwargs: SimpleNamespace(id="pi_123", client_secret="secret")
    ))
    customer_create = MagicMock()
    monkeypatch.setattr(server.stripe, "Customer", SimpleNamespace(create=customer_create))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/creators/creator_123/gift-subscriptions",
            json={
                "tier_id": "tier_123",
                "duration_months": 3,
                "recipient_email": "recipient@example.com",
                "gift_message": "Enjoy!"
            },
        )

    assert response.status_code == 200
    assert response.json()["client_secret"] == "secret"
    mock_db.gift_subscriptions.insert_one.assert_awaited()
    customer_create.assert_not_called()


@pytest.mark.asyncio
async def test_gift_subscription_redeem(monkeypatch, mock_db, override_auth):
    monkeypatch.setattr(server, "send_push_notification", AsyncMock())
    gift_record = {
        "gift_id": "gift_123",
        "creator_id": "creator_123",
        "tier_id": "tier_123",
        "duration_months": 2,
        "status": "paid",
        "giver_id": "giver_123",
        "recipient_user_id": override_auth.user_id,
    }
    mock_db.gift_subscriptions.find_one.return_value = gift_record
    mock_db.subscription_tiers.find_one.return_value = {
        "tier_id": "tier_123",
        "creator_id": "creator_123",
        "active": True,
        "price": 5.0,
        "name": "Gold",
    }
    mock_db.creator_subscriptions.find_one.return_value = None

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/subscriptions/gifts/gift_123/redeem")

    assert response.status_code == 200
    mock_db.creator_subscriptions.insert_one.assert_awaited()
    mock_db.gift_subscriptions.update_one.assert_awaited()
