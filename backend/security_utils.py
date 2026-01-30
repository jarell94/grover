"""
Security utilities and input validation helpers
"""

import re
from typing import Optional
from fastapi import HTTPException

# Security constants
MAX_INPUT_LENGTH = 10000
MAX_BIO_LENGTH = 500
MAX_NAME_LENGTH = 100
ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,50}$')

def validate_id(id_value: str, id_type: str = "ID") -> str:
    """
    Validate ID format to prevent injection attacks
    
    Args:
        id_value: The ID string to validate
        id_type: Type of ID for error messages (e.g., "User ID", "Post ID")
    
    Returns:
        The validated ID string
        
    Raises:
        HTTPException: If ID format is invalid
    """
    if not id_value or not isinstance(id_value, str):
        raise HTTPException(status_code=400, detail=f"Invalid {id_type}: empty or not a string")
    
    if not ID_PATTERN.match(id_value):
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid {id_type} format. Must be alphanumeric with underscores/hyphens (1-50 chars)"
        )
    
    return id_value


def sanitize_string(text: str, max_length: int = MAX_INPUT_LENGTH) -> str:
    """
    Sanitize user input to prevent XSS and other injection attacks
    
    Args:
        text: Input string to sanitize
        max_length: Maximum allowed length
        
    Returns:
        Sanitized string
        
    Raises:
        HTTPException: If input exceeds max length
    """
    if not isinstance(text, str):
        return ""
    
    # Check length
    if len(text) > max_length:
        raise HTTPException(
            status_code=400, 
            detail=f"Input too long. Maximum {max_length} characters allowed"
        )
    
    # Remove potential script tags and dangerous content
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',  # Event handlers like onclick=
        r'<iframe',
        r'<object',
        r'<embed',
    ]
    
    sanitized = text
    for pattern in dangerous_patterns:
        sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE | re.DOTALL)
    
    return sanitized.strip()


def validate_pagination(skip: int, limit: int) -> tuple[int, int]:
    """
    Validate and enforce pagination limits
    
    Args:
        skip: Number of items to skip
        limit: Number of items to return
        
    Returns:
        Tuple of (validated_skip, validated_limit)
        
    Raises:
        HTTPException: If values are out of acceptable range
    """
    if skip < 0:
        raise HTTPException(status_code=400, detail="Skip must be non-negative")
    
    if limit < 1:
        raise HTTPException(status_code=400, detail="Limit must be at least 1")
    
    if limit > 100:
        raise HTTPException(status_code=400, detail="Limit cannot exceed 100")
    
    return skip, limit


def validate_media_file(content_type: str, file_size: int, allowed_types: list[str], max_size: int) -> None:
    """
    Validate uploaded media files
    
    Args:
        content_type: MIME type of the file
        file_size: Size of the file in bytes
        allowed_types: List of allowed MIME types
        max_size: Maximum allowed file size in bytes
        
    Raises:
        HTTPException: If validation fails
    """
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )
    
    if file_size > max_size:
        max_mb = max_size / (1024 * 1024)
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {max_mb}MB"
        )
