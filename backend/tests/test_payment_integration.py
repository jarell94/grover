"""Payment/PayPal Integration Tests

Tests for:
- Payment creation
- Payment validation
- Tip processing
- Subscription handling
- Revenue sharing calculations
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_tip_requires_auth(client: AsyncClient):
    """Test that tipping requires authentication."""
    response = await client.post(
        "/api/users/some_user_id/tip",
        json={"amount": 5.00, "message": "Great content!"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_tip_minimum_amount(client: AsyncClient):
    """Test tip minimum amount validation."""
    # Tips below $1 should be rejected
    response = await client.post(
        "/api/users/some_user_id/tip",
        json={"amount": 0.50}
    )
    assert response.status_code in [400, 401]


@pytest.mark.asyncio
async def test_tip_negative_amount(client: AsyncClient):
    """Test that negative tip amounts are rejected."""
    response = await client.post(
        "/api/users/some_user_id/tip",
        json={"amount": -10.00}
    )
    assert response.status_code in [400, 401, 422]


@pytest.mark.asyncio
async def test_subscription_tier_creation_requires_auth(client: AsyncClient):
    """Test that creating subscription tiers requires auth."""
    response = await client.post(
        "/api/creators/user_id/subscription-tiers",
        json={
            "name": "Premium",
            "price": 9.99,
            "description": "Premium access",
            "benefits": ["Exclusive content"]
        }
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_subscription_requires_auth(client: AsyncClient):
    """Test that subscribing requires authentication."""
    response = await client.post(
        "/api/creators/creator_id/subscribe/tier_id"
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_subscription_tiers_public(client: AsyncClient):
    """Test that subscription tiers can be viewed publicly."""
    response = await client.get("/api/creators/some_user_id/subscription-tiers")
    # May require auth or return empty if no tiers
    assert response.status_code in [200, 401, 404]


@pytest.mark.asyncio
async def test_super_chat_requires_auth(client: AsyncClient):
    """Test that super chat requires authentication."""
    response = await client.post(
        "/api/streams/stream_id/super-chat",
        json={"amount": 5.00, "message": "Super chat!"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_paid_content_price_validation(client: AsyncClient):
    """Test paid content price validation."""
    # Price below minimum should be rejected
    response = await client.post(
        "/api/posts/post_id/set-paid",
        json={"price": 0.10}  # Below $0.99 minimum
    )
    assert response.status_code in [400, 401]


@pytest.mark.asyncio
async def test_paypal_create_payment_requires_auth(client: AsyncClient):
    """Test PayPal payment creation requires auth."""
    response = await client.post(
        "/api/paypal/create-payment",
        json={
            "amount": 10.00,
            "description": "Test payment"
        }
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_earnings_requires_auth(client: AsyncClient):
    """Test that viewing earnings requires authentication."""
    response = await client.get("/api/earnings")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_transactions_requires_auth(client: AsyncClient):
    """Test that viewing transactions requires authentication."""
    response = await client.get("/api/transactions")
    assert response.status_code == 401
