# Grover App Tutorial System Documentation

## Overview

The Grover app includes a comprehensive onboarding tutorial system that introduces new users to all platform features through an interactive 10-step walkthrough.

### Key Features
- ✅ **10 Interactive Steps** covering all major features
- ✅ **Progress Tracking** saved to backend
- ✅ **Skip & Resume** capability
- ✅ **Beautiful UI** with smooth animations
- ✅ **Mobile Optimized** for all devices
- ✅ **First-time User Detection** auto-shows for new users
- ✅ **Restart Option** available in settings

---

## Tutorial Steps

### 1. Welcome
**Feature:** Introduction
**Description:** Welcome message and platform overview
**Duration:** Auto-advances after acknowledgment

### 2. Home Feed
**Feature:** Content Discovery
**Target:** Main feed area
**Description:** How to browse and discover content from followed creators

### 3. Create Post
**Feature:** Content Creation
**Target:** Create button (+)
**Description:** How to create and share posts with images, videos, and text

### 4. Stories
**Feature:** 24-Hour Stories
**Target:** Stories section
**Description:** Creating temporary content that expires in 24 hours

### 5. Messaging
**Feature:** Private Messages
**Target:** Messages tab
**Description:** Private and group chats with multimedia support

### 6. Profile
**Feature:** Profile Management
**Target:** Profile tab
**Description:** Customizing profile, bio, links, and settings

### 7. Monetization
**Feature:** Earning Money
**Target:** Monetization settings
**Description:** Enabling tips, subscriptions, and digital product sales

### 8. Live Streaming
**Feature:** Live Broadcasting
**Target:** Live button
**Description:** Streaming live video to engage with audience

### 9. Analytics
**Feature:** Performance Tracking
**Target:** Analytics link
**Description:** Viewing insights about posts, followers, and engagement

### 10. Marketplace
**Feature:** Buy & Sell
**Target:** Marketplace link
**Description:** Discovering and selling products

---

## Technical Implementation

### Backend API

#### Update Tutorial Progress
```http
PUT /api/users/me/tutorial
Content-Type: application/json

{
  "tutorial_completed": true,
  "tutorial_step": 10
}

Response:
{
  "message": "Tutorial progress updated",
  "tutorial_completed": true,
  "tutorial_step": 10
}
```

#### Get Tutorial Progress
```http
GET /api/users/me/tutorial

Response:
{
  "tutorial_completed": false,
  "tutorial_step": 3
}
```

### Frontend Implementation

#### Tutorial Context
Location: `frontend/contexts/TutorialContext.tsx`

Provides global tutorial state management:
- `tutorialActive`: boolean - Whether tutorial is currently showing
- `currentStep`: number - Current step (0-9)
- `totalSteps`: number - Total steps (10)
- `startTutorial()`: Start the tutorial
- `nextStep()`: Advance to next step
- `previousStep()`: Go back one step
- `skipTutorial()`: Skip completely
- `completeTutorial()`: Mark as complete
- `resetTutorial()`: Restart from beginning

#### Tutorial Steps Configuration
Location: `frontend/constants/TutorialSteps.ts`

Defines all 10 tutorial steps with:
- Step ID
- Title and description
- Target element ID
- Tooltip placement
- Icon
- Feature category

#### Tutorial Welcome Screen
Location: `frontend/app/tutorial.tsx`

Full-screen carousel showing:
- Feature cards for each step
- Visual illustrations
- Descriptions
- Interactive navigation
- "Get Started" button
- Skip option

---

## User Flows

### First-Time User
1. User signs up with Google OAuth
2. Account created, redirected to app
3. **Tutorial welcome screen appears automatically**
4. User clicks "Start Tutorial" or "Skip"
5. If started, interactive walkthrough begins
6. User proceeds through 10 steps
7. Progress saved to backend after each step
8. Tutorial completes, user can explore app

### Returning User (Incomplete Tutorial)
1. User logs in
2. Tutorial progress loaded from backend
3. Option to "Resume Tutorial" shown in settings
4. User can continue from last step
5. Or skip remainder of tutorial

