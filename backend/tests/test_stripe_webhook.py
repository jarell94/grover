import pytest
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import server
from server import app


@pytest.fixture
def mock_db(monkeypatch):
    tips = MagicMock()
    tips.update_one = AsyncMock()

    orders = MagicMock()
    orders.update_one = AsyncMock()

    subscriptions = MagicMock()
    subscriptions.find_one = AsyncMock(return_value=None)
    subscriptions.update_one = AsyncMock()

    mock = MagicMock()
    mock.tips = tips
    mock.orders = orders
    mock.creator_subscriptions = subscriptions

    monkeypatch.setattr(server, "db", mock)
    return mock


@pytest.mark.asyncio
async def test_stripe_webhook_tip_payment(monkeypatch, mock_db):
    monkeypatch.setattr(server, "STRIPE_SECRET_KEY", "sk_test")
    monkeypatch.setattr(server, "STRIPE_WEBHOOK_SECRET", "whsec_test")

    event = {
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": "pi_123",
                "metadata": {
                    "type": "tip",
                    "tip_id": "tip_123",
                    "from_user_id": "user_1",
                    "to_user_id": "user_2",
                    "amount": "5.00",
                },
            }
        },
    }

    monkeypatch.setattr(server.stripe, "Webhook", SimpleNamespace(
        construct_event=lambda *_args, **_kwargs: event
    ))
    monkeypatch.setattr(server, "record_transaction", AsyncMock())
    monkeypatch.setattr(server, "create_and_send_notification", AsyncMock())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/stripe/webhook", content=b"{}", headers={"stripe-signature": "sig"})

    assert response.status_code == 200
    mock_db.tips.update_one.assert_awaited()
    server.record_transaction.assert_awaited()
