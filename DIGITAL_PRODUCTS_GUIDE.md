# Digital Products Marketplace Guide

## Overview

The Digital Products Marketplace enables creators to upload, sell, and deliver digital files directly to their audience. This feature includes automatic delivery to subscribers, download limits, and DRM protection options.

---

## Features

### For Creators
- Upload digital files (PDFs, images, videos, archives)
- Set custom prices and download limits
- Enable DRM with watermarking
- Create subscriber-only products
- View sales analytics and revenue
- Track downloads per product
- Manage product listings

### For Buyers
- Browse and purchase digital products
- Instant download access after purchase
- Re-download within limits
- Track purchase history
- Access all purchased products

### For Subscribers
- Automatic access to subscriber-only products
- Unlimited downloads
- Bonus content from favorite creators
- No additional payment required

---

## Supported File Types

### Documents
- **PDF** - `application/pdf`

### Images
- **JPEG/JPG** - `image/jpeg`, `image/jpg`
- **PNG** - `image/png`
- **GIF** - `image/gif`
- **WebP** - `image/webp`

### Videos
- **MP4** - `video/mp4`
- **MOV** - `video/quicktime`
- **AVI** - `video/x-msvideo`
- **WebM** - `video/webm`

### Archives
- **ZIP** - `application/zip`
- **RAR** - `application/x-rar-compressed`

**Maximum File Size**: 100MB

---

## API Reference

### 1. Upload Digital Product

Upload a new digital product for sale.

**Endpoint**: `POST /api/digital-products`

**Authentication**: Required (creator must have monetization enabled)

**Content-Type**: `multipart/form-data`

**Request Parameters**:
```
title: string (required, max 200 chars)
description: string (required, max 2000 chars)
price: float (required, min $0.99, max $9999.99)
file: file (required, max 100MB)
download_limit: int (default 3, range 1-100)
drm_enabled: boolean (default false)
watermark_text: string (optional, max 200 chars)
subscriber_only: boolean (default false)
```

**Response**:
```json
{
  "message": "Digital product uploaded successfully",
  "product_id": "dp_abc123",
  "file_url": "https://cloudinary.com/...",
  "file_size": 52428800
}
```

**Example (curl)**:
```bash
curl -X POST https://api.grover.com/api/digital-products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Premium Photo Pack" \
  -F "description=10 high-resolution photos for commercial use" \
  -F "price=9.99" \
  -F "file=@photos.zip" \
  -F "download_limit=3" \
  -F "drm_enabled=true" \
  -F "watermark_text=Licensed to {buyer_name}"
```

---

### 2. Get Digital Products

Retrieve list of digital products.

**Endpoint**: `GET /api/digital-products`

**Authentication**: Optional (affects filtering)

**Query Parameters**:
```
creator_id: string (optional)
limit: int (default 20, max 100)
skip: int (default 0)
```

**Response**:
```json
[
  {
    "product_id": "dp_abc123",
    "creator_id": "user_xyz",
    "title": "Premium Photo Pack",
    "description": "10 high-resolution photos",
    "file_type": "application/zip",
    "file_size": 52428800,
    "preview_url": "https://...",
    "price": 9.99,
    "currency": "USD",
    "download_limit": 3,
    "drm_enabled": true,
    "subscriber_only": false,
    "active": true,
    "created_at": "2024-02-08T...",
    "creator": {
      "user_id": "user_xyz",
      "name": "John Creator",
      "picture": "https://...",
      "username": "johncreator"
    },
    "purchased": false,
    "can_download": false
  }
]
```

---

### 3. Purchase Digital Product

Purchase a digital product.

**Endpoint**: `POST /api/digital-products/{product_id}/purchase`

**Authentication**: Required

**Response**:
```json
{
  "message": "Purchase successful",
  "purchase_id": "pur_def456",
  "product_id": "dp_abc123",
  "can_download": true,
  "download_limit": 3
}
```

**Error Responses**:
- `403` - Subscriber-only product, subscription required
- `404` - Product not found
- `409` - Already purchased

---

### 4. Download Digital Product

Generate download link for purchased product.

