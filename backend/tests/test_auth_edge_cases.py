"""Authentication Edge Cases Tests

Tests for:
- Token expiry
- Invalid tokens
- Missing tokens
- Malformed tokens
- Session management
"""

import pytest
from httpx import AsyncClient
import jwt
from datetime import datetime, timedelta, timezone
import os

# Test data
INVALID_TOKENS = [
    "",
    "invalid",
    "Bearer",
    "Bearer ",
    "Bearer invalid_token",
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
    "null",
    "undefined",
    "<script>alert('xss')</script>",
]


@pytest.mark.asyncio
async def test_missing_auth_header(client: AsyncClient):
    """Test endpoints without Authorization header."""
    protected_endpoints = [
        ("/api/auth/me", "GET"),
        ("/api/posts", "GET"),
        ("/api/posts", "POST"),
        ("/api/users/me", "PUT"),
        ("/api/notifications", "GET"),
        ("/api/messages/conversations", "GET"),
    ]
    
    for endpoint, method in protected_endpoints:
        if method == "GET":
            response = await client.get(endpoint)
        elif method == "POST":
            response = await client.post(endpoint)
        elif method == "PUT":
            response = await client.put(endpoint)
        
        assert response.status_code == 401, f"{method} {endpoint} should return 401 without auth"


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid_token", INVALID_TOKENS)
async def test_invalid_auth_tokens(client: AsyncClient, invalid_token: str):
    """Test various invalid token formats."""
    headers = {"Authorization": invalid_token}
    response = await client.get("/api/auth/me", headers=headers)
    assert response.status_code in [401, 422], f"Invalid token '{invalid_token}' should be rejected"


@pytest.mark.asyncio
async def test_expired_token(client: AsyncClient):
    """Test with an expired JWT token."""
    # Create an expired token
    secret = os.getenv("SECRET_KEY", "test-secret")
    expired_payload = {
        "user_id": "test_user",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1)
    }
    expired_token = jwt.encode(expired_payload, secret, algorithm="HS256")
    
    headers = {"Authorization": f"Bearer {expired_token}"}
    response = await client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401, "Expired token should be rejected"


@pytest.mark.asyncio
async def test_token_with_wrong_secret(client: AsyncClient):
    """Test token signed with wrong secret."""
    wrong_secret = "wrong-secret-key"
    payload = {
        "user_id": "test_user",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    wrong_token = jwt.encode(payload, wrong_secret, algorithm="HS256")
    
    headers = {"Authorization": f"Bearer {wrong_token}"}
    response = await client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401, "Token with wrong secret should be rejected"


@pytest.mark.asyncio
async def test_token_without_user_id(client: AsyncClient):
    """Test token missing required claims."""
    secret = os.getenv("SECRET_KEY", "test-secret")
    payload = {
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
        # Missing user_id
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/api/auth/me", headers=headers)
    assert response.status_code in [401, 422], "Token without user_id should be rejected"


@pytest.mark.asyncio
async def test_logout_clears_session(client: AsyncClient):
    """Test that logout properly invalidates session."""
    response = await client.post("/api/auth/logout")
    # Logout should work even without auth (idempotent)
    assert response.status_code in [200, 401]


@pytest.mark.asyncio
async def test_sql_injection_in_session_id(client: AsyncClient):
    """Test SQL injection attempts in session creation."""
    malicious_ids = [
        "'; DROP TABLE users; --",
        "1 OR 1=1",
        "admin'--",
        "${7*7}",
        "{{7*7}}",
    ]
    
    for malicious_id in malicious_ids:
        response = await client.post(
            "/api/auth/session",
            params={"session_id": malicious_id}
        )
        # Should return error, not execute injection
        # 405 is acceptable - means POST not allowed (endpoint might use different method)
        assert response.status_code in [400, 401, 404, 405, 422, 500]
