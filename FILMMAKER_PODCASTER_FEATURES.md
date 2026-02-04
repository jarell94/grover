# Filmmaker and Podcaster Features Documentation

## Overview

Grover now includes complete support for filmmakers to upload and monetize their films, and podcasters to upload and monetize their podcast episodes. This documentation covers the complete implementation.

---

## Table of Contents

1. [Features Overview](#features-overview)
2. [Backend API](#backend-api)
3. [Frontend Screens](#frontend-screens)
4. [Database Schema](#database-schema)
5. [Monetization System](#monetization-system)
6. [Usage Guide](#usage-guide)
7. [Technical Details](#technical-details)

---

## Features Overview

### For Filmmakers

**Upload Capabilities:**
- Video file support (MP4, MOV, WebM)
- File size limit: 500MB
- Custom thumbnail upload (16:9 recommended)
- Comprehensive metadata:
  - Title, filmmaker name
  - Genre (Drama, Comedy, Documentary, Horror, Sci-Fi, Action, Romance, Thriller, Animation)
  - Description (up to 2000 characters)
  - Release year
  - Price ($0-$9999.99)
  - Download permissions

**Analytics Dashboard:**
- Total films count
- Total views across all films
- Total likes
- Total revenue earned
- Per-film statistics

**Discovery Features:**
- Browse by genre
- Sort by recent, popular, trending
- Search functionality
- Filmmaker profiles

### For Podcasters

**Upload Capabilities:**
- Audio file support (MP3, WAV, OGG)
- File size limit: 200MB
- Custom cover art (square recommended)
- Comprehensive metadata:
  - Episode title, host name
  - Category (Technology, Business, Comedy, News, Sports, Education, Health, Arts, Science)
  - Description (up to 2000 characters)
  - Episode and season numbers
  - Price ($0-$999.99)
  - Download permissions

**Series Management:**
- Create podcast series
- Group episodes under series
- Series cover art and description
- Track total episodes per series

**Analytics Dashboard:**
- Total episodes count
- Total series count
- Total plays across all episodes
- Total likes
- Total revenue earned
- Per-episode statistics

**Discovery Features:**
- Browse by category
- Popular series section
- Sort by recent, popular, trending
- Search functionality
- Host profiles

---

## Backend API

### Films API (8 Endpoints)

#### 1. Upload Film
```
POST /films
Content-Type: multipart/form-data

Body (FormData):
- title: string (required)
- filmmaker_name: string (required)
- video_file: file (required, max 500MB)
- thumbnail: file (optional, 16:9 recommended)
- description: string (optional, max 2000 chars)
- genre: string (optional)
- duration: int (optional, seconds)
- release_year: int (optional)
- price: float (required, 0-9999.99)
- is_downloadable: boolean (default: false)
- authorization: Bearer token (header)

Response:
{
  "message": "Film uploaded successfully",
  "film_id": "film_abc123",
  "film": { ... }
}
```

#### 2. Browse Films
```
GET /films?genre=Drama&sort_by=trending&limit=20

Query Parameters:
- genre: string (optional)
- filmmaker: string (optional, search by name)
- search: string (optional, full-text search)
- sort_by: string (recent/popular/trending)
- skip: int (pagination)
- limit: int (default: 20)

Response:
{
  "films": [...],
  "total": 150,
  "skip": 0,
  "limit": 20
}
```

#### 3. Get Film Details
```
GET /films/{film_id}
Authorization: Bearer token (optional)

Response:
{
  "film": {
    "film_id": "film_abc123",
    "title": "My Film",
    "filmmaker_name": "John Doe",
    "video_url": "https://...",
    "thumbnail_url": "https://...",
    "genre": "Drama",
    "price": 4.99,
    "views_count": 1234,
    "likes_count": 89,
    "revenue": 449.10,
    "is_owner": false,
    "has_purchased": false,
    "can_watch": false
  }
}
```

#### 4. Play Film
```
POST /films/{film_id}/play
Authorization: Bearer token (required)

Response:
{
  "message": "Film play recorded",
  "video_url": "https://..."
}

Error (403):
{
  "detail": "Purchase required to watch this film"
}
```

#### 5. Like/Unlike Film
```
POST /films/{film_id}/like
Authorization: Bearer token (required)

Response:
{
  "message": "Film liked",
  "liked": true
}
```

#### 6. Purchase Film
```
POST /films/{film_id}/purchase
Authorization: Bearer token (required)

Response:
{
  "message": "Film purchased successfully",
  "purchase_id": "fpur_xyz789"
}
```

#### 7. Filmmaker Dashboard
```
GET /my-films
Authorization: Bearer token (required)

Response:
{
  "films": [...],
  "stats": {
    "total_films": 12,
    "total_views": 45230,
    "total_likes": 3421,
    "total_revenue": 12245.99
  }
}
```

### Podcasts API (10 Endpoints)

#### 1. Upload Podcast Episode
```
POST /podcasts
Content-Type: multipart/form-data

Body (FormData):
- title: string (required)
- host_name: string (required)
- audio_file: file (required, max 200MB)
- cover_art: file (optional, square recommended)
- series_id: string (optional)
- description: string (optional, max 2000 chars)
- category: string (optional)
- duration: int (optional, seconds)
- episode_number: int (optional)
- season_number: int (optional)
- price: float (required, 0-999.99)
- is_downloadable: boolean (default: true)
- authorization: Bearer token (header)

Response:
{
  "message": "Podcast uploaded successfully",
  "podcast_id": "pod_def456",
  "podcast": { ... }
}
```

#### 2. Create Podcast Series
```
POST /podcast-series
Content-Type: multipart/form-data

Body (FormData):
- title: string (required)
- host_name: string (required)
- cover_art: file (required, square recommended)
- description: string (optional, max 1000 chars)
- category: string (optional)
- authorization: Bearer token (header)

Response:
{
  "message": "Podcast series created successfully",
  "series_id": "series_ghi789",
  "series": { ... }
}
```

#### 3. Browse Podcasts
```
GET /podcasts?category=Technology&sort_by=trending&limit=20

Query Parameters:
- category: string (optional)
- host: string (optional, search by name)
- series_id: string (optional, episodes in series)
- search: string (optional, full-text search)
- sort_by: string (recent/popular/trending)
- skip: int (pagination)
- limit: int (default: 20)

Response:
{
  "podcasts": [...],
  "total": 350,
  "skip": 0,
  "limit": 20
}
```

#### 4. Browse Podcast Series
```
GET /podcast-series?category=Business&limit=10

Query Parameters:
- category: string (optional)
- search: string (optional)
- skip: int (pagination)
- limit: int (default: 20)

Response:
{
  "series": [...],
  "total": 45,
  "skip": 0,
  "limit": 10
}
```

#### 5. Get Podcast Details
```
GET /podcasts/{podcast_id}
Authorization: Bearer token (optional)

Response:
{
  "podcast": {
    "podcast_id": "pod_def456",
    "title": "Episode 1",
    "host_name": "Jane Smith",
    "audio_url": "https://...",
    "cover_art_url": "https://...",
    "category": "Technology",
    "episode_number": 1,
    "season_number": 1,
    "price": 1.99,
    "plays_count": 5432,
    "likes_count": 234,
    "revenue": 108.54,
    "is_owner": false,
    "has_purchased": false,
    "can_listen": false
  }
}
```

#### 6. Get Series Details
```
GET /podcast-series/{series_id}

Response:
{
  "series": {
    "series_id": "series_ghi789",
    "title": "Tech Talk",
    "host_name": "Jane Smith",
    "description": "...",
    "episodes": [...],
    "episodes_list": [...]
  }
}
```

#### 7. Play Podcast
```
POST /podcasts/{podcast_id}/play
Authorization: Bearer token (required)

Response:
{
  "message": "Podcast play recorded",
  "audio_url": "https://..."
}
```

#### 8. Like/Unlike Podcast
```
POST /podcasts/{podcast_id}/like
Authorization: Bearer token (required)

Response:
{
  "message": "Podcast liked",
  "liked": true
}
```

#### 9. Purchase Podcast
```
POST /podcasts/{podcast_id}/purchase
Authorization: Bearer token (required)

Response:
{
  "message": "Podcast purchased successfully",
  "purchase_id": "ppur_jkl012"
}
```

#### 10. Podcaster Dashboard
```
GET /my-podcasts
Authorization: Bearer token (required)

Response:
{
  "podcasts": [...],
  "series": [...],
  "stats": {
    "total_episodes": 87,
    "total_series": 5,
    "total_plays": 123456,
    "total_likes": 8234,
    "total_revenue": 4567.89
  }
}
```

### Unified Media Library
```
GET /my-media-library
Authorization: Bearer token (required)

Response:
{
  "music": {
    "purchased_songs": [...],
    "liked_songs": [...]
  },
  "films": {
    "purchased_films": [...],
    "liked_films": [...]
  },
  "podcasts": {
    "purchased_podcasts": [...],
    "liked_podcasts": [...]
  }
}
```

---

## Frontend Screens

### 1. Upload Film Screen (`/upload-film`)

**Purpose:** Allow filmmakers to upload their films with complete metadata.

**Components:**
- Video file picker with size display
- Thumbnail uploader with preview
- Text inputs for title, filmmaker name
- Genre selection chips
- Description textarea
- Release year input
- Price input with validation
- Download permissions checkbox
- Upload button with loading state

**User Flow:**
1. Tap "Upload Film" button from Films tab
2. Select video file (shows size)
3. Optionally add thumbnail
4. Fill in metadata
5. Select genre
6. Set price (or $0 for free)
7. Tap "Upload Film"
8. See success message
9. Redirected back to Films tab

### 2. Upload Podcast Screen (`/upload-podcast`)

**Purpose:** Allow podcasters to upload episodes with complete metadata.

**Components:**
- Audio file picker with size display
- Cover art uploader with preview
- Text inputs for title, host name
- Episode and season number inputs
- Category selection chips
- Description textarea
- Price input with validation
- Download permissions checkbox
- Upload button with loading state

**User Flow:**
1. Tap "Upload Episode" button from Podcasts tab
2. Select audio file (shows size)
3. Optionally add cover art
4. Fill in metadata
5. Select category
6. Set price (or $0 for free)
7. Tap "Upload Episode"
8. See success message
9. Redirected back to Podcasts tab

### 3. Films Tab (`/(tabs)/films`)

**Purpose:** Browse, discover, and manage films.

**Three Sub-Tabs:**

#### Discover Tab
- Genre filter chips (scrollable)
- Trending films grid (2 columns)
- Film cards showing:
  - Thumbnail (16:9)
  - Title and filmmaker
  - Genre badge
  - View and like counts
  - Price tag (if paid)
- Pull to refresh
- Loading states
- Empty states

#### Library Tab
- Purchased films section
- Liked films section
- Grid layout (2 columns)
- Empty states for new users

#### My Uploads Tab
- Stats dashboard (3 cards):
  - Total films
  - Total views
  - Total revenue
- "Upload Film" button
- My films grid
- Performance metrics

### 4. Podcasts Tab (`/(tabs)/podcasts`)

**Purpose:** Browse, discover, and manage podcasts.

**Three Sub-Tabs:**

#### Discover Tab
- Category filter chips (scrollable)
- Popular series (horizontal scroll)
  - Series cards with episode count
- Trending episodes grid (2 columns)
- Episode cards showing:
  - Cover art (square)
  - Title and host
  - Episode/season numbers
  - Category badge
  - Play and like counts
  - Price tag (if paid)
- Pull to refresh
- Loading states
- Empty states

#### Library Tab
- Purchased episodes section
- Liked episodes section
- Grid layout (2 columns)
- Empty states for new users

#### My Uploads Tab
- Stats dashboard (3 cards):
  - Total episodes
  - Total plays
  - Total revenue
- "Upload Episode" button
- My series (horizontal scroll)
- My episodes grid
- Performance metrics

---

## Database Schema

### Films Collection
```javascript
{
  film_id: "film_abc123",
  filmmaker_id: "user_xyz789",
  filmmaker_name: "John Doe",
  title: "My Film",
  description: "A story about...",
  genre: "Drama",
  video_url: "https://cloudinary.com/...",
  thumbnail_url: "https://cloudinary.com/...",
  duration: 7200,  // seconds
  release_year: 2024,
  price: 4.99,
  is_downloadable: false,
  views_count: 1234,
  likes_count: 89,
  comments_count: 12,
  revenue: 449.10,
  created_at: ISODate("2024-01-15T10:30:00Z"),
  updated_at: ISODate("2024-01-15T10:30:00Z")
}

Indexes:
- filmmaker_id
- genre
- created_at (descending)
- views_count (descending)
- text: title, filmmaker_name, description
```

### Film Purchases Collection
```javascript
{
  purchase_id: "fpur_xyz789",
  film_id: "film_abc123",
  user_id: "user_def456",
  filmmaker_id: "user_xyz789",
  price: 4.99,
  purchased_at: ISODate("2024-01-20T14:22:00Z")
}

Indexes:
- film_id, user_id (compound)
- user_id
- filmmaker_id
```

### Film Likes Collection
```javascript
{
  film_id: "film_abc123",
  user_id: "user_def456",
  liked_at: ISODate("2024-01-20T15:10:00Z")
}

Indexes:
- film_id, user_id (compound unique)
- user_id
```

### Film Plays Collection
```javascript
{
  film_id: "film_abc123",
  user_id: "user_def456",
  played_at: ISODate("2024-01-20T15:00:00Z")
}

Indexes:
- film_id
- user_id
- played_at
```

### Podcasts Collection
```javascript
{
  podcast_id: "pod_def456",
  host_id: "user_ghi789",
  host_name: "Jane Smith",
  series_id: "series_jkl012",  // optional
  title: "Episode 1: Introduction",
  description: "In this episode...",
  category: "Technology",
  audio_url: "https://cloudinary.com/...",
  cover_art_url: "https://cloudinary.com/...",
  duration: 3600,  // seconds
  episode_number: 1,
  season_number: 1,
  price: 1.99,
  is_downloadable: true,
  plays_count: 5432,
  likes_count: 234,
  downloads_count: 120,
  revenue: 108.54,
  created_at: ISODate("2024-01-10T09:00:00Z"),
  updated_at: ISODate("2024-01-10T09:00:00Z")
}

Indexes:
- host_id
- category
- series_id
- created_at (descending)
- plays_count (descending)
- text: title, host_name, description
```

### Podcast Series Collection
```javascript
{
  series_id: "series_jkl012",
  host_id: "user_ghi789",
  host_name: "Jane Smith",
  title: "Tech Talk",
  description: "A podcast about technology",
  category: "Technology",
  cover_art_url: "https://cloudinary.com/...",
  episodes: ["pod_def456", "pod_abc123", ...],
  subscribers_count: 1234,
  total_plays: 45678,
  created_at: ISODate("2024-01-01T00:00:00Z"),
  updated_at: ISODate("2024-01-10T09:00:00Z")
}

Indexes:
- host_id
- category
- created_at (descending)
```

### Podcast Purchases Collection
```javascript
{
  purchase_id: "ppur_xyz789",
  podcast_id: "pod_def456",
  user_id: "user_abc123",
  host_id: "user_ghi789",
  price: 1.99,
  purchased_at: ISODate("2024-01-15T11:30:00Z")
}

Indexes:
- podcast_id, user_id (compound)
- user_id
- host_id
```

### Podcast Likes Collection
```javascript
{
  podcast_id: "pod_def456",
  user_id: "user_abc123",
  liked_at: ISODate("2024-01-15T11:35:00Z")
}

Indexes:
- podcast_id, user_id (compound unique)
- user_id
```

### Podcast Plays Collection
```javascript
{
  podcast_id: "pod_def456",
  user_id: "user_abc123",
  played_at: ISODate("2024-01-15T11:30:00Z")
}

Indexes:
- podcast_id
- user_id
- played_at
```

---

## Monetization System

### Pricing Tiers

**Films:**
- Free: $0.00
- Budget: $0.99 - $4.99
- Standard: $5.00 - $14.99
- Premium: $15.00 - $49.99
- High-end: $50.00+
- Maximum: $9,999.99

**Podcasts:**
- Free: $0.00
- Budget: $0.99 - $1.99
- Standard: $2.00 - $4.99
- Premium: $5.00 - $9.99
- High-end: $10.00+
- Maximum: $999.99

### Revenue Sharing

Current implementation tracks revenue per creator. For production deployment:
- Platform takes 15-30% commission
- Creator receives 70-85%
- Payment processing fees: 2.9% + $0.30

### Payment Integration

**Current Status:** Placeholder (simulated purchases)

**TODO for Production:**
1. Integrate PayPal Checkout
2. Integrate Stripe Payments
3. Add payout system for creators
4. Implement transaction history
5. Add refund capabilities
6. Tax handling (depending on jurisdiction)

### Revenue Tracking

**Per-Item Revenue:**
```javascript
film.revenue = total_purchases * film.price
podcast.revenue = total_purchases * podcast.price
```

**Creator Total Revenue:**
```javascript
creator.total_revenue = 
  sum(all_film_revenues) + 
  sum(all_podcast_revenues) +
  sum(all_song_revenues) +
  sum(all_album_revenues)
```

---

## Usage Guide

### For Filmmakers

#### 1. Upload Your First Film

1. Open the Grover app
2. Navigate to the "Films" tab (🎬 icon)
3. Tap "My Uploads" tab
4. Tap "Upload Film" button
5. Select your video file (MP4, MOV, or WebM)
6. Add a thumbnail image (optional but recommended)
7. Fill in:
   - Film title
   - Your name/production company
   - Select genre
   - Add description
   - Enter release year
   - Set price ($0 for free)
8. Tap "Upload Film"
9. Wait for upload to complete
10. View your film in "My Uploads"

#### 2. Track Performance

1. Go to Films → My Uploads
2. View dashboard stats:
   - Total films
   - Total views
   - Total revenue
3. Scroll down to see individual film performance
4. Tap on a film to see detailed stats

#### 3. Monetize Your Content

**Free Model:**
- Set price to $0.00
- Build audience
- Gain exposure

**Paid Model:**
- Set competitive pricing
- Add compelling description
- Use high-quality thumbnail
- Promote on social media

### For Podcasters

#### 1. Create a Podcast Series (Optional)

1. Navigate to "Podcasts" tab (🎙️ icon)
2. Tap "My Uploads"
3. Create a series for better organization
4. Upload a series cover art
5. Add series title and description

#### 2. Upload Your First Episode

1. Open the Podcasts tab
2. Tap "My Uploads"
3. Tap "Upload Episode"
4. Select your audio file (MP3, WAV, or OGG)
5. Add cover art (or use series art)
6. Fill in:
   - Episode title
   - Host name
   - Episode number
   - Season number (if applicable)
   - Select category
   - Add show notes/description
   - Set price ($0 for free)
7. Tap "Upload Episode"
8. View in "My Uploads"

#### 3. Grow Your Audience

1. Upload consistently (weekly/bi-weekly)
2. Use engaging titles
3. Write detailed show notes
4. Cross-promote on other platforms
5. Engage with listeners
6. Track analytics in dashboard

### For Users

#### 1. Discover Content

**Films:**
1. Open Films tab
2. Use genre filters
3. Browse trending films
4. Tap a film to view details
5. Watch trailer (if available)
6. Purchase or watch (if free)

**Podcasts:**
1. Open Podcasts tab
2. Browse by category
3. Explore popular series
4. Tap episode to view details
5. Listen to preview (if available)
6. Subscribe to series

#### 2. Build Your Library

1. Purchase content you love
2. Like your favorites
3. Access via "Library" tab
4. Watch/listen anytime
5. Download for offline (if enabled)

#### 3. Support Creators

1. Purchase premium content
2. Like and share
3. Leave reviews (future)
4. Follow creators
5. Subscribe to series

---

## Technical Details

### File Upload Process

**Flow:**
1. User selects file via DocumentPicker (video) or ImagePicker (images)
2. Frontend validates file type and size
3. FormData created with file and metadata
4. POST request to backend with multipart/form-data
5. Backend validates file again
6. File uploaded to Cloudinary/S3
7. URL stored in database
8. Success response returned
9. Frontend shows success message

**Security Measures:**
- File type validation (MIME types)
- File size limits enforced
- Content-Type verification
- Malicious file detection
- User authentication required
- Input sanitization

### Media Storage

**Cloudinary (Preferred):**
- Automatic video compression
- Thumbnail generation
- CDN distribution
- Bandwidth optimization
- Format conversion
- Responsive delivery

**AWS S3 (Alternative):**
- Scalable storage
- Cost-effective
- Direct uploads
- CloudFront integration

**Configuration:**
```bash
# .env file
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_secret

# Or use S3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your_bucket
AWS_S3_REGION=us-east-1
```

### Performance Optimization

**Backend:**
- MongoDB indexes for fast queries
- Efficient aggregation pipelines
- Connection pooling
- Caching layer (Redis - future)
- Async file processing

**Frontend:**
- Lazy loading
- Image optimization
- Pull-to-refresh pattern
- Efficient re-renders
- FlashList for large lists

### Error Handling

**Upload Errors:**
- File too large → Alert with size limit
- Invalid file type → Alert with accepted types
- Network error → Retry mechanism
- Server error → User-friendly message

**Playback Errors:**
- Unpurchased paid content → Purchase modal
- Network issues → Buffering indicator
- Invalid URL → Error message
- Unauthorized → Login prompt

---

## Future Enhancements

### Short-term (1-2 months)
- [ ] Video player integration (expo-video)
- [ ] Enhanced audio player
- [ ] Film/episode detail screens
- [ ] Comments and ratings
- [ ] Watchlist/queue management
- [ ] Continue watching/listening

### Medium-term (3-6 months)
- [ ] PayPal/Stripe integration
- [ ] Creator payout system
- [ ] Advanced analytics
- [ ] Recommendations engine
- [ ] Social sharing
- [ ] Trailer support
- [ ] Chapter markers
- [ ] Closed captions/subtitles

### Long-term (6-12 months)
- [ ] Live streaming
- [ ] Interactive features
- [ ] Community features
- [ ] Creator tools
- [ ] Mobile apps (iOS/Android)
- [ ] Smart TV apps
- [ ] API for third-party integrations
- [ ] White-label solution

---

## Support

For technical issues or questions:
- GitHub Issues: [repository]/issues
- Documentation: This file
- API Reference: [API documentation URL]

---

## License

[Your license here]

---

## Changelog

### Version 1.0.0 (2024-02-04)
- Initial release
- Filmmaker upload and discovery
- Podcaster upload and discovery
- Complete monetization system
- Analytics dashboards
- Library management

---

**Built with ❤️ for content creators**
