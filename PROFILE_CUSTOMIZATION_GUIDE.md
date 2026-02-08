# Profile Customization Guide

## Overview

Grover's profile customization system allows users to personalize their profiles with a comprehensive set of fields and social links. This guide covers all customizable profile features.

---

## ✅ Complete Feature List

### Basic Information
1. **Name** - Display name shown across the platform
2. **Username** - Unique identifier (e.g., @johndoe) 
3. **Bio** - Profile description/about section
4. **Profile Picture** - User avatar (via Google OAuth)
5. **Email** - User email address (non-editable, from OAuth)

### Account Settings
1. **Privacy** - Toggle between public and private account
2. **Monetization** - Enable creator features (tips, subscriptions, paid content)

### Social Media Links
1. **Website** - Personal website URL
2. **Twitter** - Twitter username (displayed as @username)
3. **Instagram** - Instagram username (displayed as @username)
4. **LinkedIn** - LinkedIn profile URL or username

### Payment Information
1. **PayPal Email** - For receiving payments from tips, subscriptions, and marketplace sales

---

## 🆕 Username Feature

### What is it?
A unique, customizable identifier that appears as @username on your profile and throughout the app.

### Key Features
- **Unique**: No two users can have the same username
- **URL-Safe**: Only letters, numbers, hyphens, and underscores
- **Memorable**: Easier to remember than user_id strings
- **Optional**: Can be set anytime, not required on signup
- **Permanent**: Once set, represents you across the platform

### Username Rules

#### Length Requirements
- Minimum: 3 characters
- Maximum: 30 characters

#### Format Requirements
- Must start with a letter or number
- Must end with a letter or number
- Can contain letters (a-z), numbers (0-9), hyphens (-), underscores (_)
- Case-insensitive (stored as lowercase)
- No spaces allowed
- No consecutive special characters (e.g., `--` or `__`)

#### Valid Examples
```
✓ johndoe
✓ john_doe
✓ john-doe
✓ john123
✓ j0hn_d03
✓ user2024
```

#### Invalid Examples
```
✗ ab              (too short)
✗ -johndoe        (starts with special character)
✗ johndoe-        (ends with special character)
✗ john--doe       (consecutive special characters)
✗ john doe        (contains space)
✗ JOHNDOE         (will be converted to johndoe)
✗ john@doe        (invalid character @)
✗ admin           (reserved username)
```

#### Reserved Usernames
The following usernames are reserved and cannot be used:
- admin
- api
- app
- grover
- system
- support
- help
- about
- settings
- auth
- login
- logout
- signup
- register

---

## 📱 How to Customize Your Profile

### Step 1: Access Edit Profile
1. Navigate to your profile tab
2. Tap the "Edit Profile" button
3. The edit modal will open

### Step 2: Edit Basic Information
- **Name**: Enter your display name
- **Username**: Choose your unique @username
  - Real-time availability checking
  - Visual feedback (✓ Available / ✗ Taken)
  - Format validation
- **Bio**: Add a description about yourself (up to 500 characters)

