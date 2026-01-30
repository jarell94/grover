"""
Security Module - Validation and sanitization helpers
"""
import re
from fastapi import HTTPException, UploadFile

from core.config import (
    ID_PATTERN,
    MAX_INPUT_LENGTH,
    MAX_FILE_SIZE,
    ALLOWED_MEDIA_TYPES
)


def validate_id(id_value: str, id_type: str = "ID") -> str:
    """Validate ID format to prevent injection attacks"""
    if not id_value or not isinstance(id_value, str):
        raise HTTPException(status_code=400, detail=f"Invalid {id_type}")
    if len(id_value) > 50:
        raise HTTPException(status_code=400, detail=f"{id_type} too long")
    if not ID_PATTERN.match(id_value):
        raise HTTPException(status_code=400, detail=f"Invalid {id_type} format")
    return id_value


def sanitize_string(value: str, max_length: int = MAX_INPUT_LENGTH, field_name: str = "input") -> str:
    """Sanitize string input"""
    if not isinstance(value, str):
        return ""
    # Trim whitespace and limit length
    value = value.strip()[:max_length]
    # Remove potential script tags and dangerous characters
    # Match script tags with any whitespace in the closing tag
    value = re.sub(r'<script[^>]*>.*?</\s*script\s*>', '', value, flags=re.IGNORECASE | re.DOTALL)
    value = re.sub(r'javascript:', '', value, flags=re.IGNORECASE)
    return value


async def validate_file_upload(file: UploadFile, allowed_types: list = None, max_size: int = MAX_FILE_SIZE) -> bytes:
    """Validate file upload for size and type"""
    if allowed_types is None:
        allowed_types = ALLOWED_MEDIA_TYPES
    
    # Check content type
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Read and check size
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {max_size // (1024*1024)}MB"
        )
    
    return content
