"""
AI Content Assistant Service
Uses OpenAI/Claude for AI-powered content generation
"""
import os
from typing import List, Dict, Optional
from datetime import datetime, timezone
import logging

# Try to import AI libraries
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

logger = logging.getLogger(__name__)

# Initialize AI clients
openai_client = None
anthropic_client = None

def init_ai_clients():
    """Initialize AI API clients"""
    global openai_client, anthropic_client
    
    openai_key = os.getenv("OPENAI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    
    if OPENAI_AVAILABLE and openai_key:
        openai_client = AsyncOpenAI(api_key=openai_key)
        logger.info("OpenAI client initialized")
    
    if ANTHROPIC_AVAILABLE and anthropic_key:
        anthropic_client = anthropic.AsyncAnthropic(api_key=anthropic_key)
        logger.info("Anthropic client initialized")

def is_ai_available() -> bool:
    """Check if any AI service is available"""
    return openai_client is not None or anthropic_client is not None

async def generate_caption(content: str, image_description: Optional[str] = None, tone: str = "casual") -> str:
    """
    Generate an AI-powered caption for a post
    
    Args:
        content: The raw content or idea for the post
        image_description: Optional description of attached media
        tone: Tone of the caption (casual, professional, funny, inspirational)
    
    Returns:
        Generated caption
    """
    if not is_ai_available():
        return content  # Return original content if AI not available
    
    try:
        # Build prompt
        prompt = f"""Generate an engaging social media caption for the following content. 
Keep it {tone} and authentic. Include relevant emojis where appropriate.
Maximum 280 characters.

Content: {content}
"""
        if image_description:
            prompt += f"\nImage description: {image_description}"
        
        prompt += "\n\nCaption:"
        
        # Try OpenAI first
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a social media expert who creates engaging, authentic captions."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150,
                temperature=0.8
            )
            caption = response.choices[0].message.content.strip()
            return caption
        
        # Fallback to Anthropic
        elif anthropic_client:
            response = await anthropic_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=150,
                temperature=0.8,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            caption = response.content[0].text.strip()
            return caption
        
    except Exception as e:
        logger.error(f"Error generating caption: {e}")
        return content  # Return original on error

async def suggest_hashtags(content: str, max_hashtags: int = 10) -> List[str]:
    """
    Suggest relevant hashtags based on content
    
    Args:
        content: The post content
        max_hashtags: Maximum number of hashtags to return
    
    Returns:
        List of suggested hashtags (without # prefix)
    """
    if not is_ai_available():
        return []
    
    try:
        prompt = f"""Analyze this social media post and suggest {max_hashtags} relevant, trending hashtags.
Return ONLY the hashtags without the # symbol, one per line.

Post: {content}

Hashtags:"""
        
        # Try OpenAI first
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a social media expert who suggests trending, relevant hashtags."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=100,
                temperature=0.7
            )
            hashtags_text = response.choices[0].message.content.strip()
            hashtags = [tag.strip().replace('#', '') for tag in hashtags_text.split('\n') if tag.strip()]
            return hashtags[:max_hashtags]
        
        # Fallback to Anthropic
        elif anthropic_client:
            response = await anthropic_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=100,
                temperature=0.7,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            hashtags_text = response.content[0].text.strip()
            hashtags = [tag.strip().replace('#', '') for tag in hashtags_text.split('\n') if tag.strip()]
            return hashtags[:max_hashtags]
        
    except Exception as e:
        logger.error(f"Error suggesting hashtags: {e}")
        return []

