# Security and configuration constants

# File size limits
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB (increased for video uploads to cloud)
MAX_INPUT_LENGTH = 10000  # Max characters for text input
MAX_BIO_LENGTH = 500
MAX_NAME_LENGTH = 100

# Allowed media types
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"]
ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"]
ALLOWED_MEDIA_TYPES = ALLOWED_IMAGE_TYPES + ALLOWED_VIDEO_TYPES + ALLOWED_AUDIO_TYPES

# API response status codes
HTTP_OK = 200
HTTP_CREATED = 201
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_FORBIDDEN = 403
HTTP_NOT_FOUND = 404
HTTP_CONFLICT = 409
HTTP_INTERNAL_SERVER_ERROR = 500

# Default pagination
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# Time constants (in seconds)
NOTIFICATION_CLEANUP_INTERVAL = 86400  # 1 day
STREAM_TIMEOUT = 3600  # 1 hour
SESSION_TIMEOUT = 2592000  # 30 days

# Chat and messaging
MAX_CHAT_MESSAGE_LENGTH = 500
MAX_DM_LENGTH = 1000
TYPING_INDICATOR_TIMEOUT = 5

# Content moderation
MIN_POST_LENGTH = 1
MAX_POST_LENGTH = 5000
MAX_COMMENT_LENGTH = 2000
MAX_STORY_TEXT_LENGTH = 200

# Payment constants
PAYPAL_CURRENCY = "USD"
MIN_PAYMENT_AMOUNT = 0.50
MAX_PAYMENT_AMOUNT = 99999.99

# Analytics
ANALYTICS_RETENTION_DAYS = 90
ANALYTICS_BATCH_SIZE = 100

# Search
MIN_SEARCH_QUERY_LENGTH = 1
MAX_SEARCH_QUERY_LENGTH = 100
DEFAULT_SEARCH_RESULTS = 20

# Follow/Block limits
MAX_FOLLOWS_PER_DAY = 200
MAX_BLOCKS_PER_DAY = 100

# Notification types
NOTIFICATION_TYPES = {
    'like': 'User liked your post',
    'comment': 'User commented on your post',
    'follow': 'User started following you',
    'message': 'New direct message',
    'mention': 'You were mentioned',
    'repost': 'User reposted your content',
    'tip': 'You received a tip',
    'super_chat': 'Super chat received',
    'stream_follow': 'Creator you follow is live',
}

# Error messages
ERROR_INVALID_ID = "Invalid ID format"
ERROR_NOT_FOUND = "Resource not found"
ERROR_UNAUTHORIZED = "Not authenticated"
ERROR_FORBIDDEN = "Not authorized"
ERROR_VALIDATION_FAILED = "Validation failed"
ERROR_FILE_TOO_LARGE = f"File exceeds maximum size of {MAX_FILE_SIZE / 1024 / 1024:.0f}MB"
ERROR_INVALID_FILE_TYPE = "Invalid file type"
ERROR_RATE_LIMIT = "Too many requests, please try again later"
ERROR_INVALID_PAYMENT = "Invalid payment details"
ERROR_PAYMENT_FAILED = "Payment processing failed"
