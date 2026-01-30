"""
Authentication router for handling auth-related endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional

from core.database import get_database
from services.auth_service import AuthService
from schemas.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def get_auth_service(db=Depends(get_database)) -> AuthService:
    """Dependency to get auth service."""
    return AuthService(db)


async def get_current_user(
    authorization: Optional[str] = Header(None),
    auth_service: AuthService = Depends(get_auth_service)
) -> Optional[User]:
    """
    Get current user from authorization header.
    Returns None if not authenticated.
    """
    if not authorization:
        return None
    
    token = authorization.replace("Bearer ", "")
    return await auth_service.get_user_from_token(token)


async def require_auth(
    current_user: Optional[User] = Depends(get_current_user)
) -> User:
    """
    Require authentication.
    Raises 401 if user is not authenticated.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user


@router.get("/session")
async def create_session(
    session_id: str,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Exchange OAuth session_id for user data and create session.
    
    Args:
        session_id: OAuth session ID from external auth provider
        
    Returns:
        User data with session token
    """
    try:
        return await auth_service.create_session_from_oauth(session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
async def get_me(current_user: User = Depends(require_auth)):
    """
    Get current authenticated user.
    
    Returns:
        Current user data
    """
    return current_user


@router.post("/logout")
async def logout(
    authorization: str = Header(None),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Logout current user by invalidating session token.
    
    Returns:
        Success message
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    success = await auth_service.logout(token)
    
    if success:
        return {"message": "Logged out successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to logout")