### Restarting Tutorial
1. User navigates to Settings
2. Finds "Tutorial" section
3. Clicks "Restart Tutorial"
4. Tutorial resets to step 0
5. User goes through steps again

---

## Database Schema

### User Model Extensions
```python
class User(BaseModel):
    # ... existing fields ...
    tutorial_completed: bool = False  # Whether tutorial is done
    tutorial_step: int = 0  # Current step (0-10)
```

### Database Index
```python
await safe_create_index(
    db.users, 
    "tutorial_completed", 
    background=True, 
    name="users_tutorial_completed"
)
```

---

## Customization Guide

### Adding New Tutorial Steps

1. **Update TutorialSteps.ts**
```typescript
export const TUTORIAL_STEPS: TutorialStep[] = [
  // ... existing steps ...
  {
    id: 'new_feature',
    title: 'New Feature',
    description: 'Description of the new feature',
    targetId: 'new-feature-button',
    placement: 'bottom',
    icon: 'star-outline',
    feature: 'New Category'
  }
];
```

2. **Update Total Steps**
- Increment `TOTAL_TUTORIAL_STEPS` constant
- Update backend validation (0-N where N is new total)

3. **Add UI Element ID**
- Ensure target element has matching ID attribute
- Example: `<View id="new-feature-button">`

### Customizing Tutorial UI

#### Colors and Styling
Edit `TutorialOverlay.tsx` styles:
```typescript
const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)', // Adjust opacity
  },
  tooltip: {
    backgroundColor: Colors.primary, // Change color
    borderRadius: 12, // Adjust rounding
  },
  // ... other styles
});
```

#### Animation Speed
Adjust animation duration:
```typescript
Animated.timing(fadeAnim, {
  toValue: 1,
  duration: 300, // Milliseconds
  useNativeDriver: true
}).start();
```

---

## Testing

### Manual Testing Checklist

#### First-Time User Flow
- [ ] Sign up as new user
- [ ] Tutorial welcome screen appears
- [ ] Can start tutorial
- [ ] Can skip tutorial
- [ ] Each step displays correctly
- [ ] Navigation works (Next, Back)
- [ ] Progress saves to backend
- [ ] Tutorial completes successfully
- [ ] "Get Started" redirects to app

#### Resume Tutorial Flow
- [ ] Start tutorial, complete 3 steps
- [ ] Close app
- [ ] Reopen app, log in
- [ ] Tutorial can be resumed
- [ ] Resumes at correct step (step 4)
- [ ] Can complete from middle
- [ ] Progress persists

#### Skip Tutorial Flow
- [ ] Start tutorial
- [ ] Click "Skip Tutorial"
- [ ] Confirmation dialog appears
- [ ] Confirm skip
- [ ] Tutorial closes
- [ ] Progress marked as skipped
- [ ] App functions normally

#### Restart Tutorial Flow
- [ ] Go to Settings
- [ ] Find "Restart Tutorial" option
- [ ] Click restart
- [ ] Tutorial resets to step 0
- [ ] Can complete full tutorial again
- [ ] Progress updates correctly

### Automated Testing

```typescript
// Example Jest test
describe('Tutorial System', () => {
  it('should show tutorial for new users', async () => {
    const { getByText } = render(<TutorialWelcome />);
    expect(getByText('Welcome to Grover!')).toBeTruthy();
  });

  it('should save progress to backend', async () => {
    const { result } = renderHook(() => useTutorial());
    await act(async () => {
      await result.current.nextStep();
    });
    expect(mockUpdateTutorial).toHaveBeenCalledWith({
      tutorial_step: 1
    });
  });
});
```

---

## Troubleshooting

### Tutorial Not Showing for New Users

**Symptoms:** New user signs up but tutorial doesn't appear

**Possible Causes:**
1. Tutorial already marked as completed in database
2. Context not properly initialized
3. User object missing tutorial fields

**Solutions:**
1. Check database: `db.users.findOne({user_id: "xxx"})`
2. Verify `tutorial_completed` is `false`
3. Ensure TutorialContext wraps app properly
4. Check console for errors

### Tutorial Progress Not Saving

**Symptoms:** User completes steps but progress resets

**Possible Causes:**
1. API endpoint not reachable
2. Authentication token expired
3. Backend validation error

