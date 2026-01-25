# Security utilities for input validation and sanitization

import re
from fastapi import HTTPException, UploadFile
from .constants import (
    MAX_FILE_SIZE, MAX_INPUT_LENGTH, ALLOWED_MEDIA_TYPES, 
    MAX_BIO_LENGTH, MAX_NAME_LENGTH
)
from .errors import ValidationError, FileUploadError

# ID validation pattern (alphanumeric with underscores and dashes)
ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,50}$')

def validate_id(id_value: str, id_type: str = "ID") -> str:
    """Validate ID format to prevent injection attacks"""
    if not id_value or not isinstance(id_value, str):
        raise ValidationError(f"Invalid {id_type}")
    if len(id_value) > 50:
        raise ValidationError(f"{id_type} too long")
    if not ID_PATTERN.match(id_value):
        raise ValidationError(f"Invalid {id_type} format")
    return id_value

def sanitize_string(value: str, max_length: int = MAX_INPUT_LENGTH, field_name: str = "input") -> str:
    """Sanitize string input to prevent XSS and injection"""
    if not isinstance(value, str):
        return ""
    
    # Trim whitespace and limit length
    value = value.strip()[:max_length]
    
    # Remove potential script tags and dangerous characters
    value = re.sub(r'<script[^>]*>.*?</script>', '', value, flags=re.IGNORECASE | re.DOTALL)
    value = re.sub(r'javascript:', '', value, flags=re.IGNORECASE)
    value = re.sub(r'on\w+\s*=', '', value, flags=re.IGNORECASE)  # Remove event handlers
    
    return value

def validate_name(name: str, field_name: str = "Name") -> str:
    """Validate user name/display name"""
    if not name or not isinstance(name, str):
        raise ValidationError(f"{field_name} is required")
    
    name = name.strip()
    if len(name) < 1:
        raise ValidationError(f"{field_name} cannot be empty")
    if len(name) > MAX_NAME_LENGTH:
        raise ValidationError(f"{field_name} exceeds maximum length of {MAX_NAME_LENGTH}")
    
    # Sanitize
    name = sanitize_string(name, MAX_NAME_LENGTH)
    
    return name

def validate_bio(bio: str) -> str:
    """Validate user bio"""
    if not bio or not isinstance(bio, str):
        return ""
    
    bio = bio.strip()
    if len(bio) > MAX_BIO_LENGTH:
        raise ValidationError(f"Bio exceeds maximum length of {MAX_BIO_LENGTH}")
    
    # Sanitize
    bio = sanitize_string(bio, MAX_BIO_LENGTH)
    
    return bio

def validate_email(email: str) -> str:
    """Validate email format"""
    if not email or not isinstance(email, str):
        raise ValidationError("Email is required")
    
    email = email.strip().lower()
    
    # Basic email regex
    email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    
    if not email_pattern.match(email):
        raise ValidationError("Invalid email format")
    
    if len(email) > 254:  # RFC 5321
        raise ValidationError("Email is too long")
    
    return email

def validate_url(url: str) -> str:
    """Validate URL format"""
    if not url or not isinstance(url, str):
        raise ValidationError("URL is required")
    
    url = url.strip()
    
    # Basic URL regex
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
        r'localhost|'  # localhost
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IP
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$',
        re.IGNORECASE
    )
    
    if not url_pattern.match(url):
        raise ValidationError("Invalid URL format")
    
    return url

async def validate_file_upload(
    file: UploadFile,
    allowed_types: list = None,
    max_size: int = MAX_FILE_SIZE,
    field_name: str = "file"
) -> bytes:
    """Validate file upload for size and type"""
    if allowed_types is None:
        allowed_types = ALLOWED_MEDIA_TYPES
    
    # Check content type
    if file.content_type not in allowed_types:
        raise FileUploadError(
            f"{field_name} type not allowed. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Read and check size
    contents = await file.read()
    if len(contents) > max_size:
        raise FileUploadError(
            f"{field_name} exceeds maximum size of {max_size / 1024 / 1024:.0f}MB"
        )
    
    return contents

def validate_phone(phone: str) -> str:
    """Validate phone number format"""
    if not phone or not isinstance(phone, str):
        raise ValidationError("Phone number is required")
    
    phone = re.sub(r'[^\d+]', '', phone)  # Remove non-digit characters
    
    if len(phone) < 10 or len(phone) > 15:
        raise ValidationError("Phone number must be between 10 and 15 digits")
    
    return phone

def validate_positive_number(value: float, field_name: str = "Amount") -> float:
    """Validate that a number is positive"""
    try:
        num = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} must be a valid number")
    
    if num <= 0:
        raise ValidationError(f"{field_name} must be greater than 0")
    
    return num

def validate_percentage(value: float, field_name: str = "Percentage") -> float:
    """Validate that a number is a valid percentage (0-100)"""
    try:
        num = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} must be a valid number")
    
    if num < 0 or num > 100:
        raise ValidationError(f"{field_name} must be between 0 and 100")
    
    return num

def sanitize_hashtag(hashtag: str) -> str:
    """Sanitize and validate hashtag"""
    hashtag = sanitize_string(hashtag, 50)
    
    # Remove # prefix if present
    if hashtag.startswith('#'):
        hashtag = hashtag[1:]
    
    # Only allow alphanumeric and underscore
    hashtag = re.sub(r'[^a-zA-Z0-9_]', '', hashtag)
    
    if not hashtag:
        raise ValidationError("Invalid hashtag format")
    
    return hashtag

def extract_hashtags(text: str) -> list[str]:
    """Extract hashtags from text"""
    hashtags = re.findall(r'#[a-zA-Z0-9_]+', text)
    return [tag.lower() for tag in hashtags]

def extract_mentions(text: str) -> list[str]:
    """Extract @mentions from text"""
    mentions = re.findall(r'@[a-zA-Z0-9_-]+', text)
    return [mention[1:].lower() for mention in mentions]  # Remove @ prefix

def contains_profanity(text: str) -> bool:
    """Simple check for common profanity (can be enhanced)"""
    # This is a basic implementation - in production use a proper library
    profanity_words = ['badword1', 'badword2']  # Placeholder
    text_lower = text.lower()
    return any(word in text_lower for word in profanity_words)
