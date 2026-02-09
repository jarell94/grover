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


@pytest.mark.asyncio
async def test_benchmarks_endpoint(monkeypatch, override_auth):
    users = MagicMock()
    users.find_one = AsyncMock(return_value={"user_id": override_auth.user_id, "category": "music"})

    similar_cursor = MagicMock()
    similar_cursor.limit.return_value.to_list = AsyncMock(return_value=[
        {"user_id": "peer_1", "name": "Peer", "picture": None, "category": "music", "total_earnings": 10}
    ])

    peer_cursor = MagicMock()
    peer_cursor.to_list = AsyncMock(return_value=[
        {"user_id": "peer_2", "name": "Peer 2", "picture": None, "category": "music", "total_earnings": 5}
    ])

    def find_users(query, _projection=None):
        if query.get("category") == "music":
            return similar_cursor
        return peer_cursor

    users.find = MagicMock(side_effect=find_users)
    monkeypatch.setattr(server, "db", MagicMock(users=users))
    monkeypatch.setattr(server, "build_creator_metrics", AsyncMock(return_value={"user_id": "peer_1"}))
    monkeypatch.setattr(server, "build_platform_average", AsyncMock(return_value={"followers": 1}))
    monkeypatch.setattr(server, "build_historical_benchmarks", AsyncMock(return_value=[{"month": "2025-01"}]))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/analytics/benchmarks?peer_ids=peer_2")

    assert response.status_code == 200
    payload = response.json()
    assert "similar_creators" in payload
    assert payload["platform_average"]["followers"] == 1


@pytest.mark.asyncio
async def test_cohort_analytics_endpoint(monkeypatch, override_auth):
    monkeypatch.setattr(
        server,
        "fetch_cohort_groups",
        AsyncMock(return_value=[{"_id": {"year": 2025, "month": 1}, "user_ids": ["u1"], "count": 1}])
    )
    monkeypatch.setattr(
        server,
        "build_cohort_metrics",
        AsyncMock(return_value={
            "total_users": 1,
            "active_users": 1,
            "retention_rate": 1.0,
            "engagement_trend": [],
            "revenue_total": 5,
            "ltv": 5,
        })
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/analytics/cohorts")

    assert response.status_code == 200
    payload = response.json()
    assert payload["cohorts"][0]["cohort"] == "2025-01"
