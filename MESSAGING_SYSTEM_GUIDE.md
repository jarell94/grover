# Enhanced Notifications & Messaging System - Complete Guide

## Overview

This guide covers the comprehensive enhancements to the Grover social media platform's notification and messaging system, including message reactions, read receipts, typing indicators, group chats, voice messages, and live stream notifications.

---

## Table of Contents

1. [Features Summary](#features-summary)
2. [Backend API Reference](#backend-api-reference)
3. [Frontend Components](#frontend-components)
4. [Socket.IO Events](#socketio-events)
5. [Database Schema](#database-schema)
6. [Usage Examples](#usage-examples)
7. [Testing Guide](#testing-guide)
8. [Security Considerations](#security-considerations)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)

---

## Features Summary

### ✅ Implemented Features

#### 1. Message Reactions
- Add emoji reactions to any message (1:1 or group)
- 10 supported emojis: ❤️ 😂 😮 😢 👍 🔥 🎉 👏 🙏 💯
- Toggle reactions on/off with single tap
- Real-time synchronization across devices
- Notification to message sender
- Reaction counts per emoji

#### 2. Read Receipts
- Track message read status
- Three states: Sent ✓, Delivered ✓✓, Read ✓✓ (blue)
- Timestamps for read messages
- Support for 1:1 and group chats
- Per-user read tracking in groups
- Real-time Socket.IO updates

#### 3. Typing Indicators
- Show "X is typing..." in real-time
- Support for multiple users typing
- Smart text formatting (1-3 names, "and N others")
- Animated bouncing dots
- Automatic typing stop detection
- Debounced events for performance

#### 4. Group Chats
- Already implemented
- Create groups with up to 50 members
- Group admin controls
- Add/remove members
- Group messages with read tracking
- Member notifications

#### 5. Voice Messages
- Already implemented
- Upload audio files (mp3, wav, ogg, webm)
- Duration tracking
- Cloudinary storage
- Notifications on send

#### 6. Live Stream Notifications
- Already implemented
- Notify all followers when stream starts
- Batch notification creation
- Stream link in notification
- Real-time Socket.IO broadcasts

---

## Backend API Reference

### Message Reactions

#### Add/Remove Reaction
```http
POST /api/messages/{message_id}/reactions
Content-Type: application/json

{
  "emoji": "❤️"
}
```

**Response:**
```json
{
  "action": "added",
  "emoji": "❤️",
  "reaction_counts": {
    "❤️": [
      {
        "user_id": "user_123",
        "created_at": "2024-02-05T14:30:00Z"
      }
    ]
  }
}
```

**Supported Emojis:**
- ❤️ (Heart)
- 😂 (Laughing)
- 😮 (Surprised)
- 😢 (Sad)
- 👍 (Thumbs Up)
- 🔥 (Fire)
- 🎉 (Party)
- 👏 (Clapping)
- 🙏 (Prayer)
- 💯 (100)

#### Get Message Reactions
```http
GET /api/messages/{message_id}/reactions
```

**Response:**
```json
{
  "❤️": [
    {
      "user": {
        "user_id": "user_123",
        "name": "John Doe",
        "picture": "https://..."
      },
      "created_at": "2024-02-05T14:30:00Z"
    }
  ],
  "😂": [...]
}
```

#### Remove Specific Reaction
```http
DELETE /api/messages/{message_id}/reactions/{emoji}
```

**Response:**
```json
{
  "message": "Reaction removed"
}
```

---

### Read Receipts

#### Mark Message as Read
```http
POST /api/messages/{message_id}/read
```

**Response:**
```json
{
  "message": "Message marked as read"
}
```

**Behavior:**
- For 1:1 messages: Sets `read: true` and `read_at: timestamp`
- For group messages: Adds user to `read_by` array and sets per-user `read_at`
- Emits Socket.IO `message:read` event
- Does not mark own messages as read

#### Get Unread Count
```http
GET /api/conversations/{conversation_id}/unread-count
```

**Response:**
```json
{
  "unread_count": 5
}
```

---

### Group Chats

#### Create Group
```http
POST /api/groups/create
Content-Type: multipart/form-data

name: "My Group"
description: "Group description"
member_ids: "user1,user2,user3"
photo: <file>
```

**Response:**
```json
{
  "group_id": "group_abc123",
  "message": "Group created"
}
```

#### Get Group Details
```http
GET /api/groups/{group_id}
```

**Response:**
```json
{
  "group_id": "group_abc123",
  "name": "My Group",
  "description": "...",
  "photo": "https://...",
  "creator_id": "user_123",
  "admin_ids": ["user_123"],
  "member_ids": ["user_123", "user_456"],
  "members": [
    {
      "user_id": "user_123",
      "name": "John",
      "picture": "...",
      "is_admin": true
    }
  ],
  "is_admin": true,
  "created_at": "...",
  "updated_at": "..."
}
```

#### Send Group Message
```http
POST /api/groups/{group_id}/messages
Content-Type: application/json

{
  "content": "Hello group!"
}
```

#### Get Group Messages
```http
GET /api/groups/{group_id}/messages
```

#### Add Group Member (Admin Only)
```http
POST /api/groups/{group_id}/members/add
Content-Type: application/json

{
  "user_id": "user_789"
}
```

#### Remove Group Member (Admin Only)
```http
DELETE /api/groups/{group_id}/members/{user_id}
```

---

### Voice Messages

#### Send Voice Message
```http
POST /api/messages/send-voice
Content-Type: multipart/form-data

receiver_id: "user_456"
audio: <file>
duration: 30
```

**Response:**
```json
{
  "message_id": "msg_xyz789",
  "message": "Voice message sent"
}
```

**Requirements:**
- Audio formats: mp3, wav, ogg, webm
- Max file size: 50MB
- Max duration: 5 minutes (300 seconds)

---

## Frontend Components

### 1. MessageReactions Component

**Import:**
```typescript
import { MessageReactions } from '../components/MessageReactions';
```

**Usage:**
```tsx
<MessageReactions
  messageId="msg_123"
  reactions={reactionCounts}
  currentUserId={currentUser.user_id}
  onReactionUpdate={(updatedReactions) => {
    // Handle real-time update
    setReactionCounts(updatedReactions);
  }}
/>
```

**Props:**
- `messageId: string` - Message ID
- `reactions?: ReactionCounts` - Current reactions object
- `currentUserId: string` - Current user's ID
- `onReactionUpdate?: (reactions: ReactionCounts) => void` - Callback for updates

**Features:**
- Automatic reaction count display
- Highlight user's own reactions
- One-tap toggle (add/remove)
- Horizontal scroll for many reactions
- "Add reaction" button
- Modal emoji picker

---

### 2. TypingIndicator Component

**Import:**
```typescript
import { TypingIndicator } from '../components/TypingIndicator';
```

**Usage:**
```tsx
{typingUsers.length > 0 && (
  <TypingIndicator userNames={typingUsers.map(u => u.name)} />
)}
```

**Props:**
- `userName?: string` - Single user name
- `userNames?: string[]` - Array of user names

**Features:**
- Animated bouncing dots
- Smart text formatting:
  - "X is typing"
  - "X and Y are typing"
  - "X, Y, and Z are typing"
  - "X, Y, and 2 others are typing"
- Smooth animations
- Automatic deduplication

---

### 3. ReadReceipt Component

**Import:**
```typescript
import { ReadReceipt } from '../components/ReadReceipt';
```

**Usage:**
```tsx
<ReadReceipt
  sent={true}
  delivered={message.delivered}
  read={message.read}
  readAt={message.read_at}
/>
```

**Props:**
- `sent?: boolean` - Message sent
- `delivered?: boolean` - Message delivered
- `read?: boolean` - Message read
- `readAt?: string` - ISO timestamp when read

**Display States:**
- Sent: ✓ (single gray checkmark)
- Delivered: ✓✓ (double gray checkmarks)
- Read: ✓✓ (double blue checkmarks) + optional timestamp

---

## Socket.IO Events

### Connection

**Client Connects:**
```typescript
import socketService from '../services/socket';

// Connect on app start
await socketService.connect(userId);
```

**Auto-reconnection:**
- Enabled by default
- 5 retry attempts
- Exponential backoff (1s to 5s)
- Transports: WebSocket, polling

---

### Conversation Events

#### Join Conversation
```typescript
socketService.joinConversation(conversationId, userId);
```

**Server creates room:** `conversation_{conversationId}`

#### Leave Conversation
```typescript
socketService.leaveConversation(conversationId, userId);
```

---

### Typing Events

#### Start Typing
```typescript
socketService.typing(conversationId, userId, userName);
```

**Emits to server:**
```json
{
  "conversation_id": "conv_123",
  "user_id": "user_456",
  "user_name": "John Doe"
}
```

**Server broadcasts:**
```json
{
  "user_id": "user_456",
  "user_name": "John Doe",
  "conversation_id": "conv_123"
}
```

#### Stop Typing
```typescript
socketService.typingStop(conversationId, userId);
```

**Listen for Typing:**
```typescript
const cleanup = socketService.onUserTyping((data) => {
  console.log(`${data.user_name} is typing`);
  // Update UI
});

// Cleanup on unmount
return cleanup;
```

**Listen for Typing Stop:**
```typescript
const cleanup = socketService.onUserStoppedTyping((data) => {
  console.log(`User ${data.user_id} stopped typing`);
  // Update UI
});

return cleanup;
```

---

### Message Reactions

**Listen for Reactions:**
```typescript
const cleanup = socketService.onMessageReaction((data) => {
  const { message_id, user_id, emoji, action, reaction_counts } = data;
  
  if (action === 'added') {
    console.log(`User ${user_id} added ${emoji} to message ${message_id}`);
  } else {
    console.log(`User ${user_id} removed ${emoji}`);
  }
  
  // Update local state
  updateMessageReactions(message_id, reaction_counts);
});

return cleanup;
```

**Event Data:**
```json
{
  "message_id": "msg_123",
  "user_id": "user_456",
  "emoji": "❤️",
  "action": "added",
  "reaction_counts": {
    "❤️": [{"user_id": "user_456", "created_at": "..."}]
  }
}
```

---

### Read Receipts

**Listen for Read Events:**
```typescript
const cleanup = socketService.onMessageRead((data) => {
  const { message_id, user_id, read_at } = data;
  
  console.log(`Message ${message_id} read by ${user_id} at ${read_at}`);
  
  // Update local state
  updateMessageReadStatus(message_id, user_id, read_at);
});

return cleanup;
```

**Event Data:**
```json
{
  "message_id": "msg_123",
  "user_id": "user_456",
  "read_at": "2024-02-05T14:30:00Z"
}
```

---

## Database Schema

### message_reactions Collection

```javascript
{
  reaction_id: string (unique),
  message_id: string (indexed),
  user_id: string,
  emoji: string,
  created_at: datetime
}
```

**Indexes:**
- `reaction_id` (unique)
- `message_id + user_id` (unique) - Prevents duplicate reactions
- `message_id` - Fast lookup by message

---

### messages Collection (Enhanced)

```javascript
{
  // ... existing fields ...
  message_id: string,
  conversation_id: string,
  sender_id: string,
  content: string,
  type: string,
  
  // NEW FIELDS
  read: boolean,
  read_at: datetime?  // Timestamp when read (1:1 only)
}
```

---

### group_messages Collection (Enhanced)

```javascript
{
  // ... existing fields ...
  message_id: string,
  group_id: string,
  sender_id: string,
  content: string,
  
  // NEW FIELDS
  read_by: [user_id],  // Array of users who read
  read_at: {
    "user_id1": datetime,
    "user_id2": datetime
  }  // Per-user read timestamps
}
```

---

### conversations Collection (Enhanced)

```javascript
{
  conversation_id: string (unique),
  participants: [user_id],
  
  // NEW FIELDS
  is_group: boolean,
  group_name: string?,
  group_picture: string?,
  admin_ids: [user_id]?,
  
  last_message: string,
  last_message_at: datetime,
  created_at: datetime,
  updated_at: datetime
}
```

---

## Usage Examples

### Complete Chat Screen Integration

```tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, FlatList, TextInput } from 'react-native';
import { MessageReactions } from '../components/MessageReactions';
import { TypingIndicator } from '../components/TypingIndicator';
import { ReadReceipt } from '../components/ReadReceipt';
import { api } from '../services/api';
import socketService from '../services/socket';

export default function ChatScreen({ conversationId, userId }) {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [inputText, setInputText] = useState('');
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    // Join conversation
    socketService.joinConversation(conversationId, userId);

    // Listen for new messages
    const cleanup1 = socketService.onNewMessage((message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for typing
    const cleanup2 = socketService.onUserTyping((data) => {
      setTypingUsers(prev => {
        if (!prev.find(u => u.user_id === data.user_id)) {
          return [...prev, data];
        }
        return prev;
      });
    });

    // Listen for typing stop
    const cleanup3 = socketService.onUserStoppedTyping((data) => {
      setTypingUsers(prev => prev.filter(u => u.user_id !== data.user_id));
    });

    // Listen for reactions
    const cleanup4 = socketService.onMessageReaction((data) => {
      setMessages(prev => prev.map(msg =>
        msg.message_id === data.message_id
          ? { ...msg, reactions: data.reaction_counts }
          : msg
      ));
    });

    // Listen for read receipts
    const cleanup5 = socketService.onMessageRead((data) => {
      setMessages(prev => prev.map(msg =>
        msg.message_id === data.message_id
          ? { ...msg, read: true, read_at: data.read_at }
          : msg
      ));
    });

    return () => {
      cleanup1();
      cleanup2();
      cleanup3();
      cleanup4();
      cleanup5();
      socketService.leaveConversation(conversationId, userId);
    };
  }, [conversationId, userId]);

  const handleTextChange = (text) => {
    setInputText(text);

    // Emit typing
    if (text.length > 0) {
      socketService.typing(conversationId, userId, userName);

      // Reset stop timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Emit stop after 3s of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socketService.typingStop(conversationId, userId);
      }, 3000);
    } else {
      socketService.typingStop(conversationId, userId);
    }
  };

  const handleSend = async () => {
    // Stop typing
    socketService.typingStop(conversationId, userId);

    // Send message
    await api.sendMessage(conversationId, inputText);
    setInputText('');
  };

  const renderMessage = ({ item: message }) => (
    <View>
      <Text>{message.content}</Text>
      
      {message.sender_id === userId && (
        <ReadReceipt
          sent={true}
          delivered={true}
          read={message.read}
          readAt={message.read_at}
        />
      )}

      <MessageReactions
        messageId={message.message_id}
        reactions={message.reactions}
        currentUserId={userId}
        onReactionUpdate={(reactions) => {
          // Update handled via Socket.IO
        }}
      />
    </View>
  );

  return (
    <View>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.message_id}
      />

      {typingUsers.length > 0 && (
        <TypingIndicator userNames={typingUsers.map(u => u.user_name)} />
      )}

      <TextInput
        value={inputText}
        onChangeText={handleTextChange}
        onSubmitEditing={handleSend}
        placeholder="Type a message..."
      />
    </View>
  );
}
```

---

## Testing Guide

### Manual Testing

#### Test Message Reactions
1. Open chat with another user
2. Send a message
3. Long-press or tap reaction button
4. Select emoji (e.g., ❤️)
5. Verify reaction appears below message
6. Tap same emoji again to remove
7. Verify reaction disappears
8. Check other device for real-time sync

#### Test Typing Indicators
1. Open chat on two devices
2. Start typing on Device A
3. Verify "X is typing..." appears on Device B
4. Stop typing on Device A (wait 3s)
5. Verify indicator disappears on Device B
6. Test with multiple users typing

#### Test Read Receipts
1. Send message from Device A
2. Verify single checkmark ✓ (sent)
3. Open message on Device B
4. Verify double checkmark ✓✓ on Device A (delivered)
5. Mark as read on Device B
6. Verify blue double checkmark ✓✓ on Device A (read)

#### Test Group Chats
1. Create group with 3+ members
2. Send messages from different members
3. Verify all members receive messages
4. Test adding new member
5. Test removing member (admin only)
6. Verify message reactions work in groups
7. Verify read receipts per-user

#### Test Voice Messages
1. Record voice message (30s)
2. Send to another user
3. Verify upload completes
4. Verify receiver gets notification
5. Verify playback works
6. Test duration display

---

### Automated Testing

#### Backend Tests

```python
# test_message_reactions.py
import pytest
from httpx import AsyncClient

async def test_add_reaction(client: AsyncClient):
    # Create message
    response = await client.post("/api/messages/send", json={
        "conversation_id": "conv_123",
        "content": "Test message"
    })
    message_id = response.json()["message_id"]
    
    # Add reaction
    response = await client.post(
        f"/api/messages/{message_id}/reactions",
        json={"emoji": "❤️"}
    )
    assert response.status_code == 200
    assert response.json()["action"] == "added"
    
    # Toggle off
    response = await client.post(
        f"/api/messages/{message_id}/reactions",
        json={"emoji": "❤️"}
    )
    assert response.json()["action"] == "removed"

async def test_invalid_emoji(client: AsyncClient):
    response = await client.post(
        "/api/messages/msg_123/reactions",
        json={"emoji": "🦄"}  # Not in allowed list
    )
    assert response.status_code == 400
    assert "Invalid emoji" in response.json()["detail"]

async def test_mark_read(client: AsyncClient):
    response = await client.post("/api/messages/msg_123/read")
    assert response.status_code == 200
    assert response.json()["message"] == "Message marked as read"
```

#### Frontend Tests

```typescript
// MessageReactions.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MessageReactions } from '../MessageReactions';

describe('MessageReactions', () => {
  it('renders reactions correctly', () => {
    const reactions = {
      '❤️': [{ user_id: 'user1', created_at: '2024-01-01' }]
    };
    
    const { getByText } = render(
      <MessageReactions
        messageId="msg_123"
        reactions={reactions}
        currentUserId="user2"
      />
    );
    
    expect(getByText('❤️')).toBeTruthy();
    expect(getByText('1')).toBeTruthy();
  });

  it('toggles reaction on press', async () => {
    const onUpdate = jest.fn();
    
    const { getByText } = render(
      <MessageReactions
        messageId="msg_123"
        reactions={{}}
        currentUserId="user1"
        onReactionUpdate={onUpdate}
      />
    );
    
    fireEvent.press(getByText('React'));
    fireEvent.press(getByText('❤️'));
    
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
  });
});
```

---

## Security Considerations

### Input Validation

✅ **Emoji Validation:**
- Only 10 predefined emojis allowed
- Prevents XSS via emoji injection
- Server-side validation with Pydantic

✅ **Message Content:**
- Max length: 10,000 characters
- Sanitized before storage
- HTML stripped on display

✅ **File Uploads:**
- Voice messages: Max 50MB
- Allowed types validated
- Virus scanning (recommended for production)

### Authentication & Authorization

✅ **Socket.IO:**
- User ID verified on connection
- Room access validated
- JWT authentication (optional)

✅ **API Endpoints:**
- All endpoints require authentication
- Message ownership verified before deletion
- Group membership checked for actions

✅ **Read Receipts:**
- Only sender receives read notifications
- Privacy-respecting (no tracking of non-readers)
- Group members only see their own read status

### Rate Limiting

✅ **Typing Events:**
- Debounced to max 1 per second
- Prevents spam
- Auto-timeout after 3s inactivity

✅ **Reactions:**
- No rate limit needed (toggle behavior prevents spam)
- Max 1 reaction per emoji per user per message

### Data Privacy

✅ **Group Messages:**
- Only group members see messages
- Removed members lose access
- Admin-only member management

✅ **Read Receipts:**
- Optional per user (can be disabled)
- Not shown to non-participants
- Timestamps only for direct recipients

---

## Performance Optimization

### Backend

✅ **Database Indexes:**
```python
# message_reactions
db.message_reactions.create_index([("message_id", 1), ("user_id", 1)], unique=True)
db.message_reactions.create_index("message_id")

# messages
db.messages.create_index([("conversation_id", 1), ("created_at", -1)])

# conversations
db.conversations.create_index("participants")
db.conversations.create_index([("is_group", 1), ("updated_at", -1)])
```

✅ **Query Optimization:**
- Pagination for message lists
- Projection to exclude unnecessary fields
- Aggregation pipelines for reaction counts

✅ **Socket.IO:**
- Room-based broadcasting (not global)
- Message queuing for offline users
- Connection pooling

### Frontend

✅ **React Optimization:**
- `React.memo` on components
- `useMemo` for derived state
- `useCallback` for event handlers

✅ **Socket.IO:**
- Event listener cleanup on unmount
- Debounced typing events
- Batched state updates

✅ **Rendering:**
- FlatList for message lists
- `windowSize` optimization
- `removeClippedSubviews` enabled

---

## Troubleshooting

### Socket.IO Not Connecting

**Symptoms:**
- Typing indicators not working
- Reactions not real-time
- Messages not appearing instantly

**Solutions:**
1. Check backend URL in `.env`:
   ```
   EXPO_PUBLIC_BACKEND_URL=https://your-backend.com
   ```

2. Verify CORS settings:
   ```python
   # backend/server.py
   sio = socketio.AsyncServer(
       cors_allowed_origins=["http://localhost:8081", "https://your-frontend.com"]
   )
   ```

3. Check network logs:
   ```typescript
   // frontend/services/socket.ts
   console.log('Socket.IO Backend URL:', BACKEND_URL);
   ```

4. Test connection manually:
   ```bash
   curl -X GET https://your-backend.com/socket.io/?transport=polling
   ```

---

### Reactions Not Syncing

**Symptoms:**
- Reaction appears locally but not on other devices
- Reaction counts mismatch

**Solutions:**
1. Check Socket.IO connection
2. Verify user is in conversation room:
   ```typescript
   socketService.joinConversation(conversationId, userId);
   ```

3. Check event listeners are set up:
   ```typescript
   const cleanup = socketService.onMessageReaction((data) => {
     console.log('Reaction received:', data);
   });
   ```

4. Verify backend emits to correct room:
   ```python
   await sio.emit('message:reaction', data, room=f"conversation_{conversation_id}")
   ```

---

### Typing Indicator Stuck

**Symptoms:**
- "X is typing..." never disappears
- Multiple users stuck typing

**Solutions:**
1. Ensure typing stop is called:
   ```typescript
   socketService.typingStop(conversationId, userId);
   ```

2. Add timeout:
   ```typescript
   setTimeout(() => {
     socketService.typingStop(conversationId, userId);
   }, 3000);
   ```

3. Clear typing on screen unmount:
   ```typescript
   useEffect(() => {
     return () => {
       socketService.typingStop(conversationId, userId);
     };
   }, []);
   ```

---

### Read Receipts Not Working

**Symptoms:**
- Checkmarks stay gray
- Read status not updating

**Solutions:**
1. Verify read endpoint is called:
   ```typescript
   await api.markMessageRead(messageId);
   ```

2. Check Socket.IO event:
   ```typescript
   const cleanup = socketService.onMessageRead((data) => {
     console.log('Message read:', data);
   });
   ```

3. Verify conversation_id exists:
   ```python
   conversation_id = message.get("conversation_id")
   if conversation_id:
       await sio.emit('message:read', data, room=f"conversation_{conversation_id}")
   ```

---

## Future Enhancements

### Planned Features

1. **Message Edit/Delete**
   - Edit sent messages (within 15min)
   - Delete for everyone
   - Edit history

2. **Rich Media**
   - Image reactions (stickers)
   - GIF picker integration
   - Video messages

3. **Message Search**
   - Full-text search
   - Filter by sender
   - Date range search

4. **Message Forwarding**
   - Forward to multiple chats
   - Forward with comment
   - Share to stories

5. **Voice/Video Calls**
   - 1:1 voice calls
   - Group voice calls
   - Video conferencing

6. **Message Threads**
   - Reply to specific message
   - Thread view
   - Threaded notifications

7. **Advanced Read Receipts**
   - "Seen by N people" in groups
   - Read by list
   - Read receipt settings per chat

8. **Message Scheduling**
   - Schedule messages
   - Recurring messages
   - Reminder messages

---

## Support

For issues or questions:
- GitHub Issues: [github.com/jarell94/grover/issues](https://github.com/jarell94/grover/issues)
- Email: support@grover.app
- Discord: discord.gg/grover

---

## License

Copyright © 2024 Grover. All rights reserved.

---

## Changelog

### v2.0.0 (2024-02-05)
- ✨ Added message reactions with 10 emojis
- ✨ Added read receipts with timestamps
- ✨ Added typing indicators with animations
- ✨ Enhanced Socket.IO with new events
- 🐛 Fixed group message read tracking
- 🔒 Improved security with Pydantic validation
- ⚡ Performance optimizations

### v1.0.0 (Initial)
- Group chats
- Voice messages
- Live stream notifications
- Basic messaging
