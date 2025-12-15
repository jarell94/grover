import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  success: '#10B981',
  warning: '#F59E0B',
};

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [contentPerformance, setContentPerformance] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [overviewData, performanceData] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getContentPerformance()
      ]);
      setOverview(overviewData);
      setContentPerformance(performanceData);
    } catch (error) {
      console.error('Load analytics error:', error);
      Alert.alert('Error', 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#8B5CF6', '#EC4899', '#0EA5E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <TouchableOpacity onPress={loadAnalytics}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshing={refreshing}
        onScroll={() => {
          if (refreshing) return;
          setRefreshing(true);
          loadAnalytics();
        }}
      >
        {/* Overview Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: Colors.primary + '20' }]}>
              <Ionicons name="eye" size={28} color={Colors.primary} />
              <Text style={styles.statValue}>{overview?.total_views || 0}</Text>
              <Text style={styles.statLabel}>Total Views</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.secondary + '20' }]}>
              <Ionicons name="heart" size={28} color={Colors.secondary} />
              <Text style={styles.statValue}>{overview?.total_likes || 0}</Text>
              <Text style={styles.statLabel}>Total Likes</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.success + '20' }]}>
              <Ionicons name="people" size={28} color={Colors.success} />
              <Text style={styles.statValue}>{overview?.total_followers || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.warning + '20' }]}>
              <Ionicons name="chatbubbles" size={28} color={Colors.warning} />
              <Text style={styles.statValue}>{overview?.total_comments || 0}</Text>
              <Text style={styles.statLabel}>Comments</Text>
            </View>
          </View>
        </View>

        {/* Engagement Rate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Engagement</Text>
          <View style={styles.engagementCard}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.engagementGradient}
            >
              <View style={styles.engagementContent}>
                <Text style={styles.engagementValue}>
                  {overview?.engagement_rate || '0'}%
                </Text>
                <Text style={styles.engagementLabel}>Engagement Rate</Text>
                <View style={styles.engagementMeta}>
                  <View style={styles.engagementMetaItem}>
                    <Ionicons name="arrow-up" size={16} color="#10B981" />
                    <Text style={styles.engagementMetaText}>
                      {overview?.engagement_change || '+0'}% vs last week
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Top Performing Content */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Performing Content</Text>
          {contentPerformance.length > 0 ? (
            contentPerformance.map((item, index) => (
              <View key={index} style={styles.contentCard}>
                <View style={styles.contentRank}>
                  <Text style={styles.contentRankText}>#{index + 1}</Text>
                </View>
                <View style={styles.contentInfo}>
                  <Text style={styles.contentText} numberOfLines={2}>
                    {item.content || 'Media post'}
                  </Text>
                  <View style={styles.contentStats}>
                    <View style={styles.contentStat}>
                      <Ionicons name="eye-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.contentStatText}>{item.views || 0}</Text>
                    </View>
                    <View style={styles.contentStat}>
                      <Ionicons name="heart-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.contentStatText}>{item.likes || 0}</Text>
                    </View>
                    <View style={styles.contentStat}>
                      <Ionicons name="chatbubble-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.contentStatText}>{item.comments || 0}</Text>
                    </View>
                    <View style={styles.contentStat}>
                      <Ionicons name="share-social-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.contentStatText}>{item.shares || 0}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.contentScore}>
                  <Text style={styles.contentScoreText}>{item.score || '0'}</Text>
                  <Text style={styles.contentScoreLabel}>score</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="bar-chart-outline" size={60} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Data Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create more content to see your analytics
              </Text>
            </View>
          )}
        </View>

        {/* Best Time to Post */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightCard}>
            <View style={styles.insightIcon}>
              <Ionicons name="bulb" size={24} color={Colors.warning} />
            </View>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Best Time to Post</Text>
              <Text style={styles.insightText}>
                {overview?.best_time || 'Weekdays 6-9 PM'}
              </Text>
            </View>
          </View>
          <View style={styles.insightCard}>
            <View style={styles.insightIcon}>
              <Ionicons name="trending-up" size={24} color={Colors.success} />
            </View>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Top Content Type</Text>
              <Text style={styles.insightText}>
                {overview?.top_content_type || 'Images with text'}
              </Text>
            </View>
          </View>
          <View style={styles.insightCard}>
            <View style={styles.insightIcon}>
              <Ionicons name="people" size={24} color={Colors.primary} />
            </View>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Audience Growth</Text>
              <Text style={styles.insightText}>
                +{overview?.new_followers || 0} new followers this week
              </Text>
            </View>
          </View>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (width - 48) / 2,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  engagementCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  engagementGradient: {
    padding: 24,
  },
  engagementContent: {
    alignItems: 'center',
  },
  engagementValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  engagementLabel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
  },
  engagementMeta: {
    marginTop: 16,
  },
  engagementMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementMetaText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  contentCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    gap: 12,
  },
  contentRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentRankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  contentInfo: {
    flex: 1,
    gap: 8,
  },
  contentText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  contentStats: {
    flexDirection: 'row',
    gap: 12,
  },
  contentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contentStatText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  contentScore: {
    alignItems: 'center',
  },
  contentScoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.success,
  },
  contentScoreLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    gap: 16,
  },
  insightIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  insightText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
