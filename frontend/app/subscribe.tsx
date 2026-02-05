import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: 'rgba(255,255,255,0.1)',
  success: '#10B981',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  diamond: '#B9F2FF',
};

interface SubscriptionTier {
  tier_id: string;
  name: string;
  price: number;
  description?: string;
  benefits: string[];
  active: boolean;
}

export default function SubscribeScreen() {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const params = useLocalSearchParams();
  const creatorId = params.creatorId as string;

  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [creator, setCreator] = useState<any>(null);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [creatorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [creatorData, tiersData, statusData] = await Promise.all([
        api.getUserProfile(creatorId),
        api.getSubscriptionTiers(creatorId),
        currentUser ? api.checkSubscriptionStatus(currentUser.user_id, creatorId).catch(() => null) : Promise.resolve(null),
      ]);

      setCreator(creatorData);
      setTiers(tiersData);
      setSubscriptionStatus(statusData);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
      Alert.alert('Error', 'Failed to load subscription options');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tierId: string) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to subscribe');
      return;
    }

    setSubscribing(true);
    try {
      await api.subscribeToCreator(creatorId, tierId);
      Alert.alert('Success!', 'You are now subscribed! Thank you for your support! 🎉');
      loadData();
    } catch (error: any) {
      console.error('Subscribe error:', error);
      Alert.alert('Error', error.message || 'Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancelSubscription = () => {
    if (!subscriptionStatus?.subscription_id) return;

    Alert.alert(
      'Cancel Subscription?',
      'Are you sure you want to cancel your subscription?',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.cancelSubscription(subscriptionStatus.subscription_id);
              Alert.alert('Subscription Cancelled', 'Your subscription has been cancelled.');
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel subscription');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const badgeColors = {
    Bronze: Colors.bronze,
    Silver: Colors.silver,
    Gold: Colors.gold,
    Diamond: Colors.diamond,
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscribe</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Creator Card */}
        {creator && (
          <View style={styles.creatorCard}>
            {creator.picture ? (
              <Image source={{ uri: creator.picture }} style={styles.creatorAvatar} />
            ) : (
              <View style={[styles.creatorAvatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={32} color={Colors.textSecondary} />
              </View>
            )}
            <Text style={styles.creatorName}>{creator.name}</Text>
            {creator.bio && <Text style={styles.creatorBio}>{creator.bio}</Text>}
          </View>
        )}

        {/* Current Subscription Status */}
        {subscriptionStatus?.subscribed && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
              <Text style={styles.statusTitle}>Active Subscriber</Text>
            </View>
            
            {subscriptionStatus.badge && (
              <View style={styles.badgeDisplay}>
                <Text style={styles.badgeIcon}>{subscriptionStatus.badge.badge_icon}</Text>
                <View style={styles.badgeInfo}>
                  <Text style={styles.badgeLevel}>{subscriptionStatus.badge.badge_level} Supporter</Text>
                  <Text style={styles.badgeDuration}>
                    {subscriptionStatus.badge.duration_months} month{subscriptionStatus.badge.duration_months !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSubscription}>
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Subscription Tiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support Tiers</Text>
          <Text style={styles.sectionSubtitle}>
            Choose a tier to support {creator?.name} and get exclusive benefits
          </Text>

          {tiers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No subscription tiers available</Text>
            </View>
          ) : (
            tiers.map((tier) => (
              <View key={tier.tier_id} style={styles.tierCard}>
                <View style={styles.tierHeader}>
                  <Text style={styles.tierName}>{tier.name}</Text>
                  <Text style={styles.tierPrice}>${tier.price.toFixed(2)}/mo</Text>
                </View>

                {tier.description && (
                  <Text style={styles.tierDescription}>{tier.description}</Text>
                )}

                {tier.benefits && tier.benefits.length > 0 && (
                  <View style={styles.benefitsList}>
                    {tier.benefits.map((benefit, index) => (
                      <View key={index} style={styles.benefitItem}>
                        <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                        <Text style={styles.benefitText}>{benefit}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {!subscriptionStatus?.subscribed && (
                  <TouchableOpacity
                    style={[styles.subscribeButton, subscribing && styles.buttonDisabled]}
                    onPress={() => handleSubscribe(tier.tier_id)}
                    disabled={subscribing}
                  >
                    {subscribing ? (
                      <ActivityIndicator color={Colors.text} />
                    ) : (
                      <>
                        <Ionicons name="heart" size={20} color={Colors.text} />
                        <Text style={styles.subscribeButtonText}>Subscribe</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {subscriptionStatus?.tier?.tier_id === tier.tier_id && (
                  <View style={styles.currentTierBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.currentTierText}>Current Tier</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Badge Progression */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supporter Badge Progression</Text>
          <Text style={styles.sectionSubtitle}>Earn badges as you support longer</Text>

          <View style={styles.badgeProgressionCard}>
            <View style={styles.progressionItem}>
              <Text style={styles.progressionIcon}>🥉</Text>
              <View style={styles.progressionInfo}>
                <Text style={styles.progressionLevel}>Bronze</Text>
                <Text style={styles.progressionDuration}>0-3 months</Text>
              </View>
            </View>

            <View style={styles.progressionItem}>
              <Text style={styles.progressionIcon}>⭐</Text>
              <View style={styles.progressionInfo}>
                <Text style={styles.progressionLevel}>Silver</Text>
                <Text style={styles.progressionDuration}>3-6 months</Text>
              </View>
            </View>

            <View style={styles.progressionItem}>
              <Text style={styles.progressionIcon}>👑</Text>
              <View style={styles.progressionInfo}>
                <Text style={styles.progressionLevel}>Gold</Text>
                <Text style={styles.progressionDuration}>6-12 months</Text>
              </View>
            </View>

            <View style={styles.progressionItem}>
              <Text style={styles.progressionIcon}>💎</Text>
              <View style={styles.progressionInfo}>
                <Text style={styles.progressionLevel}>Diamond</Text>
                <Text style={styles.progressionDuration}>12+ months</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            85% of your subscription goes directly to the creator. Subscriptions renew monthly and can be cancelled anytime.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  scrollContent: {
    padding: 16,
  },
  creatorCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  creatorAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  creatorBio: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.success,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.success,
  },
  badgeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  badgeIcon: {
    fontSize: 48,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeLevel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  badgeDuration: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  tierCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  tierPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  tierDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  benefitsList: {
    gap: 8,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.text,
  },
  subscribeButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  currentTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  currentTierText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  badgeProgressionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  progressionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  progressionIcon: {
    fontSize: 32,
  },
  progressionInfo: {
    flex: 1,
  },
  progressionLevel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  progressionDuration: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
});
