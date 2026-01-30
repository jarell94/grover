"""
Auth Router - Authentication and session endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from datetime import datetime, timezone, timedelta
import httpx
import uuid
import logging

from core.database import db
from core.dependencies import get_current_user, require_auth
from schemas.users import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/session")
async def create_session(session_id: str):
    """Exchange session_id for user data and create session"""
    # Validate session_id format
    if not session_id or len(session_id) > 500:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session ID")
            
            user_data = response.json()
            
            # Check if user exists
            existing_user = await db.users.find_one(
                {"email": user_data["email"]},
                {"_id": 0}
            )
            
            if not existing_user:
                # Create new user
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                await db.users.insert_one({
                    "user_id": user_id,
                    "email": user_data["email"],
                    "name": user_data["name"],
                    "picture": user_data["picture"],
                    "bio": "",
                    "is_premium": False,
                    "is_private": False,
                    "created_at": datetime.now(timezone.utc)
                })
            else:
                user_id = existing_user["user_id"]
            
            # Create or update session (avoid duplicate key error)
            session_token = user_data["session_token"]
            try:
                await db.user_sessions.update_one(
                    {"session_token": session_token},
                    {
                        "$set": {
                            "user_id": user_id,
                            "session_token": session_token,
                            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                            "updated_at": datetime.now(timezone.utc)
                        },
                        "$setOnInsert": {
                            "created_at": datetime.now(timezone.utc)
                        }
                    },
                    upsert=True
                )
            except Exception as session_error:
                # Handle race condition - if E11000 occurs, session already exists, which is fine
                if "E11000" in str(session_error) or "duplicate key" in str(session_error):
                    logger.warning(f"Session already exists for token (race condition handled): {session_token[:10]}...")
                else:
                    logger.error(f"Session error: {session_error}")
                    raise
            
            return {
                "user_id": user_id,
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data["picture"],
                "session_token": session_token
            }
    except Exception as e:
        logger.error(f"Session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
async def get_me(current_user: User = Depends(require_auth)):
    """Get current authenticated user"""
    return current_user


@router.post("/logout")
async def logout(current_user: User = Depends(require_auth), authorization: str = Header(None)):
    """Logout current user by deleting session"""
    token = authorization.replace("Bearer ", "")
    await db.user_sessions.delete_one({"session_token": token})
    return {"message": "Logged out"}
