"""
Messaging Schemas - Pydantic models for messaging data validation and serialization
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Message(BaseModel):
    """Message model"""
    message_id: str
    conversation_id: str
    sender_id: str
    content: str
    read: bool = False
    created_at: datetime