### Step 3: Add Social Links
- **Website**: Enter your website URL (http:// or https:// auto-added)
- **Twitter**: Enter username without @ symbol
- **Instagram**: Enter username without @ symbol
- **LinkedIn**: Enter profile URL or username

### Step 4: Add Payment Info (Optional)
- **PayPal Email**: Add your PayPal email to receive payments
  - Required if you enable monetization
  - Validated for correct email format

### Step 5: Save Changes
- Tap "Save Changes"
- Your profile will update immediately
- Changes sync across all devices

---

## 🎨 Profile Display

### Profile Header
```
[Profile Picture]
John Doe              ← Name
@johndoe              ← Username (if set)
john@example.com      ← Email
"Bio text here..."    ← Bio (if set)

[Website] [Twitter] [Instagram] [LinkedIn]  ← Social Links

[Posts: 45] [Followers: 1.2K] [Following: 234]

[Edit Profile Button]
```

### How It Appears to Others
- Your name is the primary identifier
- Username appears as @username below name
- Bio is shown if you've added one
- Social links are clickable buttons
- Stats show your engagement

---

## 🔧 Technical Details

### Backend API

#### Update Profile
```http
PUT /api/users/me
Content-Type: application/json

{
  "name": "John Doe",
  "username": "johndoe",
  "bio": "Software developer and coffee enthusiast",
  "website": "https://johndoe.com",
  "twitter": "johndoe",
  "instagram": "johndoe",
  "linkedin": "johndoe",
  "paypal_email": "payments@johndoe.com",
  "is_private": false,
  "monetization_enabled": true
}
```

#### Check Username Availability
```http
GET /api/users/check-username/{username}

Response:
{
  "available": true,
  "username": "johndoe"
}

// or

{
  "available": false,
  "error": "Username is already taken"
}
```

### Database Schema

#### User Model
```python
class User(BaseModel):
    user_id: str
    email: str
    name: str
    username: Optional[str] = None  # NEW!
    picture: Optional[str] = None
    bio: Optional[str] = ""
    is_premium: bool = False
    is_private: bool = False
    monetization_enabled: bool = False
    # Verification fields
    is_verified: bool = False
    verification_type: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_note: Optional[str] = None
    # Social links
    website: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    paypal_email: Optional[str] = None
    # ... other fields
```

#### Indexes
```python
# Unique index on username (sparse for backwards compatibility)
db.users.create_index("username", unique=True, sparse=True)
```

---

## 🔒 Privacy & Security

### What's Visible
- Public profiles: All information visible to everyone
- Private profiles: Only name, username, and picture visible to non-followers

### What's Protected
- Email address: Only visible to the account owner
- PayPal email: Only visible to the account owner
- Payment transactions: Private and encrypted

### Security Features
- Input validation on all fields
- SQL/NoSQL injection prevention
- XSS attack prevention
- URL validation for links
- Email validation for PayPal

---

## 📊 Character Limits

| Field | Minimum | Maximum | Notes |
|-------|---------|---------|-------|
| Name | 1 | 100 | Required |
| Username | 3 | 30 | Optional, unique |
| Bio | 0 | 500 | Optional |
| Website | 0 | 200 | Optional, validated |
| Twitter | 0 | 50 | Optional |
| Instagram | 0 | 50 | Optional |
| LinkedIn | 0 | 100 | Optional |
| PayPal Email | 0 | 100 | Optional, email format |

---

## 💡 Best Practices

### Choosing a Username
1. **Keep it simple**: Easy to remember and type
2. **Be consistent**: Use the same username across platforms
3. **Brand yourself**: Use your real name or brand name
4. **Avoid numbers**: Unless they're part of your brand
5. **Check availability**: Try multiple options

### Writing a Good Bio
1. **Be concise**: People skim profiles
2. **Highlight interests**: What do you do?
3. **Add personality**: Show your unique voice
4. **Include keywords**: Help people find you
5. **Update regularly**: Keep it current

### Adding Social Links
1. **Verify links**: Make sure URLs work
2. **Use all platforms**: More ways to connect
3. **Keep consistent**: Use same handle across platforms
4. **Update when changed**: Keep links current

---

## 🐛 Troubleshooting

### Username Issues

**"Username is already taken"**
- Try variations: add numbers, hyphens, or underscores
- Check spelling
- Try different combinations

**"Username must be at least 3 characters"**
- Add more characters
- Minimum is 3, maximum is 30

**"Username cannot contain consecutive special characters"**
- Remove double hyphens (--) or underscores (__)
- Use single special characters only

**"This username is reserved"**
- System usernames are protected
- Choose a different username

### Profile Update Issues

**Changes not saving**
- Check internet connection
- Ensure all required fields are filled
- Check for validation errors
- Try again after a few seconds

**Username availability check not working**
- Wait a moment for the check to complete
- Check internet connection
- Try a different username

---

## 🆕 Recent Updates

### Version 3.0 (Current)
- ✅ Added username field with real-time availability checking
- ✅ Improved profile edit modal UI
- ✅ Added visual validation feedback
- ✅ Enhanced social link integration
- ✅ Better error messages

### Version 2.0
- Added monetization toggle
- Added PayPal email field
- Improved privacy settings
- Enhanced social links

### Version 1.0
- Initial profile customization
- Name, bio, social links
- Basic privacy settings

---

## 📞 Support

### Need Help?
- Check this guide for common questions
- Visit the Help Center in the app
- Contact support@grover.com
- Report bugs via the app feedback form

### Feature Requests
Have an idea for profile customization? We'd love to hear it!
- Submit via in-app feedback
- Email: feedback@grover.com
- Tag us on social media with #GroverFeedback

---

## 🎯 Future Enhancements

### Planned Features
- ⏳ Profile cover photos
- ⏳ Custom profile themes
- ⏳ More social platform options (GitHub, YouTube, TikTok)
- ⏳ Custom link fields
- ⏳ Profile verification badges
- ⏳ Profile analytics

### Under Consideration
- Profile badges (achievements, milestones)
- Custom profile layouts
- Bio formatting (markdown)
- Profile QR codes
- Username history/changes

---

## 📝 Summary

Profile customization on Grover is comprehensive and flexible:

✅ **11 customizable fields**
✅ **Real-time validation**
✅ **Unique usernames**
✅ **Social integration**
✅ **Privacy controls**
✅ **Monetization support**

Your profile, your way! 🎨
