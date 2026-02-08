# Creator Subscription System Documentation

## Overview

The Creator Subscription System enables creators to monetize their content through monthly subscriptions while rewarding loyal supporters with tiered badges. This feature includes three core components:

1. **Subscription Plans** - Customizable monthly subscription tiers
2. **Exclusive Content** - Subscriber-only posts and media
3. **Supporter Badges** - Automated badges based on subscription duration

---

## Features

### For Creators

#### Subscription Tiers
- Create unlimited subscription tiers
- Set custom pricing (minimum $0.99)
- Add tier descriptions and benefits
- Manage tier status (active/inactive)

#### Revenue
- 85% payout (15% platform fee)
- Monthly billing cycle
- Real-time analytics dashboard
- Transparent fee breakdown

#### Exclusive Content
- Mark posts as subscriber-only
- Automatic access control
- Optional minimum tier requirement
- Mixed public/exclusive feed

#### Analytics
- Total subscriber count
- Monthly revenue projections
- Tier-by-tier breakdown
- Badge distribution stats
- Recent subscription activity

### For Subscribers

#### Subscription Benefits
- Support favorite creators
- Access exclusive content
- Earn tiered supporter badges
- Cancel anytime

#### Badge Progression
- 🥉 **Bronze**: 0-3 months
- ⭐ **Silver**: 3-6 months  
- 👑 **Gold**: 6-12 months
- 💎 **Diamond**: 12+ months

#### Content Access
- Automatic exclusive content unlock
- Dedicated exclusive content feed
- Badge display on profile/comments
- Subscription status visible to creator

---

## API Reference

### Subscription Management

#### Create Subscription Tier
```http
POST /creators/{creator_id}/subscription-tiers
Authorization: ******

{
  "name": "VIP Supporter",
  "price": 9.99,
  "description": "Get exclusive access to all my content",
  "benefits": [
    "Exclusive posts",
    "Behind-the-scenes content",
    "Monthly Q&A sessions",
    "Supporter badge"
  ]
}
```

**Response:**
```json
{
  "tier_id": "tier_abc123xyz",
  "message": "Subscription tier created"
}
```

#### Get Creator's Tiers
```http
GET /creators/{creator_id}/subscription-tiers
Authorization: ******
```

**Response:**
```json
[
  {
    "tier_id": "tier_abc123xyz",
    "creator_id": "user_123",
    "name": "VIP Supporter",
    "price": 9.99,
    "description": "Get exclusive access to all my content",
    "benefits": ["Exclusive posts", "Behind-the-scenes content"],
    "active": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

#### Subscribe to Creator
```http
POST /creators/{creator_id}/subscribe/{tier_id}
Authorization: ******
```

**Response:**
```json
{
  "subscription_id": "sub_xyz789abc",
  "message": "Subscribed to VIP Supporter",
  "amount": 9.99,
  "platform_fee": 1.50,
  "creator_receives": 8.49,
  "next_billing": "2024-02-15T10:30:00Z"
}
```

#### Cancel Subscription
```http
DELETE /subscriptions/{subscription_id}
Authorization: ******
```

**Response:**
```json
{
  "message": "Subscription cancelled"
}
```

#### Get My Subscriptions
```http
GET /subscriptions/my-subscriptions
Authorization: ******
```

**Response:**
```json
[
  {
    "subscription_id": "sub_xyz789abc",
    "subscriber_id": "user_456",
    "creator_id": "user_123",
    "tier_id": "tier_abc123xyz",
    "amount": 9.99,
    "status": "active",
    "started_at": "2024-01-15T10:30:00Z",
    "next_billing": "2024-02-15T10:30:00Z",
    "creator": {
      "name": "Creator Name",
      "picture": "https://..."
    },
    "tier": {
      "name": "VIP Supporter",
      "price": 9.99,
      "benefits": ["..."]
    }
  }
]
```

#### Get My Subscribers
```http
GET /subscriptions/my-subscribers
Authorization: ******
```

**Response:**
```json
[
  {
    "subscription_id": "sub_xyz789abc",
    "subscriber_id": "user_456",
    "tier_id": "tier_abc123xyz",
    "amount": 9.99,
    "status": "active",
    "started_at": "2024-01-15T10:30:00Z",
    "subscriber": {
      "name": "Subscriber Name",
      "picture": "https://..."
    },
    "tier": {
      "name": "VIP Supporter",
      "price": 9.99
    }
  }
]
```

#### Check Subscription Status
```http
GET /users/{user_id}/subscription-status/{creator_id}
Authorization: ******
```

**Response (Subscribed):**
```json
{
  "subscribed": true,
  "subscription_id": "sub_xyz789abc",
  "tier": {
    "tier_id": "tier_abc123xyz",
    "name": "VIP Supporter",
    "price": 9.99
  },
  "badge": {
    "badge_level": "Gold",
    "badge_color": "#FFD700",
    "badge_icon": "👑",
    "tier_name": "VIP Supporter",
    "duration_months": 8,
    "subscriber_since": "2024-01-15T10:30:00Z"
  },
  "started_at": "2024-01-15T10:30:00Z",
  "next_billing": "2024-02-15T10:30:00Z"
}
```

**Response (Not Subscribed):**
```json
{
  "subscribed": false
}
```

### Exclusive Content

#### Set Post as Exclusive
```http
POST /posts/{post_id}/set-exclusive
Authorization: ******

