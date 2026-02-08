import pytest
from httpx import AsyncClient

from metrics import track_post_created


@pytest.mark.asyncio
async def test_metrics_endpoint_exposes_custom_metrics(client: AsyncClient):
    track_post_created("standard")

    response = await client.get("/api/metrics")

    assert response.status_code == 200
    assert "grover_posts_created_total" in response.text
    assert 'post_type="standard"' in response.text
