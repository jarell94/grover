"""
Security utilities and validation helpers.
Provides input validation, sanitization, and file upload validation.
"""
import re
from typing import List
from fastapi import HTTPException, UploadFile

# Security constants
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_INPUT_LENGTH = 10000  # Max characters for text input
MAX_BIO_LENGTH = 500
MAX_NAME_LENGTH = 100

ALLOWED_IMAGE_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp", 
    "image/heic", "image/heif"
]
ALLOWED_VIDEO_TYPES = [
    "video/mp4", "video/quicktime", "video/webm"
]
ALLOWED_AUDIO_TYPES = [
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"
]
ALLOWED_MEDIA_TYPES = ALLOWED_IMAGE_TYPES + ALLOWED_VIDEO_TYPES + ALLOWED_AUDIO_TYPES

# ID validation pattern (alphanumeric with underscores and hyphens)
ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,50}$')


def validate_id(id_value: str, id_type: str = "ID") -> str:
    """
    Validate ID format to prevent injection attacks.
    
    Args:
        id_value: The ID value to validate
        id_type: The type of ID for error messages
        
    Returns:
        The validated ID
        
    Raises:
        HTTPException: If ID is invalid
    """
    if not id_value or not isinstance(id_value, str):
        raise HTTPException(status_code=400, detail=f"Invalid {id_type}")
    if len(id_value) > 50:
        raise HTTPException(status_code=400, detail=f"{id_type} too long")
    if not ID_PATTERN.match(id_value):
        raise HTTPException(status_code=400, detail=f"Invalid {id_type} format")
    return id_value


def sanitize_string(
    value: str, 
    max_length: int = MAX_INPUT_LENGTH, 
    field_name: str = "input"
) -> str:
    """
    Sanitize string input by removing dangerous content.
    
    Args:
        value: The string to sanitize
        max_length: Maximum allowed length
        field_name: Field name for error messages
        
    Returns:
        Sanitized string
    """
    if not isinstance(value, str):
        return ""
    
    # Trim whitespace and limit length
    value = value.strip()[:max_length]
    
    # Remove potential script tags and dangerous characters
    # Improved regex to handle whitespace and attributes in closing tags
    # Matches: </script>, </script >, </script\t>, </script foo="bar">, etc.
    value = re.sub(
        r'<script[^>]*>.*?</script(?:\s+[^>]*)?\s*>', '', 
        value, 
        flags=re.IGNORECASE | re.DOTALL
    )
    value = re.sub(r'javascript:', '', value, flags=re.IGNORECASE)
    
    return value


async def validate_file_upload(
    file: UploadFile, 
    allowed_types: List[str] = None, 
    max_size: int = MAX_FILE_SIZE
) -> bytes:
    """
    Validate file upload for size and type.
    
    Args:
        file: The uploaded file
        allowed_types: List of allowed content types
        max_size: Maximum file size in bytes
        
    Returns:
        File content as bytes
        
    Raises:
        HTTPException: If file is invalid
    """
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
