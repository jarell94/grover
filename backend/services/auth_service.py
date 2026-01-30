"""
Authentication service for handling user authentication and sessions.
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, Dict
from datetime import datetime, timezone, timedelta
import httpx
import uuid
import logging

from schemas.user import User

logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication operations."""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def create_session_from_oauth(self, session_id: str) -> Dict:
        """
        Exchange OAuth session_id for user data and create session.
        
        Args:
            session_id: OAuth session ID from external auth provider
            
        Returns:
            Dict with user data and session token
            
        Raises:
            ValueError: If session ID is invalid
        """
        if not session_id or len(session_id) > 500:
            raise ValueError("Invalid session ID")
        
        try:
            # Fetch user data from OAuth provider
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                    headers={"X-Session-ID": session_id}
                )
                
                if response.status_code != 200:
                    raise ValueError("Invalid session ID")
                
                user_data = response.json()
            
            # Check if user exists
            existing_user = await self.db.users.find_one(
                {"email": user_data["email"]},
                {"_id": 0}
            )
            
            if not existing_user:
                # Create new user
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                await self.db.users.insert_one({
                    "user_id": user_id,
                    "email": user_data["email"],
                    "name": user_data["name"],
                    "picture": user_data.get("picture"),
                    "bio": "",
                    "is_premium": False,
                    "is_private": False,
                    "notify_followers": True,
                    "notify_likes": True,
                    "notify_comments": True,
                    "notify_messages": True,
                    "notify_sales": True,
                    "notify_mentions": True,
                    "notify_reposts": True,
                    "created_at": datetime.now(timezone.utc)
                })
            else:
                user_id = existing_user["user_id"]
            
            # Create or update session
            session_token = user_data["session_token"]
            try:
                await self.db.user_sessions.update_one(
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
                # Handle race condition for duplicate key
                if "E11000" in str(session_error) or "duplicate key" in str(session_error):
                    logger.warning(f"Session already exists (race condition handled)")
                else:
                    logger.error(f"Session error: {session_error}")
                    raise
            
            return {
                "user_id": user_id,
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data.get("picture"),
                "session_token": session_token
            }
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Session creation error: {e}")
            raise ValueError(f"Failed to create session: {str(e)}")
    
    async def get_user_from_token(self, token: str) -> Optional[User]:
        """
        Get user from session token.
        
        Args:
            token: Session token
            
        Returns:
            User object if token is valid, None otherwise
        """
        try:
            # Clean token (remove "Bearer " prefix if present)
            token = token.replace("Bearer ", "")
            
            # Find session
            session = await self.db.user_sessions.find_one(
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
            
            # Get user
            user_doc = await self.db.users.find_one(
                {"user_id": session["user_id"]},
                {"_id": 0}
            )
            
            if user_doc:
                return User(**user_doc)
            return None
        except Exception as e:
            logger.error(f"Auth error: {e}")
            return None
    
    async def logout(self, token: str) -> bool:
        """
        Logout user by invalidating session token.
        
        Args:
            token: Session token to invalidate
            
        Returns:
            True if logout successful, False otherwise
        """
        try:
            token = token.replace("Bearer ", "")
            result = await self.db.user_sessions.delete_one(
                {"session_token": token}
            )
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Logout error: {e}")
            return False
    
    async def validate_session(self, token: str) -> bool:
        """
        Validate if session token is valid and not expired.
        
        Args:
            token: Session token to validate
            
        Returns:
            True if valid, False otherwise
        """
        user = await self.get_user_from_token(token)
        return user is not None
