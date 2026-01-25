# PayPal Integration Guide for Grover

## Current Status
- ✅ PayPal SDK installed (`paypalrestsdk`)
- ✅ Backend endpoints for payment creation/execution exist
- ⚠️ Currently in **sandbox/simulation mode**
- ❌ Real PayPal credentials not configured

## Setup Instructions

### Step 1: Create PayPal Developer Account

1. Go to https://developer.paypal.com
2. Sign in or create an account
3. Click on **Sandbox** (default environment)
4. Navigate to **Apps & Credentials**

### Step 2: Get Your Credentials

#### Business Account (Receiver/Seller):
- Client ID
- Secret

#### Personal Account (Payer/Buyer - for testing):
- Email
- Password

### Step 3: Configure Environment

Update `/Users/jarell/grover/.env`:

```bash
# PayPal Configuration
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
PAYPAL_MODE=sandbox
PAYPAL_RETURN_URL=http://192.168.1.101:8001/api/payment-success
PAYPAL_CANCEL_URL=http://192.168.1.101:8001/api/payment-cancel
```

### Step 4: Backend Integration Points

The backend has these PayPal endpoints (in `/backend/server.py`):

```python
# Payment creation
POST /api/payments/create
Body: {
  "amount": 29.99,
  "currency": "USD",
  "item_name": "Premium Subscription",
  "item_quantity": 1,
  "return_url": "grover://payment-success",
  "cancel_url": "grover://payment-cancel"
}

# Payment execution (after user approves on PayPal)
POST /api/payments/execute
Body: {
  "payment_id": "PAY-...",
  "payer_id": "...",
  "user_id": "user_123"
}

# Get payment details
GET /api/payments/{payment_id}
```

### Step 5: Frontend Integration

The `frontend/services/api.ts` has:

```typescript
// Create payment
createPayment: (amount, itemName) => apiRequest('/payments/create', {
  method: 'POST',
  body: JSON.stringify({ amount, item_name: itemName }),
}),

// Execute payment
executePayment: (paymentId, payerId, userId) => apiRequest('/payments/execute', {
  method: 'POST',
  body: JSON.stringify({ payment_id: paymentId, payer_id: payerId, user_id: userId }),
}),
```

### Step 6: Testing the Flow

#### Test in Sandbox Mode:

```bash
1. Start backend:
   cd backend && python3 server.py

2. Test payment creation:
   curl -X POST http://localhost:8001/api/payments/create \
     -H "Content-Type: application/json" \
     -d '{
       "amount": 29.99,
       "currency": "USD",
       "item_name": "Premium Test",
       "item_quantity": 1
     }'

3. Response will include:
   {
     "status": "created",
     "payment_id": "PAY-...",
     "links": [
       {"rel": "approval_url", "href": "..."}
     ]
   }

4. Visit the approval_url to authorize payment (use sandbox buyer account)

5. After approval, execute payment with the returned payment_id and payer_id
```

## Features That Use PayPal

1. **Premium Subscription** (`/api/premium/upgrade`)
   - $9.99/month or $99.99/year
   - Unlocks all features

2. **Tips System** (`/api/users/{user_id}/tip`)
   - Tip creators directly
   - Custom amounts

3. **Product Purchases** (`/api/orders/create`)
   - Buy items from marketplace
   - Full transaction tracking

4. **Ads/Promotions** (future)
   - Boost posts
   - Paid advertising

## Monitoring & Testing

### PayPal Dashboard Checks:
- Sandbox transactions visible in developer dashboard
- Webhook events can be configured
- Test mode payments don't charge real money

### Backend Logging:
PayPal requests/responses logged in `server.py` with prefix `PAYPAL:`

```python
logger.info(f"PAYPAL: Creating payment for ${amount} - {item_name}")
```

## Security Considerations

1. ✅ Server-side validation of payment amounts
2. ✅ User verification before executing payments
3. ✅ Return/Cancel URL handling
4. ⚠️ TODO: Webhook validation for payment confirmations
5. ⚠️ TODO: PCI compliance review for production
6. ⚠️ TODO: Rate limiting on payment endpoints

## Transition to Production

When ready for production:

1. Switch from **Sandbox** to **Live** in PayPal Dashboard
2. Get live Client ID and Secret
3. Update `.env`:
   ```bash
   PAYPAL_MODE=live
   PAYPAL_CLIENT_ID=your_live_client_id
   PAYPAL_CLIENT_SECRET=your_live_client_secret
   PAYPAL_RETURN_URL=https://grover.app/api/payment-success
   PAYPAL_CANCEL_URL=https://grover.app/api/payment-cancel
   ```
4. Update SSL/HTTPS settings
5. Test with small amounts first
6. Set up webhook listeners for payment confirmations

## Troubleshooting

### Payment creation fails:
- Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env
- Verify PAYPAL_MODE is correct
- Check backend logs for API errors

### Payment execution fails:
- Verify payment_id exists and is still pending
- Check payer_id is correct
- Ensure user_id is valid

### IPN/Webhooks not working:
- Configure in PayPal Dashboard under IPN Settings
- Endpoint should be: `https://your-domain/api/webhooks/paypal`
- Verify SSL certificate

## Current Issues & Improvements Needed

1. **No payment confirmation emails** - Add transactional emails after successful payment
2. **No refund processing** - Add refund endpoint for cancellations
3. **No subscription management** - Add ability to upgrade/downgrade subscription tiers
4. **No payment history** - Add GET endpoint to retrieve user's payment history
5. **No fraud detection** - Consider implementing velocity checks

## Testing Sandbox Accounts

Use these credentials in PayPal sandbox:

**Seller Account (Business):**
- Email: sb-xxxxx@business.example.com (from your dashboard)
- Password: test password from dashboard

**Buyer Account (Personal):**
- Email: sb-xxxxx@personal.example.com (from your dashboard)
- Password: test password from dashboard

Create test cards in the dashboard for different scenarios.

---

**Next Steps:**
1. Create PayPal developer account
2. Copy sandbox credentials to `.env`
3. Run `python3 e2e_test.py` to test integration
4. Test payment flow end-to-end in app
5. Monitor transactions in PayPal dashboard
