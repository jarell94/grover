import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
  warning: '#F59E0B',
  error: '#EF4444',
};

interface SubscriptionTier {
  tier_id: string;
  name: string;
  price: number;
  description?: string;
  benefits: string[];
  active: boolean;
}

interface Analytics {
  total_subscribers: number;
  monthly_revenue: number;
  gross_revenue: number;
  platform_fee: number;
  tier_breakdown: any[];
  badge_distribution: {
    Diamond: number;
    Gold: number;
    Silver: number;
    Bronze: number;
  };
}

export default function SubscriptionPlansScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [name, setName] = useState('Supporter');
  const [price, setPrice] = useState('4.99');
  const [description, setDescription] = useState('');
  const [benefits, setBenefits] = useState<string[]>(['Exclusive content', 'Supporter badge']);
  const [newBenefit, setNewBenefit] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!user?.user_id) return;

      const [tiersData, analyticsData] = await Promise.all([
        api.getSubscriptionTiers(user.user_id),
        api.getSubscriptionAnalytics().catch(() => null),
      ]);

      setTiers(tiersData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
      Alert.alert('Error', 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTier = async () => {
    if (!name.trim() || !price) {
      Alert.alert('Error', 'Please fill in name and price');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0.99) {
      Alert.alert('Error', 'Minimum price is $0.99');
      return;
    }

    if (!user?.monetization_enabled) {
      Alert.alert(
        'Monetization Required',
        'Please enable monetization in your profile settings first.'
      );
      return;
    }

    try {
      await api.createSubscriptionTier(user.user_id, {
        name,
        price: priceNum,
        description,
        benefits,
      });

      Alert.alert('Success', 'Subscription tier created!');
      setShowCreateForm(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Create tier error:', error);
      Alert.alert('Error', error.message || 'Failed to create tier');
    }
  };

  const resetForm = () => {
    setName('Supporter');
    setPrice('4.99');
    setDescription('');
    setBenefits(['Exclusive content', 'Supporter badge']);
    setNewBenefit('');
  };

  const addBenefit = () => {
    if (newBenefit.trim()) {
      setBenefits([...benefits, newBenefit.trim()]);
      setNewBenefit('');
    }
  };

  const removeBenefit = (index: number) => {
    setBenefits(benefits.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription Plans</Text>
        <TouchableOpacity onPress={() => setShowCreateForm(true)}>
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Analytics Card */}
        {analytics && (
          <View style={styles.analyticsCard}>
            <Text style={styles.sectionTitle}>Your Subscription Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{analytics.total_subscribers}</Text>
                <Text style={styles.statLabel}>Subscribers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.success }]}>
                  ${analytics.monthly_revenue.toFixed(2)}
                </Text>
                <Text style={styles.statLabel}>Monthly Revenue</Text>
              </View>
            </View>

            {/* Badge Distribution */}
            <View style={styles.badgeSection}>
              <Text style={styles.subsectionTitle}>Supporter Badges</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badgeItem}>
                  <Text style={styles.badgeIcon}>💎</Text>
                  <Text style={styles.badgeCount}>{analytics.badge_distribution.Diamond}</Text>
                </View>
                <View style={styles.badgeItem}>
                  <Text style={styles.badgeIcon}>👑</Text>
                  <Text style={styles.badgeCount}>{analytics.badge_distribution.Gold}</Text>
                </View>
                <View style={styles.badgeItem}>
                  <Text style={styles.badgeIcon}>⭐</Text>
                  <Text style={styles.badgeCount}>{analytics.badge_distribution.Silver}</Text>
                </View>
                <View style={styles.badgeItem}>
                  <Text style={styles.badgeIcon}>🥉</Text>
                  <Text style={styles.badgeCount}>{analytics.badge_distribution.Bronze}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Existing Tiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Tiers</Text>
          {tiers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No subscription tiers yet</Text>
              <Text style={styles.emptySubtext}>
                Create a tier to start receiving monthly support from fans
              </Text>
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
              </View>
            ))
          )}
        </View>

        {/* Create Form */}
        {showCreateForm && (
          <View style={styles.createForm}>
            <Text style={styles.formTitle}>Create Subscription Tier</Text>

            <TextInput
              style={styles.input}
              placeholder="Tier Name (e.g., Supporter, VIP)"
              placeholderTextColor={Colors.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <View style={styles.priceInput}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="4.99"
                placeholderTextColor={Colors.textSecondary}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
              <Text style={styles.perMonth}>/month</Text>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              placeholderTextColor={Colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.subsectionTitle}>Benefits</Text>
            {benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitInputRow}>
                <Text style={styles.benefitInputText}>{benefit}</Text>
                <TouchableOpacity onPress={() => removeBenefit(index)}>
                  <Ionicons name="close-circle" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.addBenefitRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Add benefit..."
                placeholderTextColor={Colors.textSecondary}
                value={newBenefit}
                onChangeText={setNewBenefit}
                onSubmitEditing={addBenefit}
              />
              <TouchableOpacity style={styles.addButton} onPress={addBenefit}>
                <Ionicons name="add" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.createButton]} onPress={handleCreateTier}>
                <Text style={styles.buttonText}>Create Tier</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  analyticsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  badgeSection: {
    marginTop: 8,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  badgeItem: {
    alignItems: 'center',
  },
  badgeIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  badgeCount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  section: {
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
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  createForm: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dollarSign: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  perMonth: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  benefitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  benefitInputText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  addBenefitRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.card,
  },
  createButton: {
    backgroundColor: Colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
});
