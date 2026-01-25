# Optional Paywall System - Implementation Guide

## Overview

Grover now supports **optional paywalls** - each user can choose whether to monetize their content. This gives creators flexibility while maintaining platform integrity.

### Key Philosophy
- **Default**: All content is free (paywalls disabled by default)
- **Optional**: Users can enable paywalls if they want
- **Flexible**: Multiple monetization models available
- **User Control**: Can be toggled on/off anytime

---

## Paywall Types

Users can choose their monetization model:

### 1. **Free Creator** (Default)
- All content is free
- Earn from tips, super chats, donations
- Sponsorships and affiliate links
- **Best for**: Building audience, fan engagement

```
✅ Tips enabled
✅ Super Chat enabled
❌ Paywalls disabled
❌ Exclusive content
```

### 2. **Freemium** (Mixed)
- Mix of free and exclusive content
- Some posts/videos free, others paid
- Subscribers get early access
- Pay-per-view options
- **Best for**: Experienced creators wanting passive income

```
✅ Free content tiers
✅ Exclusive content
✅ Pay-per-view
✅ Tips & Super Chat
```

### 3. **Paid Creator** (Premium)
- Most content requires purchase
- One-time purchase access
- Multiple purchase options
- Strong revenue focus
- **Best for**: Premium content creators

```
✅ One-time purchases
✅ Subscription option
✅ Exclusive access
❌ Most content free
```

### 4. **Subscription Only** (Recurring)
- Monthly/yearly subscription model
- Predictable recurring revenue
- Member-only content
- Exclusive communities
- **Best for**: Community-driven creators

```
✅ Monthly subscriptions
✅ Annual plans
✅ Member benefits
✅ Exclusive community
```

---

## Feature Comparison

| Feature | Free | Freemium | Paid | Subscription |
|---------|------|----------|------|--------------|
| **Tips** | ✅ | ✅ | ✅ | ✅ |
| **Super Chat** | ✅ | ✅ | ✅ | ✅ |
| **Donations** | ✅ | ✅ | ✅ | ✅ |
| **Paywalls** | ❌ | ✅ | ✅ | ✅ |
| **One-time purchase** | ❌ | ✅ | ✅ | ❌ |
| **Subscriptions** | ❌ | ⚠️ | ✅ | ✅ |
| **Free preview** | N/A | ✅ | ✅ | ✅ |
| **Affiliate links** | ✅ | ✅ | ✅ | ✅ |
| **Sponsorships** | ✅ | ✅ | ✅ | ✅ |

---

## Implementation Details

### Database Schema

```javascript
// User paywall settings document
{
  user_id: "123",
  paywalls_enabled: false,                    // Master toggle
  paywall_type: "free",                       // Current model
  
  // Content restrictions
  subscription_required_for_content: false,
  paywall_message: "Subscribe for exclusive content",
  exclusive_content_enabled: false,
  
  // Monetization options
  tips_enabled: true,
  super_chat_enabled: true,
  product_sales_enabled: false,
  affiliated_links_enabled: false,
  sponsored_content_enabled: false,
  donation_enabled: false,
  newsletter_paid_enabled: false,
  
  // Pricing
  monthly_subscription_price: null,           // $9.99 if set
  one_time_purchase_price: null,              // $2.99 if set
  pay_per_view_price: null,                   // $0.99 if set
  
  // Content preview
  free_preview_duration_minutes: 1,           // Minutes visible before paywall
  free_posts_per_day: null,                   // null = unlimited
  
  // Payouts
  minimum_payout_threshold: 10.0,
  payout_frequency: "monthly",
  default_tip_amounts: [1.0, 5.0, 10.0, 25.0],
  
  // Advanced
  paywall_content_drm_enabled: false,
  download_allowed: false,
  share_allowed: true,
  
  created_at: timestamp,
  updated_at: timestamp
}

// Post paywall status (optional paywall per post)
{
  post_id: "456",
  user_id: "123",
  is_exclusive: false,                        // Paywalled?
  access_price: 2.99,                         // Price if paywalled
  access_type: "pay-per-view",                // pay-per-view, subscription, free
  free_preview_duration: 1,                   // Minutes of video visible free
  created_at: timestamp
}

// Monetization stats (earnings tracking)
{
  user_id: "123",
  total_earnings: 1250.50,
  total_payouts: 1000.00,
  pending_payout: 250.50,
  
  earnings_breakdown: {
    tips: 500.00,
    super_chats: 250.00,
    subscriptions: 300.00,
    product_sales: 150.00,
    pay_per_view: 50.00,
    affiliate_commissions: 0.00
  },
  
  metrics: {
    total_tips_received: 125,
    total_super_chats: 50,
    total_paid_subscriptions: 3,
    conversion_rate: 0.05,
    average_tip_amount: 4.00
  },
  
  payouts: [
    { date: timestamp, amount: 500.00, status: "completed" },
    { date: timestamp, amount: 500.00, status: "completed" }
  ],
  
  last_payout_date: timestamp,
  next_payout_date: timestamp
}
```

---

## API Endpoints

### Paywall Management

