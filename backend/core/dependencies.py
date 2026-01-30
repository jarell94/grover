"""
Dependencies Module - FastAPI dependency injection functions
"""
from typing import Optional
from fastapi import Header, HTTPException, Depends
from datetime import datetime, timezone
import logging

from core.database import db
from schemas.users import User

logger = logging.getLogger(__name__)


async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[User]:
    """
    Get the current authenticated user from the authorization header.
    Returns None if not authenticated or invalid token.
    """
    if not authorization:
        return None
    
    try:
        token = authorization.replace("Bearer ", "")
        session = await db.user_sessions.find_one(
            {"session_token": token},
            {"_id": 0}
        )
        
        if not session:
            return None
        
        # Check expiry
        expires_at = session["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            return None
        
        user_doc = await db.users.find_one(
            {"user_id": session["user_id"]},
            {"_id": 0}
        )
        
        if user_doc:
            return User(**user_doc)
        return None
    except Exception as e:
        logger.error(f"Auth error: {e}")
        return None


async def require_auth(current_user: Optional[User] = Depends(get_current_user)):
    """
    Require authentication. Raises 401 if user is not authenticated.
    Use this as a dependency for protected endpoints.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user


def get_db():
    """Dependency to get database instance"""
    return db
