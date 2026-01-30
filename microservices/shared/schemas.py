"""
Shared Pydantic schemas for inter-service communication.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ============ USER SCHEMAS ============

class UserPublic(BaseModel):
    """Public user data shared across services."""
    user_id: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = None
    is_premium: bool = False
    is_private: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserBasic(BaseModel):
    """Minimal user data for referencing in other services."""
    user_id: str
    name: str
    picture: Optional[str] = None


# ============ POST SCHEMAS ============

class PostBasic(BaseModel):
    """Minimal post data for referencing."""
    post_id: str
    user_id: str
    content: str
    created_at: datetime


# ============ AUTHENTICATION SCHEMAS ============

class TokenData(BaseModel):
    """JWT token data."""
    user_id: str
    exp: datetime


class AuthUser(BaseModel):
    """Authenticated user data from gateway."""
    user_id: str
    email: str
    name: str
    is_premium: bool = False


# ============ API RESPONSE SCHEMAS ============

class SuccessResponse(BaseModel):
    """Standard success response."""
    status: str = "success"
    message: Optional[str] = None
    data: Optional[dict] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    status: str = "error"
    message: str
    code: Optional[str] = None


class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: str
    timestamp: datetime


# ============ PAGINATION SCHEMAS ============

class PaginationParams(BaseModel):
    """Pagination parameters."""
    limit: int = Field(default=20, ge=1, le=100)
    skip: int = Field(default=0, ge=0)


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""
    items: List
    total: int
    limit: int
    skip: int
    has_more: bool