async def recommend_posting_time(user_stats: Dict) -> Dict[str, any]:
    """
    Recommend the best time to post based on user's analytics
    
    Args:
        user_stats: Dictionary containing user analytics data
    
    Returns:
        Dictionary with recommended times and reasoning
    """
    # This is a simple heuristic-based recommendation
    # In a full implementation, this would analyze historical data
    
    # Default recommendations based on general social media best practices
    weekday_times = [
        {"day": "Monday", "time": "18:00", "reason": "High engagement after work"},
        {"day": "Tuesday", "time": "19:00", "reason": "Evening peak activity"},
        {"day": "Wednesday", "time": "12:00", "reason": "Lunch hour browsing"},
        {"day": "Thursday", "time": "20:00", "reason": "Evening engagement peak"},
        {"day": "Friday", "time": "17:00", "reason": "Weekend anticipation"}
    ]
    
    weekend_times = [
        {"day": "Saturday", "time": "11:00", "reason": "Mid-morning leisure time"},
        {"day": "Sunday", "time": "15:00", "reason": "Afternoon relaxation"}
    ]
    
    # Get current day of week
    now = datetime.now(timezone.utc)
    current_day = now.strftime("%A")
    
    # Find today's recommendation
    all_times = weekday_times + weekend_times
    today_rec = next((t for t in all_times if t["day"] == current_day), all_times[0])
    
    return {
        "recommended_time": today_rec["time"],
        "recommended_day": today_rec["day"],
        "reason": today_rec["reason"],
        "optimal_times_week": all_times,
        "general_tip": "Your audience is most active on weekdays between 6-9 PM"
    }

async def generate_content_ideas(user_interests: Optional[List[str]] = None, trending_topics: Optional[List[str]] = None) -> List[Dict[str, str]]:
    """
    Generate content ideas based on trending topics and user interests
    
    Args:
        user_interests: List of user's interests/topics
        trending_topics: List of trending topics
    
    Returns:
        List of content idea dictionaries with title and description
    """
    if not is_ai_available():
        # Return generic ideas if AI not available
        return [
            {
                "title": "Behind the Scenes",
                "description": "Share your creative process or daily routine",
                "category": "Lifestyle"
            },
            {
                "title": "Tips & Tricks",
                "description": "Share helpful advice in your area of expertise",
                "category": "Educational"
            },
            {
                "title": "Ask Me Anything",
                "description": "Engage with your audience through Q&A",
                "category": "Engagement"
            }
        ]
    
    try:
        interests_text = ", ".join(user_interests) if user_interests else "general topics"
        trending_text = ", ".join(trending_topics) if trending_topics else "current trends"
        
        prompt = f"""Generate 5 creative content ideas for a social media creator.

User interests: {interests_text}
Trending topics: {trending_text}

For each idea, provide:
- Title (short, catchy)
- Description (one sentence)
- Category (Lifestyle, Educational, Entertainment, Engagement, etc.)

Format each idea as:
Title: [title]
Description: [description]
Category: [category]
---"""
        
        # Try OpenAI first
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a creative social media strategist who generates engaging content ideas."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.8
            )
            ideas_text = response.choices[0].message.content.strip()
            
            # Parse ideas
            ideas = []
            idea_blocks = ideas_text.split('---')
            for block in idea_blocks:
                if not block.strip():
                    continue
                lines = [line.strip() for line in block.strip().split('\n') if line.strip()]
                if len(lines) >= 3:
                    title = lines[0].replace('Title:', '').strip()
                    description = lines[1].replace('Description:', '').strip()
                    category = lines[2].replace('Category:', '').strip()
                    ideas.append({
                        "title": title,
                        "description": description,
                        "category": category
                    })
            
            return ideas[:5] if ideas else []
        
        # Fallback to Anthropic
        elif anthropic_client:
            response = await anthropic_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=400,
                temperature=0.8,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            ideas_text = response.content[0].text.strip()
            
            # Parse ideas
            ideas = []
            idea_blocks = ideas_text.split('---')
            for block in idea_blocks:
                if not block.strip():
                    continue
                lines = [line.strip() for line in block.strip().split('\n') if line.strip()]
                if len(lines) >= 3:
                    title = lines[0].replace('Title:', '').strip()
                    description = lines[1].replace('Description:', '').strip()
                    category = lines[2].replace('Category:', '').strip()
                    ideas.append({
                        "title": title,
                        "description": description,
                        "category": category
                    })
            
            return ideas[:5] if ideas else []
        
    except Exception as e:
        logger.error(f"Error generating content ideas: {e}")
        # Return fallback ideas
        return [
            {
                "title": "Behind the Scenes",
                "description": "Share your creative process or daily routine",
                "category": "Lifestyle"
            },
            {
                "title": "Tips & Tricks",
                "description": "Share helpful advice in your area of expertise",
                "category": "Educational"
            }
        ]
