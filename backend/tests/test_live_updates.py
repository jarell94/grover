import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import server


class DummyCursor:
    def __init__(self, results):
        self._results = results

    async def to_list(self, _limit):
        return self._results


@pytest.mark.asyncio
async def test_build_live_metrics(monkeypatch):
    mock_db = MagicMock()
    mock_db.follows.count_documents = AsyncMock(return_value=12)
    mock_db.posts.aggregate = MagicMock(return_value=DummyCursor([{
        "total_posts": 3,
        "total_likes": 25,
        "total_comments": 5,
        "total_shares": 2,
    }]))
    mock_db.users.find_one = AsyncMock(return_value={
        "total_earnings": 42.5,
        "earnings_balance": 12.5,
    })

    monkeypatch.setattr(server, "db", mock_db)

    payload = await server.build_live_metrics("user_123")

    assert payload["user_id"] == "user_123"
    assert payload["followers_count"] == 12
    assert payload["total_posts"] == 3
    assert payload["total_likes"] == 25
    assert payload["total_comments"] == 5
    assert payload["total_shares"] == 2
    assert payload["total_revenue"] == 42.5
    assert payload["earnings_balance"] == 12.5
    updated_at = datetime.fromisoformat(payload["updated_at"])
    assert updated_at.tzinfo is not None
    assert abs((updated_at - datetime.now(timezone.utc)).total_seconds()) < 5


def test_is_follower_milestone():
    assert server.is_follower_milestone(100) is True
    assert server.is_follower_milestone(123) is False
