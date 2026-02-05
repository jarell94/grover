# AI Content Assistant Setup

The AI Content Assistant feature requires either OpenAI or Anthropic API keys to function.

## Setup Instructions

### 1. Get an API Key

Choose one of the following providers:

**Option A: OpenAI (GPT)**
1. Create an account at [OpenAI Platform](https://platform.openai.com/)
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key (starts with `sk-...`)

**Option B: Anthropic (Claude)**
1. Create an account at [Anthropic Console](https://console.anthropic.com/)
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key (starts with `sk-ant-...`)

### 2. Configure Environment Variables

Add your API key to the backend `.env` file:

```bash
# For OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here

# OR for Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# You can configure both if desired - OpenAI will be used first as fallback
```

### 3. Install Dependencies

The required packages are already in `requirements.txt`. Install them:

```bash
cd backend
pip install -r requirements.txt
```

### 4. Restart the Server

Restart your backend server to load the new environment variables:

```bash
python backend/server.py
```

## Features

Once configured, the AI Content Assistant provides:

### 🤖 Caption Generation
- AI-powered caption writing with customizable tone (casual, professional, funny, inspirational)
- Context-aware suggestions based on your content

### 🏷️ Hashtag Suggestions
- Intelligent hashtag recommendations based on content analysis
- Up to 10 relevant hashtags per request

### ⏰ Best Posting Time
- Recommendations for optimal posting times
- Based on general social media best practices and your audience activity

### 💡 Content Ideas
- AI-generated content ideas based on trending topics
- Personalized suggestions based on your interests
- Multiple categories: Lifestyle, Educational, Entertainment, Engagement

## API Endpoints

The following endpoints are available:

- `POST /api/ai/generate-caption` - Generate AI-powered captions
- `POST /api/ai/suggest-hashtags` - Get hashtag suggestions
- `GET /api/ai/posting-time-recommendation` - Get best posting time
- `GET /api/ai/content-ideas` - Get content ideas

## Cost Considerations

Both OpenAI and Anthropic APIs have usage costs:

- **OpenAI GPT-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Anthropic Claude 3 Haiku**: ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens

For moderate usage (100-200 requests/day), expect costs under $5-10/month.

## Testing Without API Keys

If no API keys are configured:
- Caption generation returns the original input
- Hashtag suggestions return an empty array
- Content ideas return generic fallback suggestions
- Posting time recommendations work without AI (using heuristics)

## Troubleshooting

### "AI service not available" error
- Verify your API key is correctly set in `.env`
- Check that the server was restarted after adding the key
- Verify the API key is valid and has credits

### Rate Limiting
Both providers have rate limits. If you hit them:
- OpenAI: Default 3 RPM for free tier, higher for paid
- Anthropic: Default 5 RPM for free tier, higher for paid

Consider implementing caching or rate limiting in production.

## Security Best Practices

1. **Never commit API keys** to version control
2. Keep `.env` file in `.gitignore`
3. Use environment variables in production
4. Rotate API keys periodically
5. Monitor API usage to detect anomalies
6. Consider using API key restrictions (IP allowlists, etc.)

## Production Deployment

For production:

1. Set environment variables on your hosting platform:
   - Heroku: `heroku config:set OPENAI_API_KEY=sk-...`
   - Railway: Use the Variables tab in project settings
   - Render: Use Environment Variables section
   - AWS/GCP/Azure: Use their respective secret management services

2. Monitor usage and costs through provider dashboards

3. Consider implementing:
   - Request caching to reduce API calls
   - Rate limiting per user
   - Content moderation filters
   - Usage analytics

## Support

For issues or questions:
- OpenAI: https://help.openai.com/
- Anthropic: https://support.anthropic.com/