**Solutions:**
1. Check network requests in dev tools
2. Verify auth token is valid
3. Check backend logs for errors
4. Ensure step number is valid (0-10)

### Tutorial UI Not Displaying Correctly

**Symptoms:** Tooltip positioning wrong, missing elements

**Possible Causes:**
1. Target element ID doesn't exist
2. Layout not fully rendered
3. Styling conflicts

**Solutions:**
1. Verify target element has correct ID
2. Add delay before showing tooltip
3. Check z-index and positioning styles
4. Test on different screen sizes

---

## Best Practices

### For Product Teams
- ✅ Keep tutorial steps concise (< 30 seconds each)
- ✅ Focus on essential features only
- ✅ Update tutorial when adding major features
- ✅ Test with real users regularly
- ✅ Monitor completion rates
- ✅ Iterate based on feedback

### For Developers
- ✅ Keep tutorial step count reasonable (7-12 steps)
- ✅ Ensure all target elements have stable IDs
- ✅ Test on multiple devices and screen sizes
- ✅ Handle edge cases (rapid clicking, back button)
- ✅ Add proper error handling
- ✅ Log tutorial analytics events

### For Designers
- ✅ Use consistent visual language
- ✅ Ensure good contrast for readability
- ✅ Provide visual hierarchy (title > description)
- ✅ Use animations sparingly
- ✅ Test with accessibility tools
- ✅ Consider dark/light mode support

---

## Analytics & Metrics

### Tracked Events

```typescript
// Tutorial Started
analytics.track('tutorial_started', {
  user_id: userId,
  timestamp: Date.now()
});

// Tutorial Step Completed
analytics.track('tutorial_step_completed', {
  user_id: userId,
  step_id: 'home_feed',
  step_number: 2,
  timestamp: Date.now()
});

// Tutorial Completed
analytics.track('tutorial_completed', {
  user_id: userId,
  total_time: 120, // seconds
  timestamp: Date.now()
});

// Tutorial Skipped
analytics.track('tutorial_skipped', {
  user_id: userId,
  step_when_skipped: 3,
  timestamp: Date.now()
});
```

### Key Metrics
- **Completion Rate:** % of users who complete tutorial
- **Average Time:** Time to complete tutorial
- **Drop-off Points:** Which steps users skip
- **Resume Rate:** % who resume after interruption
- **Restart Rate:** % who restart tutorial

---

## Future Enhancements

### Planned Features
- [ ] **Interactive Demos:** Actually perform actions instead of just showing
- [ ] **Video Tutorials:** Short clips demonstrating features
- [ ] **Contextual Tooltips:** Show tips based on user behavior
- [ ] **Personalized Path:** Different tutorials for creators vs. consumers
- [ ] **Gamification:** Badges/rewards for completing tutorial
- [ ] **Multi-language:** Tutorial in different languages
- [ ] **A/B Testing:** Test different tutorial variations
- [ ] **Micro-tutorials:** Quick tips throughout app
- [ ] **Tutorial Library:** Browse all features anytime
- [ ] **Onboarding Checklist:** Track progress on multiple tasks

### Potential Improvements
- Reduce number of steps (combine related features)
- Add skip-to-step functionality
- Include search/jump-to feature
- Add tutorial for each major feature update
- Create role-specific tutorials (creator, fan, merchant)

---

## Support & Feedback

### Reporting Issues
If you encounter problems with the tutorial system:
1. Check this documentation first
2. Review troubleshooting section
3. Check GitHub issues
4. Create new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/video if applicable
   - Device and OS information

### Contributing
To improve the tutorial system:
1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request with:
   - Clear description
   - Rationale for changes
   - Testing evidence

---

## Changelog

### Version 1.0.0 (Current)
- ✅ Initial tutorial system implementation
- ✅ 10 comprehensive tutorial steps
- ✅ Backend progress tracking
- ✅ Skip and resume functionality
- ✅ Beautiful UI with animations
- ✅ Mobile optimization
- ✅ Complete documentation

---

**Last Updated:** February 9, 2024
**Version:** 1.0.0
**Status:** Production Ready ✅
