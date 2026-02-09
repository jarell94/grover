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
    app.dependency_overrides = {}


@pytest.fixture
def mock_db(monkeypatch):
    users = MagicMock()
    users.find_one = AsyncMock()
    users.update_one = AsyncMock()

    mock = MagicMock()
    mock.users = users

    monkeypatch.setattr(server, "db", mock)
    return mock


@pytest.mark.asyncio
async def test_stripe_connect_account(monkeypatch, mock_db, override_auth):
    monkeypatch.setattr(server, "STRIPE_SECRET_KEY", "sk_test")
    mock_db.users.find_one.return_value = {
        "user_id": override_auth.user_id,
        "email": override_auth.email,
        "name": override_auth.name,
    }

    monkeypatch.setattr(server.stripe, "Account", SimpleNamespace(
        create=lambda **_kwargs: SimpleNamespace(id="acct_123"),
        retrieve=lambda _id: SimpleNamespace(
            charges_enabled=False,
            payouts_enabled=False,
            details_submitted=False
        ),
    ))
    monkeypatch.setattr(server.stripe, "AccountLink", SimpleNamespace(
        create=lambda **_kwargs: SimpleNamespace(url="https://stripe.test/link")
    ))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/stripe/connect/account")

    assert response.status_code == 200
    payload = response.json()
    assert payload["account_id"] == "acct_123"
    assert payload["url"] == "https://stripe.test/link"
    mock_db.users.update_one.assert_awaited()


@pytest.mark.asyncio
async def test_stripe_setup_intent(monkeypatch, mock_db, override_auth):
    monkeypatch.setattr(server, "STRIPE_SECRET_KEY", "sk_test")
    mock_db.users.find_one.return_value = {
        "user_id": override_auth.user_id,
        "email": override_auth.email,
        "name": override_auth.name,
    }

    monkeypatch.setattr(server.stripe, "Customer", SimpleNamespace(
        create=lambda **_kwargs: SimpleNamespace(id="cus_123"),
    ))
    monkeypatch.setattr(server.stripe, "SetupIntent", SimpleNamespace(
        create=lambda **_kwargs: SimpleNamespace(client_secret="seti_secret"),
    ))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/stripe/payment-methods/setup-intent")

    assert response.status_code == 200
    assert response.json()["client_secret"] == "seti_secret"


@pytest.mark.asyncio
async def test_stripe_connect_account_existing(monkeypatch, mock_db, override_auth):
    monkeypatch.setattr(server, "STRIPE_SECRET_KEY", "sk_test")
    mock_db.users.find_one.return_value = {
        "user_id": override_auth.user_id,
        "email": override_auth.email,
        "name": override_auth.name,
        "stripe_account_id": "acct_existing",
    }

    account_create = MagicMock()
    monkeypatch.setattr(server.stripe, "Account", SimpleNamespace(
        create=account_create,
    ))
    monkeypatch.setattr(server.stripe, "AccountLink", SimpleNamespace(
        create=lambda **_kwargs: SimpleNamespace(url="https://stripe.test/link")
    ))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/stripe/connect/account")

    assert response.status_code == 200
    payload = response.json()
    assert payload["account_id"] == "acct_existing"
    account_create.assert_not_called()