```bash
# Get user's paywall settings
GET /api/monetization/settings
Response: PaywallSettings

# Update paywall settings
PUT /api/monetization/settings
Body: { paywalls_enabled: true, paywall_type: "freemium", ... }

# Enable paywalls
POST /api/monetization/enable
Response: { success: true }

# Disable paywalls (all content free)
POST /api/monetization/disable
Response: { success: true }

# Get available paywall types
GET /api/monetization/paywall-type-options
Response: [
  { id: "free", name: "Free Creator", features: [...] },
  { id: "freemium", name: "Freemium", features: [...] },
  ...
]
```

### Content Paywalling

```bash
# Mark specific post as exclusive/paywalled
POST /api/monetization/exclusive-content/{post_id}
Body: { price: 2.99 }

# Remove paywall from post
DELETE /api/monetization/exclusive-content/{post_id}

# Get public monetization info about creator
GET /api/monetization/user-monetization/{user_id}
Response: Public paywall info (what viewers see)
```

### Earnings & Payouts

```bash
# Get monetization statistics
GET /api/monetization/monetization-stats
Response: MonetizationStats with earnings breakdown

# Get earnings breakdown by source
GET /api/monetization/earnings-breakdown
Response: { tips: 500, super_chats: 250, subscriptions: 300, ... }

# Request payout
POST /api/monetization/request-payout
Body: { amount: 250.00 } (optional, defaults to available)

# Get payout history
GET /api/monetization/payout-history?limit=20
Response: List of past payouts with dates/amounts

# Get monetization insights
GET /api/monetization/monetization-insights
Response: Recommendations and analytics
```

### Setup & Onboarding

```bash
# Start monetization setup
POST /api/monetization/onboarding/setup-monetization
Body: { paywall_type: "freemium" }

# Check onboarding progress
GET /api/monetization/onboarding/status
Response: { progress: 75%, next_steps: [...] }
```

---

## Frontend Implementation

### Settings Screen

```typescript
// Profile Settings → Monetization

<SettingsSection title="Monetization">
  <Toggle
    label="Enable Paywalls"
    value={paywallsEnabled}
    onChange={togglePaywalls}
    description="Allow monetization of your content"
  />
  
  {paywallsEnabled && (
    <>
      <Picker
        label="Paywall Type"
        options={[
          { id: "freemium", name: "Freemium (Mix of free & paid)" },
          { id: "paid", name: "Paid (Premium access)" },
          { id: "subscription", name: "Subscription (Monthly/yearly)" }
        ]}
        value={paywallType}
        onChange={setPaywallType}
      />
      
      <Input
        label="Monthly Subscription Price"
        type="number"
        value={monthlyPrice}
        placeholder="9.99"
      />
      
      <Input
        label="One-time Purchase Price"
        type="number"
        value={oneTimePrice}
        placeholder="2.99"
      />
      
      <Toggle
        label="Tips Enabled"
        value={tipsEnabled}
        onChange={setTipsEnabled}
      />
      
      <Button onPress={saveSettings}>Save Settings</Button>
    </>
  )}
</SettingsSection>
```

### Earnings Dashboard

```typescript
<EarningsDashboard>
  <Card>
    <Title>Total Earnings</Title>
    <Amount>${totalEarnings}</Amount>
  </Card>
  
  <Card>
    <Title>Available Payout</Title>
    <Amount>${pendingPayout}</Amount>
    <Button onPress={requestPayout}>Request Payout</Button>
  </Card>
  
  <EarningsBreakdown>
    <Stat label="Tips" amount={tipsEarnings} />
    <Stat label="Super Chats" amount={superChatEarnings} />
    <Stat label="Subscriptions" amount={subscriptionEarnings} />
  </EarningsBreakdown>
  
  <PayoutHistory limit={10} />
</EarningsDashboard>
```

### Post Paywalling

```typescript
// When creating/editing post

<PostCreation>
  <Editor content={content} />
  
  {paywallsEnabled && (
    <PaywallSection>
      <Toggle
        label="Make this content exclusive"
        value={isExclusive}
        onChange={setIsExclusive}
      />
      
      {isExclusive && (
        <>
          <Input
            label="Price"
            type="number"
            value={price}
            placeholder="2.99"
          />
          
          <Select
            label="Free Preview Duration"
            options={[
              { id: 1, label: "1 minute" },
              { id: 5, label: "5 minutes" },
              { id: 10, label: "10 minutes" }
            ]}
            value={previewDuration}
          />
        </>
      )}
    </PaywallSection>
  )}
  
  <Button onPress={publishPost}>Publish</Button>
</PostCreation>
```

---

## Migration Path

### For Existing Users

**Current State**: All content free (no paywalls)

**Migration Flow**:
1. User sees monetization prompt (optional)
2. User selects paywall type or skips
3. If enabled, access monetization settings
4. Can toggle individual posts on/off
5. Can change paywall type anytime

### For New Users

**Onboarding Flow**:
1. "How do you want to earn?" question
2. User selects:
   - Free Creator (tips only)
   - Freemium (mixed)
   - Paid (premium)
   - Subscription (monthly)
3. Setup pricing/settings
4. Confirm payment method
5. Start monetizing