**Endpoint**: `GET /api/digital-products/{product_id}/download`

**Authentication**: Required

**Response**:
```json
{
  "download_url": "https://cloudinary.com/...",
  "file_name": "photos.zip",
  "file_type": "application/zip",
  "file_size": 52428800,
  "downloads_remaining": 2,
  "drm_enabled": true,
  "watermark_text": "Licensed to John Doe"
}
```

**Error Responses**:
- `403` - Not purchased
- `403` - Download limit reached
- `403` - Access expired

---

### 5. Get My Digital Products

Retrieve products purchased by current user.

**Endpoint**: `GET /api/my-digital-products`

**Authentication**: Required

**Query Parameters**:
```
limit: int (default 50, max 100)
skip: int (default 0)
```

**Response**:
```json
[
  {
    "purchase_id": "pur_def456",
    "product": { /* product object */ },
    "creator": { /* creator object */ },
    "download_count": 1,
    "download_limit": 3,
    "can_download": true,
    "purchase_date": "2024-02-08T...",
    "is_subscriber_bonus": false
  }
]
```

---

### 6. Get Creator Analytics

View analytics for creator's digital products.

**Endpoint**: `GET /api/digital-products/creator/analytics`

**Authentication**: Required (monetization enabled)

**Response**:
```json
{
  "total_products": 5,
  "active_products": 4,
  "total_sales": 23,
  "total_revenue": 229.77,
  "platform_fee": 34.47,
  "creator_revenue": 195.30,
  "total_downloads": 45,
  "products": [
    {
      "product_id": "dp_abc123",
      "title": "Premium Photo Pack",
      "price": 9.99,
      "sales": 10,
      "revenue": 99.90,
      "downloads": 25,
      "subscriber_bonuses": 3
    }
  ]
}
```

---

### 7. Delete Digital Product

Delete (deactivate) a digital product.

**Endpoint**: `DELETE /api/digital-products/{product_id}`

**Authentication**: Required (must be creator)

**Response**:
```json
{
  "message": "Product deleted successfully"
}
```

---

## Database Schema

### Digital Products Collection

```javascript
{
  "product_id": "dp_abc123",           // Unique identifier
  "creator_id": "user_xyz",            // Creator's user ID
  "title": "Premium Photo Pack",       // Product title
  "description": "10 high-res photos", // Description
  "file_url": "https://...",           // Secure file URL
  "file_type": "application/zip",      // MIME type
  "file_size": 52428800,               // Size in bytes
  "file_name": "photos.zip",           // Original filename
  "file_public_id": "digital_products/hash", // Storage ID
  "preview_url": "https://...",        // Thumbnail (optional)
  "price": 9.99,                       // Price in USD
  "currency": "USD",                   // Currency code
  "download_limit": 3,                 // Max downloads
  "drm_enabled": true,                 // DRM protection
  "watermark_text": "Licensed to...", // Watermark template
  "subscriber_only": false,            // Subscriber-only flag
  "active": true,                      // Active status
  "created_at": ISODate("..."),        // Creation timestamp
  "updated_at": ISODate("...")         // Update timestamp
}
```

**Indexes**:
- `product_id` (unique)
- `creator_id + active`
- `subscriber_only + active`
- `created_at`

---

### Digital Purchases Collection

```javascript
{
  "purchase_id": "pur_def456",         // Unique identifier
  "product_id": "dp_abc123",           // Product ID
  "buyer_id": "user_789",              // Buyer's user ID
  "buyer_name": "John Doe",            // Buyer's name
  "buyer_email": "john@example.com",   // Buyer's email
  "download_count": 1,                 // Current download count
  "download_limit": 3,                 // Max downloads allowed
  "purchase_date": ISODate("..."),     // Purchase timestamp
  "last_download_date": ISODate("..."),// Last download timestamp
  "access_expires_at": null,           // Expiration (DRM, optional)
  "transaction_id": "txn_ghi789",      // Payment transaction ID
  "amount_paid": 9.99,                 // Amount paid
  "currency": "USD",                   // Currency code
  "is_subscriber_bonus": false,        // Subscriber freebie flag
  "revoked": false                     // Access revoked flag
}
```