{
  "exclusive": true,
  "min_tier_id": "tier_abc123xyz"  // Optional
}
```

**Response:**
```json
{
  "message": "Post set as exclusive content"
}
```

#### Get Exclusive Posts
```http
GET /posts/exclusive?limit=20&skip=0
Authorization: ******
```

**Response:**
```json
[
  {
    "post_id": "post_123",
    "user_id": "user_123",
    "content": "Exclusive content for my supporters!",
    "is_exclusive": true,
    "created_at": "2024-01-15T10:30:00Z",
    "user": {
      "name": "Creator Name",
      "picture": "https://..."
    },
    "my_badge": {
      "badge_level": "Gold",
      "badge_icon": "👑",
      "duration_months": 8
    }
  }
]
```

### Supporter Badges

#### Get User's Badges
```http
GET /users/{user_id}/badges
Authorization: ******
```

**Response:**
```json
[
  {
    "badge_id": "badge_abc123",
    "user_id": "user_456",
    "creator_id": "user_123",
    "badge_level": "Gold",
    "badge_color": "#FFD700",
    "badge_icon": "👑",
    "tier_name": "VIP Supporter",
    "duration_months": 8,
    "subscriber_since": "2024-01-15T10:30:00Z",
    "updated_at": "2024-09-15T10:30:00Z",
    "creator": {
      "user_id": "user_123",
      "name": "Creator Name",
      "picture": "https://..."
    }
  }
]
```

#### Get Specific Badge
```http
GET /creators/{creator_id}/badge/{user_id}
Authorization: ******
```

**Response:**
```json
{
  "badge_level": "Gold",
  "badge_color": "#FFD700",
  "badge_icon": "👑",
  "tier_name": "VIP Supporter",
  "duration_months": 8,
  "subscriber_since": "2024-01-15T10:30:00Z"
}
```

### Analytics

#### Get Subscription Analytics
```http
GET /creators/me/subscription-analytics
Authorization: ******
```

**Response:**
```json
{
  "total_subscribers": 47,
  "monthly_revenue": 399.15,
  "gross_revenue": 469.53,
  "platform_fee": 70.38,
  "tier_breakdown": [
    {
      "_id": "tier_abc123xyz",
      "count": 32,
      "total_revenue": 319.68,
      "tier": {
        "name": "VIP Supporter",
        "price": 9.99
      }
    },
    {
      "_id": "tier_def456uvw",
      "count": 15,
      "total_revenue": 149.85,
      "tier": {
        "name": "Premium",
        "price": 9.99
      }
    }
  ],
  "badge_distribution": {
    "Diamond": 5,
    "Gold": 12,
    "Silver": 18,
    "Bronze": 12
  },
  "recent_subscriptions": [
    {
      "subscription_id": "sub_latest",
      "subscriber_id": "user_789",
      "tier_id": "tier_abc123xyz",
      "started_at": "2024-09-20T14:22:00Z"
    }
  ]
}
```

---

## Database Schema

### subscription_tiers
```javascript
{
  tier_id: "tier_abc123xyz",      // Unique identifier
  creator_id: "user_123",         // Creator's user_id
  name: "VIP Supporter",          // Tier name
  price: 9.99,                    // Monthly price in USD
  description: "...",             // Optional description
  benefits: ["...", "..."],       // List of benefits
  active: true,                   // Active/inactive status
  created_at: ISODate("2024-01-15T10:30:00Z")
}
```

**Indexes:**
- `tier_id` (unique)
- `creator_id + active`

### creator_subscriptions
```javascript
{
  subscription_id: "sub_xyz789abc", // Unique identifier
  subscriber_id: "user_456",        // Subscriber's user_id
  creator_id: "user_123",           // Creator's user_id
  tier_id: "tier_abc123xyz",        // Subscription tier
  amount: 9.99,                     // Monthly amount
  platform_fee: 1.50,               // Platform's cut (15%)
  creator_payout: 8.49,             // Creator's cut (85%)
  status: "active",                 // active | cancelled
  started_at: ISODate("2024-01-15T10:30:00Z"),
  next_billing: ISODate("2024-02-15T10:30:00Z"),
  cancelled_at: ISODate("..."),     // If cancelled
  created_at: ISODate("2024-01-15T10:30:00Z")
}
```

**Indexes:**
- `subscription_id` (unique)
- `subscriber_id + status`
- `creator_id + status`
- `subscriber_id + creator_id`

### supporter_badges
```javascript
{
  badge_id: "badge_abc123",         // Unique identifier
  user_id: "user_456",              // Badge owner
  creator_id: "user_123",           // Creator being supported
  badge_level: "Gold",              // Bronze | Silver | Gold | Diamond
  badge_color: "#FFD700",           // Hex color
  badge_icon: "👑",                 // Emoji icon
  tier_name: "VIP Supporter",       // Current tier name
  duration_months: 8,               // Approximate months
  subscriber_since: ISODate("2024-01-15T10:30:00Z"),
  created_at: ISODate("2024-01-15T10:30:00Z"),
  updated_at: ISODate("2024-09-15T10:30:00Z")
}
```

**Indexes:**
- `user_id + creator_id` (unique)
- `user_id`

---

## Frontend Components

### SubscriptionPlansScreen
**Path:** `frontend/app/subscription-plans.tsx`

**Purpose:** Creator dashboard for managing subscription tiers

**Features:**
- View subscription analytics
- Create new subscription tiers
- List existing tiers with benefits
- Badge distribution visualization
- Revenue tracking

**Usage:**
```typescript
// Navigate from creator profile or settings
router.push('/subscription-plans');
```

### SubscribeScreen
**Path:** `frontend/app/subscribe.tsx`

**Purpose:** User interface for subscribing to creators

**Features:**
- View creator profile
- See available subscription tiers
- Subscribe to a tier
- View current subscription status
- Cancel subscription
- Badge progression guide

**Usage:**
```typescript
// Navigate with creator ID
router.push(`/subscribe?creatorId=${userId}`);
```

### SupporterBadge Component
**Path:** `frontend/components/SupporterBadge.tsx`

**Purpose:** Reusable badge display component

**Props:**
```typescript
interface BadgeProps {
  level: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onPress?: () => void;
}
```

**Usage:**
```tsx
import SupporterBadge from '../components/SupporterBadge';

