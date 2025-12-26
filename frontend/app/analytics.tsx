import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  FlatList,
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
  danger: '#EF4444',
};

const formatNumber = (n: any) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return Intl.NumberFormat().format(num);
};

const formatTimestamp = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

interface ContentItem {
  id: string;
  post_id?: string;
  content: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  score: number;
}

type RawContentItem = any;

/**
 * Normalize content item from different API response formats
 */
function normalizeContentItem(item: RawContentItem): ContentItem {
  return {
    id: item.id ?? item.post_id ?? `item-${Date.now()}-${Math.random()}`,
    post_id: item.post_id,
    content: item.content ?? item.caption ?? "",
    views: item.views ?? item.view_count ?? item.views_count ?? 0,
    likes: item.likes ?? item.likes_count ?? 0,
    comments: item.comments ?? item.comments_count ?? 0,
    shares: item.shares ?? item.shares_count ?? 0,
    score: item.score ?? 0,
  };
}

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [contentPerformance, setContentPerformance] = useState<ContentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Safe engagement change number parsing
  const engagementChangeNum = useMemo(() => {
    const n = Number(overview?.engagement_change);
    return Number.isFinite(n) ? n : null;
  }, [overview]);

  const engagementChangePositive = engagementChangeNum !== null && engagementChangeNum >= 0;

  // Load analytics with mounted flag
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const [overviewData, performanceData] = await Promise.all([
          api.getAnalyticsOverview(),
          api.getContentPerformance(),
        ]);

        if (!mounted) return;

        setOverview(overviewData);
        setContentPerformance(
          Array.isArray(performanceData) 
            ? performanceData.map(normalizeContentItem) 
            : []
        );
        setLastUpdated(new Date());
      } catch (e) {
        if (mounted) Alert.alert("Error", "Failed to load analytics");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [overviewData, performanceData] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getContentPerformance(),
      ]);
      setOverview(overviewData);
      setContentPerformance(
        Array.isArray(performanceData) 
          ? performanceData.map(normalizeContentItem) 
          : []
      );
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Refresh analytics error:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Safe getter for engagement rate
  const getEngagementRate = () => {
    if (overview?.engagement_rate === null || overview?.engagement_rate === undefined) {
      return '0';
    }
    const rate = Number(overview.engagement_rate);
    return Number.isFinite(rate) ? rate.toFixed(1) : '0';
  };

  // Safe getter for engagement change
  const getEngagementChange = () => {
    if (engagementChangeNum === null) return '0.0';
    return engagementChangeNum >= 0 
      ? `+${engagementChangeNum.toFixed(1)}` 
      : engagementChangeNum.toFixed(1);
  };

  const renderContentItem = ({ item, index }: { item: ContentItem; index: number }) => {
    const postId = item.post_id ?? item.id;
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          if (!postId) return;
          router.push(`/post/${postId}`);
        }}
        style={styles.contentCard}
      >
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
              <Text style={styles.contentStatText}>{formatNumber(item.views)}</Text>
            </View>
            <View style={styles.contentStat}>
              <Ionicons name="heart-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.contentStatText}>{formatNumber(item.likes)}</Text>
            </View>
            <View style={styles.contentStat}>
              <Ionicons name="chatbubble-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.contentStatText}>{formatNumber(item.comments)}</Text>
            </View>
            <View style={styles.contentStat}>
              <Ionicons name="share-social-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.contentStatText}>{formatNumber(item.shares)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.contentScore}>
          <Text style={styles.contentScoreText}>{formatNumber(item.score)}</Text>
          <Text style={styles.contentScoreLabel}>score</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyContent = () => (
    <View style={styles.emptyState}>
      <Ionicons name="bar-chart-outline" size={60} color={Colors.textSecondary} />
      <Text style={styles.emptyTitle}>No Data Yet</Text>
      <Text style={styles.emptySubtitle}>Create more content to see your analytics</Text>
    </View>
  );

  const renderListHeader = () => (
    <>
      {/* Overview Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: Colors.primary + '20' }]}>
            <Ionicons name="eye" size={28} color={Colors.primary} />
            <Text style={styles.statValue}>{formatNumber(overview?.total_views)}</Text>
            <Text style={styles.statLabel}>Total Views</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: Colors.secondary + '20' }]}>
            <Ionicons name="heart" size={28} color={Colors.secondary} />
            <Text style={styles.statValue}>{formatNumber(overview?.total_likes)}</Text>
            <Text style={styles.statLabel}>Total Likes</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: Colors.success + '20' }]}>
            <Ionicons name="people" size={28} color={Colors.success} />
            <Text style={styles.statValue}>{formatNumber(overview?.total_followers)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: Colors.warning + '20' }]}>
            <Ionicons name="chatbubbles" size={28} color={Colors.warning} />
            <Text style={styles.statValue}>{formatNumber(overview?.total_comments)}</Text>
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
                {getEngagementRate()}%
              </Text>
              <Text style={styles.engagementLabel}>Engagement Rate</Text>

              <View style={styles.engagementMeta}>
                <View style={styles.engagementMetaItem}>
                  <Ionicons 
                    name={engagementChangeNum === null ? "remove" : engagementChangePositive ? "arrow-up" : "arrow-down"} 
                    size={16} 
                    color={engagementChangeNum === null ? "rgba(255,255,255,0.8)" : engagementChangePositive ? "#10B981" : "#EF4444"} 
                  />
                  <Text style={styles.engagementMetaText}>
                    {engagementChangeNum === null ? "0.0% vs last week" : `${getEngagementChange()}% vs last week`}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* Title for list section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Performing Content</Text>
      </View>
    </>
  );

  const renderListFooter = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Insights</Text>

      <View style={styles.insightCard}>
        <View style={styles.insightIcon}>
          <Ionicons name="bulb" size={24} color={Colors.warning} />
        </View>
        <View style={styles.insightContent}>
          <Text style={styles.insightTitle}>Best Time to Post</Text>
          <Text style={styles.insightText}>{overview?.best_time || 'Weekdays 6-9 PM'}</Text>
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
            +{formatNumber(overview?.new_followers)} new followers this week
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#EC4899', '#0EA5E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Analytics</Text>
            {lastUpdated && (
              <Text style={styles.lastUpdated}>
                Updated {formatTimestamp(lastUpdated)}
              </Text>
            )}
          </View>

          <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Main FlatList with all content */}
      <FlatList
        data={contentPerformance}
        keyExtractor={(item, index) => item?.id ?? item?.post_id ?? `content-${index}`}
        renderItem={renderContentItem}
        ListEmptyComponent={renderEmptyContent}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerButton: { width: 40, alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  lastUpdated: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: (width - 48) / 2,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  statValue: { fontSize: 28, fontWeight: 'bold', color: Colors.text },
  statLabel: { fontSize: 14, color: Colors.textSecondary },

  engagementCard: { borderRadius: 16, overflow: 'hidden' },
  engagementGradient: { padding: 24 },
  engagementContent: { alignItems: 'center' },
  engagementValue: { fontSize: 48, fontWeight: 'bold', color: '#fff' },
  engagementLabel: { fontSize: 18, color: 'rgba(255,255,255,0.9)', marginTop: 8 },
  engagementMeta: { marginTop: 16 },
  engagementMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  engagementMetaText: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  contentCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
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
  contentRankText: { fontSize: 16, fontWeight: 'bold', color: Colors.primary },
  contentInfo: { flex: 1, gap: 8 },
  contentText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  contentStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  contentStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contentStatText: { fontSize: 12, color: Colors.textSecondary },

  contentScore: { alignItems: 'center' },
  contentScoreText: { fontSize: 20, fontWeight: 'bold', color: Colors.success },
  contentScoreLabel: { fontSize: 10, color: Colors.textSecondary },

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
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  insightText: { fontSize: 14, color: Colors.textSecondary },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
});