---

## Revenue Sharing

### Grover Commission Structure

```
Tips: 5% to Grover, 95% to creator
Super Chat: 10% to Grover, 90% to creator
Subscriptions: 15% to Grover, 85% to creator
Product Sales: 5% to Grover, 95% to creator
Paid Content: 10% to Grover, 90% to creator
```

*Example*: Creator earns $100/month
- Grover takes: $10-15 (depending on revenue source)
- Creator receives: $85-90

### Payout Thresholds

- **Minimum**: $10 available to request payout
- **Maximum**: No limit
- **Frequency**: Weekly, bi-weekly, monthly (user choice)
- **Methods**: PayPal, Bank transfer, Stripe (future)

---

## Security & Anti-Abuse

### To Prevent Abuse:

1. **Age Verification**: Paid content requires age 18+
2. **Content Review**: Paywalled content flagged for review
3. **Refund Policy**: 48-hour refund window for paid content
4. **Dispute Resolution**: Payment disputes handled within 30 days
5. **Rate Limiting**: Max 10 paywall price changes per day
6. **Fraud Detection**: Monitor for suspicious payment patterns

### Creator Requirements:

1. **Account Age**: 30+ days before enabling paywalls
2. **Community Standards**: No violations
3. **Bank Account**: Valid payment method on file
4. **Tax Info**: Tax ID/SSN for US creators (IRS requirement)

---

## Metrics & Analytics

### Key Metrics Tracked

```
- Conversion rate: % of viewers who pay
- ARPU: Average Revenue Per User
- LTV: Lifetime Value (total earnings)
- Churn rate: % of subscribers who cancel
- Refund rate: % of paid content refunded
- Engagement: Likes/comments on paywalled vs free
```

### Analytics Dashboard

Shows creators:
- Revenue by source
- Conversion trends
- Top performing paywalled content
- Subscriber growth
- Refund rate
- Recommendations

---

## Migration: Removing Paywalls (If Needed)

If a user wants to **completely remove all paywalls**:

```bash
POST /api/monetization/legacy/remove-all-paywalls
Body: { confirmation: "CONFIRM_REMOVE_ALL_PAYWALLS" }
```

This will:
- ✅ Disable paywalls globally
- ✅ Make all paid content free
- ✅ Clear paywall settings
- ❌ NOT refund purchases (new/existing)
- ℹ️ Can be re-enabled anytime

**Note**: This respects user choice while maintaining platform stability.

---

## Example Scenarios

### Scenario 1: New Creator (Wants Free Community)
```
Status: Paywalls disabled (default)
Content: All free
Revenue: Tips, donations, sponsorships
Button: "Enable paywalls" available in settings
```

### Scenario 2: Growing Creator (Mixed Content)
```
Status: Paywalls enabled → Freemium model
- Posts: 80% free, 20% exclusive
- Videos: 5 min free preview, then paywall ($2.99)
- Subscriptions: $9.99/month for all exclusive
Revenue: Mix of tips + paid content
```

### Scenario 3: Premium Content Creator
```
Status: Paywalls enabled → Paid model
- All premium content gated
- One-time purchase: $4.99 per video
- Subscription: $19.99/month for unlimited
Revenue: Mostly from paid content
```

---

## Implementation Checklist

### Backend
- [x] PaywallSettings Pydantic model
- [x] MonetizationStats model
- [x] API endpoints (in monetization.py router)
- [ ] Database operations (implement in services)
- [ ] Payment processing integration
- [ ] Payout scheduling (weekly/monthly)
- [ ] Earnings calculations
- [ ] Fraud detection rules

### Frontend
- [ ] Monetization settings screen
- [ ] Paywall type selector
- [ ] Earnings dashboard
- [ ] Payout request UI
- [ ] Post-level paywall toggle
- [ ] Onboarding flow
- [ ] Payment processing UI

### Testing
- [ ] Unit tests for paywall logic
- [ ] Integration tests with payments
- [ ] E2E test of full payout flow
- [ ] Test all paywall types
- [ ] Fraud detection tests

### Deployment
- [ ] Database migration
- [ ] API deployment
- [ ] Frontend rollout
- [ ] Feature flag (gradual rollout)
- [ ] Monitoring & alerts
- [ ] User communication

---

## FAQ

**Q: Can I switch between paywall types?**  
A: Yes, anytime. Switching won't affect existing subscribers.

**Q: What happens to paid content if I disable paywalls?**  
A: It becomes free immediately. Customers can still access purchases for 30 days.

**Q: Can viewers refund purchases?**  
A: Yes, within 48 hours for digital content, 14 days for products.

**Q: Is there a fee to use the paywall feature?**  
A: No, the feature is free. Grover takes a commission on paid purchases (10-15% depending on type).

**Q: How do I get paid?**  
A: Once you reach $10 pending balance, you can request a payout to PayPal/bank.

---

## Contact & Support

For implementation questions, refer to:
- `PAYPAL_SETUP.md` - Payment processing
- `IMPLEMENTATION_CHECKLIST.md` - Feature tracking
- `FEATURES_ROADMAP.md` - Overall feature status