// Simple badge
<SupporterBadge level="Gold" />

// With label
<SupporterBadge level="Diamond" size="large" showLabel />

// Interactive
<SupporterBadge 
  level="Silver" 
  onPress={() => showBadgeInfo()} 
/>
```

---

## Badge System

### Tier Thresholds
```python
BADGE_BRONZE_DAYS = 0      # 0-90 days
BADGE_SILVER_DAYS = 90     # 90-180 days (3 months)
BADGE_GOLD_DAYS = 180      # 180-365 days (6 months)
BADGE_DIAMOND_DAYS = 365   # 365+ days (12 months)
```

### Badge Properties
| Tier | Icon | Color | Duration |
|------|------|-------|----------|
| Bronze | 🥉 | #CD7F32 | 0-3 months |
| Silver | ⭐ | #C0C0C0 | 3-6 months |
| Gold | 👑 | #FFD700 | 6-12 months |
| Diamond | 💎 | #B9F2FF | 12+ months |

### Calculation Logic
- Duration calculated in days (not months) for precision
- Automatic upgrade as subscription ages
- Badge persists even if subscription cancelled
- Recalculated on each view for accuracy

---

## Revenue Model

### Fee Structure
```python
SUBSCRIPTION_PLATFORM_FEE = 0.15    # 15%
SUBSCRIPTION_CREATOR_PAYOUT = 0.85  # 85%
```

### Example Calculation
**Subscription Price:** $9.99/month
- **Gross Revenue:** $9.99
- **Platform Fee (15%):** $1.50
- **Creator Payout (85%):** $8.49

### Billing Cycle
- Monthly billing (30-day cycle)
- Next billing date calculated on subscription
- Automatic renewal (not implemented yet)
- Cancel anytime (no prorated refunds)

### Transaction Recording
All subscriptions recorded in `transactions` collection:
```javascript
{
  transaction_id: "txn_abc123",
  type: "subscriptions",
  from_user_id: "user_456",
  to_user_id: "user_123",
  related_id: "sub_xyz789abc",
  gross_amount: 9.99,
  platform_fee: 1.50,
  creator_payout: 8.49,
  platform_rate: 0.15,
  status: "completed",
  metadata: {
    tier_id: "tier_abc123xyz",
    tier_name: "VIP Supporter"
  },
  created_at: ISODate("...")
}
```

---

## Security

### Authentication
- All endpoints require valid authentication token
- Session validation on every request
- Token passed via Authorization header

### Authorization
- Creators can only manage their own tiers
- Users can only view their own subscriptions
- Subscription status check limited to self
- Badge data publicly viewable

### Monetization Check
Before creating tiers or exclusive content:
```python
if not current_user.monetization_enabled:
    raise HTTPException(
        status_code=403,
        detail="You must enable monetization in your profile settings first."
    )
