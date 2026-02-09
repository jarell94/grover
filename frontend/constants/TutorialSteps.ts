// Tutorial Steps Configuration
// Defines all steps in the app tutorial/onboarding flow

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetId?: string; // ID of the element to highlight (optional)
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon: string; // Ionicons icon name
  feature: string; // Feature category
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Grover!',
    description: 'Your social media platform for creators and fans. Let\'s take a quick tour of the features!',
    placement: 'center',
    icon: 'rocket-outline',
    feature: 'Introduction'
  },
  {
    id: 'home_feed',
    title: 'Home Feed',
    description: 'Discover posts from creators you follow. Scroll through your personalized feed.',
    targetId: 'home-feed',
    placement: 'center',
    icon: 'home-outline',
    feature: 'Content Discovery'
  },
  {
    id: 'create_post',
    title: 'Create Content',
    description: 'Share your thoughts, images, and videos with your audience. Tap the create button to get started!',
    targetId: 'create-button',
    placement: 'bottom',
    icon: 'add-circle-outline',
    feature: 'Content Creation'
  },
  {
    id: 'stories',
    title: '24-Hour Stories',
    description: 'Share temporary content that disappears after 24 hours. Perfect for behind-the-scenes moments!',
    targetId: 'stories-section',
    placement: 'bottom',
    icon: 'images-outline',
    feature: 'Stories'
  },
  {
    id: 'messaging',
    title: 'Private Messages',
    description: 'Connect with friends through private and group chats. Send text, images, videos, and voice messages!',
    targetId: 'messages-tab',
    placement: 'top',
    icon: 'chatbubbles-outline',
    feature: 'Messaging'
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Customize your profile with bio, links, and settings. Make it uniquely yours!',
    targetId: 'profile-tab',
    placement: 'top',
    icon: 'person-outline',
    feature: 'Profile'
  },
  {
    id: 'monetization',
    title: 'Earn Money',
    description: 'Enable monetization to receive tips, offer subscriptions, and sell digital products. Turn your passion into income!',
    targetId: 'monetization-section',
    placement: 'center',
    icon: 'cash-outline',
    feature: 'Monetization'
  },
  {
    id: 'live_streaming',
    title: 'Go Live',
    description: 'Stream live video to your audience. Connect in real-time and build your community!',
    targetId: 'live-button',
    placement: 'bottom',
    icon: 'videocam-outline',
    feature: 'Live Streaming'
  },
  {
    id: 'analytics',
    title: 'Track Performance',
    description: 'View analytics about your posts, followers, and engagement. Understand what works best!',
    targetId: 'analytics-link',
    placement: 'center',
    icon: 'stats-chart-outline',
    feature: 'Analytics'
  },
  {
    id: 'marketplace',
    title: 'Buy & Sell',
    description: 'Discover products in the marketplace. Creators can sell physical and digital items!',
    targetId: 'marketplace-link',
    placement: 'center',
    icon: 'storefront-outline',
    feature: 'Marketplace'
  }
];

// Helper function to get step by ID
export const getTutorialStep = (stepId: string): TutorialStep | undefined => {
  return TUTORIAL_STEPS.find(step => step.id === stepId);
};

// Helper function to get step by index
export const getTutorialStepByIndex = (index: number): TutorialStep | undefined => {
  return TUTORIAL_STEPS[index];
};

// Total number of tutorial steps
export const TOTAL_TUTORIAL_STEPS = TUTORIAL_STEPS.length;
