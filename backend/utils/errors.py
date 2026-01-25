# Custom exception classes for Grover API

from fastapi import HTTPException
from typing import Optional, Dict, Any

class GroverException(Exception):
    """Base exception for Grover API"""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

class ValidationError(GroverException):
    """Raised when validation fails"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=400, details=details)

class AuthenticationError(GroverException):
    """Raised when authentication fails"""
    def __init__(self, message: str = "Not authenticated"):
        super().__init__(message, status_code=401)

class AuthorizationError(GroverException):
    """Raised when user lacks permission"""
    def __init__(self, message: str = "Not authorized"):
        super().__init__(message, status_code=403)

class NotFoundError(GroverException):
    """Raised when resource not found"""
    def __init__(self, resource_type: str, resource_id: str):
        message = f"{resource_type} '{resource_id}' not found"
        super().__init__(message, status_code=404)

class ConflictError(GroverException):
    """Raised when operation creates conflict"""
    def __init__(self, message: str):
        super().__init__(message, status_code=409)

class RateLimitError(GroverException):
    """Raised when rate limit exceeded"""
    def __init__(self, message: str = "Too many requests"):
        super().__init__(message, status_code=429)

class PaymentError(GroverException):
    """Raised when payment operation fails"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=400, details=details)

class FileUploadError(GroverException):
    """Raised when file upload fails"""
    def __init__(self, message: str):
        super().__init__(message, status_code=400)

class DatabaseError(GroverException):
    """Raised when database operation fails"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, details=details)

def exception_to_http_exception(exc: GroverException) -> HTTPException:
    """Convert GroverException to HTTPException for FastAPI"""
    return HTTPException(
        status_code=exc.status_code,
        detail=exc.message
    )