```

### Input Validation
- Tier price minimum: $0.99
- Name/description sanitized
- Benefits array validated
- Subscription status enum checked
- Badge level validated

---

## Testing

### Manual Testing Checklist

**Creator Flow:**
- [ ] Enable monetization in profile settings
- [ ] Navigate to subscription plans screen
- [ ] Create a subscription tier
- [ ] View tier in list
- [ ] Check analytics display
- [ ] Create exclusive post
- [ ] View subscriber list (after someone subscribes)

**Subscriber Flow:**
- [ ] Navigate to creator profile
- [ ] Tap subscribe button
- [ ] View available tiers
- [ ] Select tier and subscribe
- [ ] Confirm subscription success
- [ ] View exclusive content
- [ ] Check badge display
- [ ] Cancel subscription
- [ ] Verify cancelled status

**Badge System:**
- [ ] Subscribe to creator
- [ ] Check Bronze badge (immediate)
- [ ] Wait 90 days, check Silver badge
- [ ] Wait 180 days, check Gold badge
- [ ] Wait 365 days, check Diamond badge
- [ ] View badge in profile
- [ ] View badge next to comments

### API Testing Examples

**Create Tier:**
```bash
curl -X POST http://localhost:3000/api/creators/user_123/subscription-tiers \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP Supporter",
    "price": 9.99,
    "description": "Exclusive access",
    "benefits": ["Exclusive posts", "Supporter badge"]
  }'
```

**Subscribe:**
```bash
curl -X POST http://localhost:3000/api/creators/user_123/subscribe/tier_abc123 \
  -H "Authorization: ******"
```

**Get Analytics:**
```bash
curl http://localhost:3000/api/creators/me/subscription-analytics \
  -H "Authorization: ******"
```

---

## Future Enhancements

### Payment Integration
- [ ] Stripe/PayPal payment processing
- [ ] Automated monthly billing
- [ ] Payment method management
- [ ] Refund handling

### Subscription Features
- [ ] Annual subscription option (discount)
- [ ] Gift subscriptions
- [ ] Multi-tier discounts
- [ ] Free trial periods
- [ ] Promo codes

### Exclusive Features
- [ ] Subscriber-only live streams
- [ ] Subscriber-only chat rooms
- [ ] Early access to content
- [ ] Downloadable rewards
- [ ] Subscriber polls/voting

### Badge Enhancements
- [ ] Custom badge designs per creator
- [ ] Animated badges
- [ ] Badge showcase on profile
- [ ] Badge achievements/milestones
- [ ] Badge trading/NFTs

### Analytics Enhancements
- [ ] Subscriber growth trends
- [ ] Churn rate tracking
- [ ] Revenue forecasting
- [ ] Tier comparison metrics
- [ ] Subscriber engagement scores

---

## Troubleshooting

### Common Issues

**"Monetization not enabled"**
- Solution: Go to profile settings and enable monetization

**"Already subscribed"**
- Solution: Cancel existing subscription first, then resubscribe

**"Minimum price is $0.99"**
- Solution: Set tier price to at least $0.99

**Badge not updating**
- Solution: Badge updates automatically; check subscription started_at date

**Exclusive content not visible**
- Solution: Verify active subscription to creator

### Support

For issues or questions:
1. Check backend logs for error details
2. Verify database indexes are created
3. Confirm monetization is enabled
4. Test API endpoints directly
5. Check network connectivity

---

## Changelog

### Version 1.0.0 (2024-09-20)
- ✅ Initial release
- ✅ Subscription tier management
- ✅ Subscribe/cancel functionality
- ✅ Exclusive content support
- ✅ Tiered supporter badges
- ✅ Creator analytics dashboard
- ✅ Revenue tracking
- ✅ Frontend UI complete
- ✅ Security audit passed
- ✅ Code review completed

---

**For more information, see:**
- API Reference (this document)
- Backend implementation (`backend/server.py`)
- Frontend screens (`frontend/app/subscription-plans.tsx`, `frontend/app/subscribe.tsx`)
- Badge component (`frontend/components/SupporterBadge.tsx`)