**Indexes**:
- `purchase_id` (unique)
- `buyer_id + product_id`
- `product_id`
- `buyer_id + purchase_date`

---

## DRM Features

### 1. Watermarking

Add text watermark to digital products:

```python
# Enable DRM with watermark
drm_enabled = True
watermark_text = "Licensed to {buyer_name}"

# Variables available:
# {buyer_name} - Buyer's full name
# {buyer_email} - Buyer's email
# {purchase_id} - Unique purchase ID
# {purchase_date} - Purchase date
```

**Implementation**:
- **Images**: Text overlay added to image
- **PDFs**: Metadata and visible watermark on pages
- **Videos**: Buyer info in video metadata

### 2. Download Limits

Restrict number of downloads per purchase:

```python
download_limit = 3  # Default, configurable 1-100

# Tracking:
# - Downloads counted on each request
# - Limit enforced before generating link
# - Subscribers get 999 (unlimited)
```

### 3. Expiring Access

Set expiration date for access (optional):

```python
access_expires_at = datetime.now() + timedelta(days=365)

# Features:
# - Time-limited access to downloads
# - Can be used for rentals
# - Access checked before download
```

### 4. Access Revocation

Revoke access to specific purchases:

```python
# Set revoked flag
await db.digital_purchases.update_one(
    {"purchase_id": purchase_id},
    {"$set": {"revoked": True}}
)

# Effect:
# - All download attempts blocked
# - User cannot access product
# - Can be used for refunds or violations
```

---

## Revenue Model

### Pricing
- **Minimum Price**: $0.99
- **Maximum Price**: $9,999.99
- **Platform Fee**: 15%
- **Creator Payout**: 85%

### Example Calculation
```
Sale Price: $9.99
Platform Fee (15%): $1.50
Creator Payout (85%): $8.49
```

### Subscriber-Only Products
- **Price**: $0.00 (free for subscribers)
- **Downloads**: Unlimited (999 limit)
- **Access**: While subscribed
- **Benefit**: Encourages subscriptions

---

## User Flows

### Creator Upload Flow

1. **Enable Monetization**
   - Go to Profile Settings
   - Enable "Monetization"

2. **Upload Product**
   - Click "Upload Digital Product"
   - Select file (PDF/image/video/ZIP)
   - Fill in details:
     - Title (required)
     - Description (required)
     - Price (min $0.99)
   - Configure options:
     - Download limit (1-100)
     - DRM enabled (yes/no)
     - Watermark text (optional)
     - Subscriber-only (yes/no)

3. **Submit**
   - Click "Upload & Publish"
   - File uploads to secure storage
   - Product goes live
   - Subscribers get automatic access (if subscriber-only)

### Purchase & Download Flow

1. **Browse Products**
   - Navigate to Digital Products section
   - View creator's products
   - Click on product for details

2. **Purchase**
   - Click "Purchase" button
   - Payment processed ($9.99)
   - Purchase record created
   - Notification sent

3. **Download**
   - Click "Download" button
   - System verifies purchase
   - Checks download limit (2/3 used)
   - Generates secure download link
   - File downloads
   - Download count incremented

4. **Re-Download**
   - Return to "My Digital Products"
   - Click download again (within limit)
   - Remaining: 1/3 downloads

### Subscriber Access Flow

1. **Subscribe**
   - User subscribes to creator ($9.99/month)

2. **Automatic Access**
   - System finds all subscriber-only products
   - Creates purchase records (free)
   - User receives notification

3. **Download**
   - User navigates to "My Digital Products"
   - Sees subscriber bonus products
   - Downloads unlimited times

4. **Unsubscribe**
   - User cancels subscription
   - Access to subscriber-only products revoked
   - Can no longer download

---

## Best Practices

### For Creators

#### Pricing
- Research similar products
- Consider bundle pricing
- Offer subscriber-only versions
- Use introductory pricing

#### Product Quality
- High-resolution images
- Professional PDFs
- Clean video editing
- Organized ZIP files

