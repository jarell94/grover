# Content Moderation Implementation Guide

**Critical for App Store Approval**

Both Apple App Store and Google Play Store **require** robust content moderation for apps with user-generated content. This guide covers implementing required features.

## Required Moderation Features

### 1. Report Content System ✅ (Priority: CRITICAL)

#### Backend Implementation

**Add to `backend/server.py` or create `backend/routers/moderation.py`:**

```python
from pydantic import BaseModel
from typing import Literal

class ReportCreate(BaseModel):
    content_type: Literal["post", "comment", "message", "user", "stream"]
    content_id: str
    reason: Literal[
        "spam",
        "harassment",
        "hate_speech",
        "violence",
        "sexual_content",
        "copyright",
        "illegal_content",
        "self_harm",
        "misinformation",
        "other"
    ]
    description: Optional[str] = None

@app.post("/reports")
async def create_report(
    report: ReportCreate,
    authorization: str = Header(None)
):
    """Report inappropriate content or users"""
    user = await authenticate_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Validate IDs
    content_id = validate_id(report.content_id, "Content ID")
    
    # Create report
    report_doc = {
        "_id": str(uuid.uuid4()),
        "reporter_id": user["_id"],
        "content_type": report.content_type,
        "content_id": content_id,
        "reason": report.reason,
        "description": sanitize_string(report.description) if report.description else None,
        "status": "pending",  # pending, reviewed, actioned, dismissed
        "created_at": datetime.now(timezone.utc),
        "reviewed_at": None,
        "reviewed_by": None,
        "action_taken": None
    }
    
    await db.reports.insert_one(report_doc)
    
    # Auto-flag high-priority reports
    if report.reason in ["self_harm", "illegal_content", "violence"]:
        # Send urgent notification to moderators
        await notify_moderators_urgent(report_doc)
    
    return {"message": "Report submitted successfully", "report_id": report_doc["_id"]}

@app.get("/reports")
async def get_reports(
    status: Optional[str] = "pending",
    skip: int = 0,
    limit: int = 20,
    authorization: str = Header(None)
):
    """Get reports for moderation (moderators only)"""
    user = await authenticate_user(authorization)
    if not user or not user.get("is_moderator"):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    skip, limit = validate_pagination(skip, limit)
    
    query = {}
    if status:
        query["status"] = status
    
    reports = await db.reports.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"reports": reports, "total": await db.reports.count_documents(query)}

@app.put("/reports/{report_id}")
async def update_report(
    report_id: str,
    action: Literal["dismiss", "warn", "remove_content", "suspend_user", "ban_user"],
    notes: Optional[str] = None,
    authorization: str = Header(None)
):
    """Take action on a report (moderators only)"""
    user = await authenticate_user(authorization)
    if not user or not user.get("is_moderator"):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    report_id = validate_id(report_id, "Report ID")
    
    report = await db.reports.find_one({"_id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Update report
    await db.reports.update_one(
        {"_id": report_id},
        {
            "$set": {
                "status": "actioned",
                "reviewed_at": datetime.now(timezone.utc),
                "reviewed_by": user["_id"],
                "action_taken": action,
                "moderator_notes": sanitize_string(notes) if notes else None
            }
        }
    )
    
    # Execute action
    if action == "remove_content":
        await remove_content(report["content_type"], report["content_id"])
    elif action == "warn":
        await warn_user(report["content_id"] if report["content_type"] == "user" else None)
    elif action == "suspend_user":
        await suspend_user(report["content_id"], days=7)
    elif action == "ban_user":
        await ban_user(report["content_id"])
    
    return {"message": f"Action {action} taken successfully"}
```

#### Frontend Implementation

**Create `frontend/components/ReportModal.tsx`:**

```typescript
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'post' | 'comment' | 'user' | 'message' | 'stream';
  contentId: string;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'sexual_content', label: 'Sexual or explicit content' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'illegal_content', label: 'Illegal activity' },
  { value: 'self_harm', label: 'Self-harm or suicide' },
  { value: 'misinformation', label: 'False information' },
  { value: 'other', label: 'Other' },
];

export default function ReportModal({ visible, onClose, contentType, contentId }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId,
          reason: selectedReason,
          description: description || null,
        }),
      });

      if (response.ok) {
        Alert.alert('Thank you', 'Your report has been submitted. We will review it shortly.');
        onClose();
        setSelectedReason('');
        setDescription('');
      } else {
        Alert.alert('Error', 'Failed to submit report. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <View style={styles.modal}>
          <Text style={styles.title}>Report {contentType}</Text>
          <Text style={styles.subtitle}>Why are you reporting this?</Text>
          
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.value}
              style={[
                styles.reasonButton,
                selectedReason === reason.value && styles.reasonButtonSelected,
              ]}
              onPress={() => setSelectedReason(reason.value)}
            >
              <Text style={styles.reasonText}>{reason.label}</Text>
            </TouchableOpacity>
          ))}
          
          <TextInput
            style={styles.input}
            placeholder="Additional details (optional)"
            multiline
            value={description}
            onChangeText={setDescription}
            maxLength={500}
          />
          
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

### 2. Block/Mute Users ✅ (Priority: CRITICAL)

**Backend:**

```python
@app.post("/users/block")
async def block_user(
    user_id: str,
    authorization: str = Header(None)
):
    """Block a user"""
    current_user = await authenticate_user(authorization)
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user_id = validate_id(user_id, "User ID")
    
    # Add to blocked list
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"blocked_users": user_id}}
    )
    
    # Remove from followers/following
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"following": user_id}}
    )
    await db.users.update_one(
        {"_id": user_id},
        {"$pull": {"followers": current_user["_id"]}}
    )
    
    return {"message": "User blocked successfully"}

