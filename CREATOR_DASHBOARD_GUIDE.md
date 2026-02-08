# Creator Dashboard & Audience Insights Guide

## Overview

The Creator Dashboard provides comprehensive analytics and insights for content creators on the Grover platform. This guide covers all analytics features, audience insights, and performance tracking capabilities.

---

## Table of Contents

1. [Features Overview](#features-overview)
2. [Backend API Reference](#backend-api-reference)
3. [Frontend Screens](#frontend-screens)
4. [Analytics Metrics](#analytics-metrics)
5. [Data Visualization](#data-visualization)
6. [Usage Examples](#usage-examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Features Overview

### 1. Post Performance Analytics
- Top performing posts ranked by engagement
- Engagement score calculation (likes + comments + shares)
- Individual post deep-dive analytics
- 24-hour engagement timeline per post
- Reaction breakdown by type

### 2. Follower Growth Trends
- 7-day and 30-day growth tracking
- Daily new follower counts
- Growth rate calculation
- Historical trend visualization
- Follower retention metrics

### 3. Engagement Metrics
- Total reactions across all posts
- Comments count
- Shares and saves tracking
- Engagement rate percentage
- Breakdown by interaction type

### 4. Revenue Tracking
- Revenue by source (tips, subscriptions, marketplace)
- 30-day revenue timeline
- Average revenue per follower
- Pending vs. completed revenue
- Total orders count

### 5. Audience Insights
- **Demographics**
  - Age distribution (Under 18, 18-24, 25-34, 35-44, 45+)
  - Gender distribution
  - Top locations (countries and cities)
  
- **Activity Patterns**
  - Peak hours of engagement (24-hour analysis)
  - Peak days of the week
  - Best time to post recommendations
  
- **Content Performance**
  - Performance by type (text, image, video, mixed)
  - Average engagement per type
  - Best performing content recommendations

---

## Backend API Reference

### Analytics Endpoints

#### 1. Overview Analytics
```http
GET /api/analytics/overview
Authorization: Bearer {token}
```

**Response:**
```json
{
  "total_posts": 125,
  "total_reactions": 5600,
  "total_followers": 1000,
  "total_revenue": 1250.50,
  "follower_growth": [
    {"date": "2024-02-01T00:00:00Z", "new_followers": 15},
    {"date": "2024-02-02T00:00:00Z", "new_followers": 22}
  ],
  "follower_change": 5.2
}
```

#### 2. Audience Demographics
```http
GET /api/analytics/audience/demographics
Authorization: Bearer {token}
```

**Response:**
```json
{
  "age_distribution": {
    "18-24": 120,
    "25-34": 85,
    "35-44": 40,
    "45+": 15
  },
  "gender_distribution": {
    "male": 100,
    "female": 140,
    "other": 15,
    "not_specified": 5
  },
  "top_countries": [
    {"country": "United States", "count": 150},
    {"country": "United Kingdom", "count": 50}
  ],
  "top_cities": [
    {"city": "New York", "count": 50},
    {"city": "London", "count": 30}
  ],
  "follower_count": 260,
  "subscriber_count": 25,
  "total_reach": 285
}
```

#### 3. Activity Times
```http
GET /api/analytics/audience/activity-times
Authorization: Bearer {token}
```

**Response:**
```json
{
  "hourly_engagement": [
    {"hour": 0, "engagement": 45},
    {"hour": 18, "engagement": 450}
  ],
  "daily_engagement": [
    {"day": "Monday", "engagement": 1200},
    {"day": "Tuesday", "engagement": 950}
  ],
  "peak_hours": [18, 19, 20],
  "peak_days": ["Monday", "Wednesday", "Friday"],
  "best_time_to_post": "Monday, Wednesday, Friday between 18-21:00 UTC"
}
```

#### 4. Content Type Performance
```http
GET /api/analytics/content-types
Authorization: Bearer {token}
```

**Response:**
```json
{
  "content_types": [
    {
      "type": "video",
      "total_posts": 45,
      "total_engagement": 3500,
      "avg_engagement": 77.78,
      "engagement_score": 77.78
    },
    {
      "type": "image",
      "total_posts": 60,
      "total_engagement": 2400,
      "avg_engagement": 40.00,
      "engagement_score": 40.00
    }
  ],
  "best_performing_type": "video",
  "recommendation": "Post more video content for 2.3x better engagement"
}
```

#### 5. Post Analytics
```http
GET /api/analytics/posts/{post_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "post_id": "post_123",
  "total_likes": 150,
  "total_comments": 25,
  "total_shares": 10,
  "total_saves": 8,
  "total_engagement": 193,
  "reaction_breakdown": {
    "like": 120,
    "love": 30
  },
  "engagement_timeline": [
    {"hour": 0, "engagement": 45},
    {"hour": 1, "engagement": 30}
  ],
  "reach": 1000,
  "engagement_rate": 19.3,
  "created_at": "2024-02-01T12:00:00Z"
}
```

#### 6. Revenue Analytics
```http
GET /api/analytics/revenue
Authorization: Bearer {token}
```

**Response:**
```json
{
  "total_revenue": 1250.50,
  "tips": 450.00,
  "subscriptions": 637.50,
  "marketplace": 163.00,
  "total_orders": 12,
  "revenue_timeline": [
    {
      "date": "2024-02-01T00:00:00Z",
      "tips": 15.50,
      "orders": 25.00,
      "total": 40.50
    }
  ],
  "avg_revenue_per_follower": 1.25,
  "pending_revenue": 0,
  "completed_revenue": 1250.50
}
```

#### 7. Export Analytics
```http
GET /api/analytics/export
Authorization: Bearer {token}
```

**Response:**
```json
{
  "csv": "Grover Creator Analytics Export\nGenerated: 2024-02-05T14:55:00Z\n...",
  "filename": "analytics_username_20240205.csv"
}
```

**CSV Format:**
```csv
Grover Creator Analytics Export
Generated: 2024-02-05T14:55:00Z
Creator: @username

OVERVIEW
Total Posts,125
Total Followers,1000
Total Reactions,5600
Total Revenue,$1250.50

DEMOGRAPHICS
Age Range,Count
18-24,120
25-34,85
```

---

## Frontend Screens

### 1. Analytics Dashboard (`/analytics`)

**Features:**
- Revenue card with tips/sales breakdown
- Overview stats grid (posts, followers, reactions, engagement)
- Follower growth chart (7-day bar chart)
- Engagement breakdown (likes, comments, shares, saves)
- Top performing posts (top 5)
- Insights & tips cards
- Export to CSV button
- Link to Audience Insights

**Components:**
- `StatCard` - Individual stat with icon and optional change %
- `RevenueCard` - Gradient card with revenue breakdown
- `FollowerGrowthChart` - Bar chart for daily growth
- `TopPostCard` - Post card with engagement metrics
- `TimePeriodSelector` - 7D/30D/90D/ALL selector

### 2. Audience Insights (`/audience-insights`)

**Features:**
- Overview cards (followers, subscribers)
- Best time to post card with peak hours/days
- Age distribution chart
- Gender distribution chart
- Activity heatmap (hourly & daily)
- Top countries list
- Top cities list
- Content type performance

**Components:**
- `DemographicsChart` - Chart with legend and bar visualization
- `ActivityHeatmap` - Day/hour activity grid
- `BestTimeCard` - Gradient card with recommendations
- `LocationList` - Ranked location display

---

## Analytics Metrics

### Engagement Score Calculation
```
Engagement Score = Total Likes + Total Comments + Total Shares + Total Saves
```

### Engagement Rate Calculation
```
Engagement Rate = (Total Engagement / Reach) × 100
```
Where Reach = Follower count at time of posting

### Revenue Calculations
```
Total Revenue = Tips + Subscriptions + Marketplace Sales

Subscription Revenue = Active Subscriptions × Tier Price × 0.85 (85% payout)

Average Revenue Per Follower = Total Revenue / Follower Count
```

### Growth Rate Calculation
```
Follower Growth Rate = ((New Followers - Lost Followers) / Previous Follower Count) × 100
```

---

## Data Visualization

### Color Palette

**Age Distribution:**
- Under 18: Purple (#8B5CF6)
- 18-24: Pink (#EC4899)
- 25-34: Orange (#F59E0B)
- 35-44: Green (#10B981)
- 45+: Blue (#0EA5E9)

**Gender Distribution:**
- Male: Blue (#3B82F6)
- Female: Pink (#EC4899)
- Other: Purple (#A855F7)
- Not Specified: Gray (#94A3B8)

**Status Colors:**
- Success: Green (#10B981)
- Warning: Orange (#F59E0B)
- Danger: Red (#EF4444)
- Info: Blue (#0EA5E9)
- Primary: Purple (#8B5CF6)
- Secondary: Pink (#EC4899)

### Chart Types

**Bar Charts:**
- Follower growth (daily)
- Activity by day of week
- Content type performance

**Heatmaps:**
- Hourly engagement intensity
- Day-by-day activity patterns

**Progress Bars:**
- Age/gender distribution visualization
- Revenue source breakdown

---

## Usage Examples

### 1. Check Overall Performance
```typescript
import { api } from '../services/api';

const overview = await api.getAnalyticsOverview();
console.log(`Total Posts: ${overview.total_posts}`);
console.log(`Engagement Rate: ${overview.engagement_rate}%`);
```

### 2. Find Best Time to Post
```typescript
const activityTimes = await api.getActivityTimes();
console.log(`Best time: ${activityTimes.best_time_to_post}`);
console.log(`Peak hours: ${activityTimes.peak_hours.join(', ')}`);
```

### 3. Analyze Content Performance
```typescript
const contentTypes = await api.getContentTypePerformance();
const best = contentTypes.content_types[0];
console.log(`Best type: ${best.type} with ${best.avg_engagement} avg engagement`);
console.log(`Recommendation: ${contentTypes.recommendation}`);
```

### 4. Track Revenue
```typescript
const revenue = await api.getRevenueAnalytics();
console.log(`Total Revenue: $${revenue.total_revenue}`);
console.log(`Tips: $${revenue.tips}`);
console.log(`Subscriptions: $${revenue.subscriptions}`);
console.log(`Avg per follower: $${revenue.avg_revenue_per_follower}`);
```

### 5. Export All Data
```typescript
const exportData = await api.exportAnalytics();
// In production, save to file:
// await FileSystem.writeAsStringAsync(fileUri, exportData.csv);
// await Sharing.shareAsync(fileUri);
```

---

## Best Practices

### For Creators

1. **Check Analytics Daily**
   - Monitor follower growth trends
   - Track engagement rates
   - Identify top-performing content

2. **Post at Peak Times**
   - Use "Best Time to Post" recommendations
   - Test different posting times
   - Analyze results in Activity Heatmap

3. **Focus on What Works**
   - Double down on best-performing content types
   - Study top posts for patterns
   - Replicate successful strategies

4. **Understand Your Audience**
   - Review demographics regularly
   - Tailor content to audience preferences
   - Engage with largest follower segments

5. **Track Revenue Growth**
   - Monitor revenue by source
   - Optimize subscription offerings
   - Promote high-revenue content types

### For Developers

1. **Optimize Queries**
   - Use aggregation pipelines for complex analytics
   - Implement caching for expensive calculations
   - Add database indexes for frequently queried fields

2. **Handle Large Datasets**
   - Limit result sets (max 10,000 documents)
   - Use pagination for large lists
   - Implement data sampling for visualization

3. **Ensure Data Privacy**
   - Aggregate demographic data (no individual records)
   - Anonymize location data
   - Exclude PII from exports

4. **Performance Monitoring**
   - Track API response times
   - Monitor database query performance
   - Use Prometheus metrics

---

## Troubleshooting

### Common Issues

**1. No Data Showing**
- **Cause:** New account with no posts/followers
- **Solution:** Create content and gain followers first
- **Expected:** Empty state with helpful message

**2. Demographics Empty**
- **Cause:** Followers haven't filled profile information
- **Solution:** Encourage followers to complete profiles
- **Workaround:** Show "Data not available" message

**3. Activity Times Inaccurate**
- **Cause:** Limited engagement data
- **Solution:** Wait for more data accumulation
- **Minimum:** Need at least 100 interactions for accuracy

**4. Export Not Working**
- **Cause:** API timeout or large dataset
- **Solution:** Implement pagination or data sampling
- **Workaround:** Export smaller date ranges

**5. Slow Loading**
- **Cause:** Complex aggregation queries
- **Solution:** Implement caching layer
- **Optimization:** Pre-calculate daily aggregates

### Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 401 | Unauthorized | Check authentication token |
| 403 | Forbidden | Verify user owns the content |
| 404 | Post not found | Check post_id validity |
| 500 | Server error | Check server logs, retry |
| 429 | Rate limit | Wait before retrying |

### Performance Tips

1. **Cache Frequently Accessed Data**
   - Demographics: 24h TTL
   - Activity patterns: 12h TTL
   - Content type stats: 6h TTL

2. **Optimize Database Queries**
   ```python
   # Good: Use projection
   db.posts.find({}, {"post_id": 1, "likes_count": 1})
   
   # Bad: Fetch everything
   db.posts.find({})
   ```

3. **Batch API Calls**
   ```typescript
   // Good: Parallel requests
   const [overview, revenue, engagement] = await Promise.all([
     api.getAnalyticsOverview(),
     api.getRevenueAnalytics(),
     api.getEngagementAnalytics()
   ]);
   ```

4. **Implement Progressive Loading**
   - Load overview first
   - Load detailed stats on scroll
   - Lazy load charts

---

## Database Indexes

### Required Indexes

```javascript
// Posts
db.posts.createIndex({ user_id: 1, created_at: -1 })
db.posts.createIndex({ likes_count: -1 })

// Follows
db.follows.createIndex({ following_id: 1, created_at: -1 })
db.follows.createIndex({ follower_id: 1 })

// Reactions
db.reactions.createIndex({ post_id: 1, created_at: -1 })
db.reactions.createIndex({ user_id: 1 })

// Users
db.users.createIndex({ birthdate: 1 })
db.users.createIndex({ country: 1 })
db.users.createIndex({ city: 1 })

// Transactions
db.tips.createIndex({ to_user_id: 1, status: 1, created_at: -1 })
db.orders.createIndex({ seller_id: 1, status: 1, created_at: -1 })

// Subscriptions
db.creator_subscriptions.createIndex({ creator_id: 1, status: 1 })
```

---

## Security Considerations

### Access Control
- All endpoints require authentication
- Users can only access their own analytics
- Post analytics restricted to post owner
- No access to individual follower data

### Data Privacy
- Demographics are aggregated (no individual records)
- Age shown in ranges, not specific ages
- Locations aggregated at country/city level
- No PII included in exports
- Gender data anonymized

### Rate Limiting
- Analytics endpoints: 60 requests per minute
- Export endpoint: 10 requests per hour
- Implement exponential backoff on errors

---

## Future Enhancements

### Planned Features
- [ ] Real-time analytics updates
- [ ] Comparative analytics (vs. similar creators)
- [ ] Goal setting and tracking
- [ ] Custom date range selection
- [ ] A/B testing for content
- [ ] Predictive analytics (AI-powered)
- [ ] Advanced segmentation
- [ ] Cohort analysis
- [ ] Funnel visualization
- [ ] Custom dashboard layouts

### API Extensions
- [ ] Webhook notifications for milestones
- [ ] GraphQL API for flexible queries
- [ ] Bulk data export API
- [ ] Real-time WebSocket updates
- [ ] Third-party integrations (Google Analytics, etc.)

---

## Support

For questions or issues:
- **Email:** support@groverapp.com
- **Documentation:** https://docs.groverapp.com
- **Status Page:** https://status.groverapp.com

---

## Changelog

### Version 3.0 (Current)
- ✅ Added audience demographics
- ✅ Added activity time analysis
- ✅ Added content type performance
- ✅ Added post-level analytics
- ✅ Enhanced revenue tracking
- ✅ Added CSV export
- ✅ Created Audience Insights screen
- ✅ Enhanced Analytics Dashboard

### Version 2.0
- Basic analytics overview
- Follower growth tracking
- Top posts display
- Revenue summary

### Version 1.0
- Initial analytics release
- Basic metrics only

---

**Last Updated:** February 5, 2024
**Version:** 3.0
**Author:** Grover Development Team