#### Descriptions
- Clear, detailed descriptions
- List what's included
- Specify file formats
- Mention usage rights

#### DRM Usage
- Enable for premium content
- Use watermarks for images
- Set reasonable download limits
- Consider time-limited access for rentals

#### Marketing
- Promote on social media
- Create preview posts
- Offer limited-time discounts
- Engage with buyers

### For Buyers

#### Before Purchase
- Read full description
- Check file type and size
- Verify download limit
- Understand DRM restrictions

#### After Purchase
- Download immediately
- Save backup copies (within limits)
- Respect copyright and usage terms
- Contact creator for issues

---

## Troubleshooting

### Upload Fails

**Problem**: File upload fails or times out

**Solutions**:
- Check file size (max 100MB)
- Verify file type is supported
- Check internet connection
- Try compressing file
- Use ZIP for multiple files

### Can't Download

**Problem**: Download button disabled or error

**Solutions**:
- Verify you purchased the product
- Check download limit not exceeded
- Ensure access hasn't expired
- Contact creator for help
- Check support documentation

### Payment Issues

**Problem**: Payment fails or doesn't complete

**Solutions**:
- Verify payment method
- Check account balance
- Try different payment method
- Clear browser cache
- Contact support

### DRM Watermark Not Working

**Problem**: Watermark not appearing on downloads

**Solutions**:
- Ensure DRM is enabled for product
- Check watermark text is set
- Verify file type supports watermarks
- Re-upload product if needed
- Contact technical support

---

## Security Considerations

### File Storage
- Files stored in private folders
- Access controlled via signed URLs
- Time-limited download links
- Secure transmission (HTTPS)

### Access Control
- Purchase verification required
- Download limits enforced
- Authentication required
- Ownership validated

### Payment Security
- Payment processing via secure gateway
- Transaction tracking
- Refund capability
- Dispute resolution

### DRM Protection
- Watermarking prevents redistribution
- Download tracking for auditing
- Access revocation for violations
- Legal recourse for infringement

---

## Analytics & Reporting

### Creator Dashboard

View comprehensive analytics:
- Total products
- Active products
- Total sales
- Total revenue
- Platform fees
- Net earnings
- Total downloads
- Per-product metrics

### Product Performance

Track individual product success:
- Sales count
- Revenue generated
- Download statistics
- Subscriber bonuses given
- Conversion rate

### Download Analytics

Monitor download behavior:
- Average downloads per purchase
- Download limit usage
- Re-download patterns
- Access expiration impact

---

## Future Enhancements

### Planned Features
- Video DRM with playback restrictions
- Batch upload multiple files
- Product bundles and packages
- Promotional pricing and discounts
- Time-limited sales
- Gift purchases
- Product reviews and ratings
- Advanced analytics dashboard
- Affiliate program
- Referral bonuses
- Custom licensing terms
- Subscription bundles with products

### Under Consideration
- Streaming video instead of download
- Interactive content (ebooks)
- 3D model support
- Audio books with chapters
- Course materials integration
- Collaboration on products
- Product versioning
- Update notifications

---

## Support

### For Users
- **Email**: support@grover.com
- **Help Center**: https://help.grover.com
- **FAQ**: https://grover.com/faq

### For Creators
- **Creator Support**: creators@grover.com
- **Documentation**: https://docs.grover.com
- **Community**: https://community.grover.com

---

## Legal

### Terms of Service
- Creators retain copyright
- Platform has distribution rights
- Buyers have usage rights per license
- No redistribution allowed

### Refund Policy
- Case-by-case basis
- Contact creator first
- Platform may intervene
- Disputes handled fairly

### Copyright & DMCA
- Report infringement to copyright@grover.com
- DMCA takedown process available
- Repeat infringers banned
- Legal compliance maintained

---

## Conclusion

The Digital Products Marketplace empowers creators to monetize their digital content while providing buyers with instant access to high-quality files. With robust DRM options, automatic delivery, and comprehensive analytics, it's a complete solution for digital commerce.

**Ready to start selling your digital products?** Enable monetization and upload your first product today!