@app.post("/users/mute")
async def mute_user(
    user_id: str,
    authorization: str = Header(None)
):
    """Mute a user (hide their content without blocking)"""
    current_user = await authenticate_user(authorization)
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user_id = validate_id(user_id, "User ID")
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"muted_users": user_id}}
    )
    
    return {"message": "User muted successfully"}
```

### 3. Automated Content Filtering (Priority: HIGH)

**Install content moderation libraries:**

```bash
pip install better-profanity
pip install detoxify  # AI-based toxicity detection
```

**Implementation:**

```python
from better_profanity import profanity
from detoxify import Detoxify

# Initialize
profanity.load_censor_words()
toxicity_model = Detoxify('original')

def moderate_text(text: str) -> dict:
    """
    Moderate text for inappropriate content
    Returns: {
        'flagged': bool,
        'reason': str,
        'confidence': float
    }
    """
    # Check profanity
    if profanity.contains_profanity(text):
        return {
            'flagged': True,
            'reason': 'profanity',
            'confidence': 1.0
        }
    
    # Check toxicity with AI
    results = toxicity_model.predict(text)
    
    # Flag if any category exceeds threshold
    threshold = 0.7
    for category, score in results.items():
        if score > threshold:
            return {
                'flagged': True,
                'reason': category,
                'confidence': float(score)
            }
    
    return {'flagged': False, 'reason': None, 'confidence': 0.0}

@app.post("/posts")
async def create_post(
    content: str,
    media_urls: List[str] = [],
    authorization: str = Header(None)
):
    """Create post with automatic content moderation"""
    user = await authenticate_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Moderate content
    moderation_result = moderate_text(content)
    
    if moderation_result['flagged']:
        # Log for review
        await db.flagged_content.insert_one({
            "user_id": user["_id"],
            "content": content,
            "reason": moderation_result['reason'],
            "confidence": moderation_result['confidence'],
            "created_at": datetime.now(timezone.utc)
        })
        
        # Reject high-confidence violations
        if moderation_result['confidence'] > 0.9:
            raise HTTPException(
                status_code=400,
                detail="Content violates community guidelines"
            )
    
    # Create post...
    post = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "content": sanitize_string(content),
        "media_urls": media_urls,
        "flagged": moderation_result['flagged'],
        "moderation_score": moderation_result['confidence'],
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.posts.insert_one(post)
    return post
```

### 4. Age Verification (Priority: CRITICAL)

**Add to signup flow:**

```python
from datetime import date

@app.post("/signup")
async def signup(
    username: str,
    email: str,
    password: str,
    date_of_birth: str  # ISO format: YYYY-MM-DD
):
    """Signup with age verification"""
    
    # Validate date of birth
    try:
        dob = datetime.fromisoformat(date_of_birth).date()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Calculate age
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    
    # Enforce age requirements
    if age < 13:
        raise HTTPException(
            status_code=400,
            detail="You must be at least 13 years old to use Grover"
        )
    
    if age < 18:
        # Require parental consent
        # Set account restrictions
        account_type = "minor"
        requires_parental_consent = True
    else:
        account_type = "adult"
        requires_parental_consent = False
    
    # Create user...
    user = {
        "_id": str(uuid.uuid4()),
        "username": username,
        "email": email,
        "password_hash": hash_password(password),
        "date_of_birth": dob.isoformat(),
        "age": age,
        "account_type": account_type,
        "requires_parental_consent": requires_parental_consent,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user)
    return {"message": "Account created successfully"}
```

## Testing Checklist

Before submission, verify:

- [ ] Report button visible on all user-generated content
- [ ] Block/mute options in user profiles and menus
- [ ] Reports create database entries
- [ ] Moderator dashboard can view and action reports
- [ ] Automated filtering catches obvious violations
- [ ] Age verification prevents users under 13
- [ ] Parental consent flow for 13-17 year olds
- [ ] Content warnings on sensitive material
- [ ] Appeal process is documented
- [ ] Privacy settings allow users to control visibility

## App Store Screenshots

Include screenshots showing:

1. Report content flow (tap "..." → "Report" → select reason)
2. Block user confirmation dialog
3. Privacy settings page
4. Age verification screen
5. Content warning example

## Documentation for Review

Prepare a document for app review explaining:

1. **Content Moderation:** How you detect and remove inappropriate content
2. **User Safety:** Tools available to users (block, mute, report)
3. **Age Restrictions:** How you verify age and restrict access
4. **Response Time:** How quickly you review reports
5. **Appeals:** How users can appeal moderation decisions

---

**Implementation Priority:**

1. **Week 1:** Report system, block/mute features
2. **Week 2:** Age verification, automated filtering
3. **Week 3:** Moderator dashboard, content warnings
4. **Week 4:** Testing, documentation, screenshots

This implementation is **mandatory** for App Store approval. Do not skip.
