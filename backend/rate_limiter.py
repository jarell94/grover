"""
Rate Limiting Middleware for FastAPI
Protects against DDoS attacks and brute-force attempts
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import os

# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],  # Default: 100 requests per minute per IP
    storage_uri=os.getenv("REDIS_URL", "memory://"),  # Use Redis if available, fallback to memory
    strategy="fixed-window",  # Fixed window strategy for simplicity
    headers_enabled=True,  # Add rate limit info to response headers
)

# Rate limit configurations for different endpoint types
RATE_LIMITS = {
    "auth": "5/minute",          # Authentication endpoints (login, signup)
    "media_upload": "10/minute", # Media upload endpoints
    "messaging": "30/minute",    # Messaging endpoints
    "general": "100/minute",     # General API endpoints
    "read_only": "200/minute",   # Read-only endpoints (get posts, profiles)
}

def get_rate_limit(endpoint_type: str = "general") -> str:
    """Get rate limit configuration for specific endpoint type"""
    return RATE_LIMITS.get(endpoint_type, RATE_LIMITS["general"])
