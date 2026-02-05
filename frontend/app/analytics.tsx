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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#0EA5E9',
};

// Simple mini chart component
const MiniChart = ({ data, color, height = 60 }: { data: number[], color: string, height?: number }) => {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data, 1);
  const chartWidth = SCREEN_WIDTH - 80;
  const barWidth = chartWidth / data.length - 4;
  
  return (
    <View style={[styles.miniChart, { height }]}>
      {data.map((value, index) => (
        <View
          key={index}
          style={[
            styles.miniChartBar,
            {
              width: barWidth,
              height: Math.max(4, (value / max) * height),
              backgroundColor: color,
              opacity: 0.3 + (index / data.length) * 0.7,
            }
          ]}
        />
      ))}
    </View>
  );
};

// Stat Card Component
const StatCard = ({ 
  icon, 
  value, 
  label, 
  change, 
  color,
  onPress 
}: { 
  icon: string, 
  value: string | number, 
  label: string, 
  change?: number,
  color: string,
  onPress?: () => void
}) => (
  <TouchableOpacity 
    style={[styles.statCard, { borderLeftColor: color }]} 
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={[styles.statIconBg, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon as any} size={24} color={color} />
    </View>
    <View style={styles.statInfo}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
    {change !== undefined && (
      <View style={[styles.statChange, { backgroundColor: change >= 0 ? Colors.success + '20' : Colors.danger + '20' }]}>
        <Ionicons 
          name={change >= 0 ? 'trending-up' : 'trending-down'} 
          size={14} 
          color={change >= 0 ? Colors.success : Colors.danger} 
        />
        <Text style={[styles.statChangeText, { color: change >= 0 ? Colors.success : Colors.danger }]}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

// Revenue Card Component
const RevenueCard = ({ revenue, tips, sales }: { revenue: number, tips: number, sales: number }) => (
  <LinearGradient
    colors={['#059669', '#10B981', '#34D399']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.revenueCard}
  >
    <View style={styles.revenueHeader}>
      <View style={styles.revenueIconBg}>
        <Ionicons name="cash" size={28} color="#fff" />
      </View>
      <View>
        <Text style={styles.revenueLabel}>Total Revenue</Text>
        <Text style={styles.revenueValue}>${revenue.toFixed(2)}</Text>
      </View>
    </View>
    
    <View style={styles.revenueBreakdown}>
      <View style={styles.revenueItem}>
        <Ionicons name="gift" size={18} color="rgba(255,255,255,0.8)" />
        <Text style={styles.revenueItemLabel}>Tips</Text>
        <Text style={styles.revenueItemValue}>${tips.toFixed(2)}</Text>
      </View>
      <View style={styles.revenueDivider} />
      <View style={styles.revenueItem}>
        <Ionicons name="cart" size={18} color="rgba(255,255,255,0.8)" />
        <Text style={styles.revenueItemLabel}>Sales</Text>
        <Text style={styles.revenueItemValue}>${sales.toFixed(2)}</Text>
      </View>
    </View>
  </LinearGradient>
);

// Follower Growth Chart
const FollowerGrowthChart = ({ data }: { data: Array<{ date: string, new_followers: number }> }) => {
  if (!data || data.length === 0) return null;
  
  const chartData = data.map(d => d.new_followers);
  const total = chartData.reduce((a, b) => a + b, 0);
  const max = Math.max(...chartData, 1);
  
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Follower Growth</Text>
        <View style={styles.chartBadge}>
          <Ionicons name="arrow-up" size={14} color={Colors.success} />
          <Text style={styles.chartBadgeText}>+{total} this week</Text>
        </View>
      </View>
      
      <View style={styles.barChart}>
        {data.map((item, index) => {
          const barHeight = Math.max(8, (item.new_followers / max) * 100);
          const dayName = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' });
          
          return (
            <View key={index} style={styles.barContainer}>
              <Text style={styles.barValue}>{item.new_followers}</Text>
              <View style={styles.barWrapper}>
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  style={[styles.bar, { height: barHeight }]}
                />
              </View>
              <Text style={styles.barLabel}>{dayName}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Top Post Card
const TopPostCard = ({ post, rank }: { post: any, rank: number }) => (
  <TouchableOpacity 
    style={styles.topPostCard}
    onPress={() => post.post_id && router.push(`/post/${post.post_id}`)}
    activeOpacity={0.8}
  >
    <View style={[styles.rankBadge, { backgroundColor: rank === 1 ? Colors.warning : rank === 2 ? Colors.textSecondary : '#CD7F32' }]}>
      <Text style={styles.rankText}>#{rank}</Text>
    </View>
    
    <View style={styles.topPostInfo}>
      <Text style={styles.topPostContent} numberOfLines={2}>
        {post.content || 'Media post'}
      </Text>
      <View style={styles.topPostStats}>
        <View style={styles.topPostStat}>
          <Ionicons name="heart" size={14} color={Colors.secondary} />
          <Text style={styles.topPostStatText}>{post.likes_count || 0}</Text>
        </View>
        <View style={styles.topPostStat}>
          <Ionicons name="chatbubble" size={14} color={Colors.info} />
          <Text style={styles.topPostStatText}>{post.comments_count || 0}</Text>
        </View>
        <View style={styles.topPostStat}>
          <Ionicons name="repeat" size={14} color={Colors.success} />
          <Text style={styles.topPostStatText}>{post.repost_count || 0}</Text>
        </View>
      </View>
    </View>
    
    <View style={styles.topPostScore}>
      <Text style={styles.topPostScoreValue}>{post.engagement_score || 0}</Text>
      <Text style={styles.topPostScoreLabel}>Score</Text>
    </View>
  </TouchableOpacity>
);

// Time Period Selector
const TimePeriodSelector = ({ selected, onSelect }: { selected: string, onSelect: (period: string) => void }) => {
  const periods = ['7D', '30D', '90D', 'ALL'];
  
  return (
    <View style={styles.periodSelector}>
      {periods.map((period) => (
        <TouchableOpacity
          key={period}
          style={[styles.periodButton, selected === period && styles.periodButtonActive]}
          onPress={() => onSelect(period)}
        >
          <Text style={[styles.periodButtonText, selected === period && styles.periodButtonTextActive]}>
            {period}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState('7D');
  
  // Analytics data
  const [overview, setOverview] = useState<any>(null);
  const [contentPerformance, setContentPerformance] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState({ total: 0, tips: 0, sales: 0 });
  const [engagementData, setEngagementData] = useState<any>(null);
  const [demographics, setDemographics] = useState<any>(null);

  const formatNumber = useCallback((n: any) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  }, []);

  const loadAnalytics = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    
    try {
      const [overviewRes, performanceRes, revenueRes, engagementRes, demographicsRes] = await Promise.allSettled([
        api.getAnalyticsOverview(),
        api.getContentPerformance(),
        api.getRevenueAnalytics(),
        api.getEngagementAnalytics(),
        api.getAudienceDemographics(),
      ]);
      
      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value);
      }
      
      if (performanceRes.status === 'fulfilled' && Array.isArray(performanceRes.value)) {
        setContentPerformance(performanceRes.value.slice(0, 5));
      }
      
      if (revenueRes.status === 'fulfilled') {
        const rev = revenueRes.value;
        setRevenueData({
          total: rev?.total_revenue || rev?.total || 0,
          tips: rev?.tips || 0,
          sales: rev?.sales || 0,
        });
      }
      
      if (engagementRes.status === 'fulfilled') {
        setEngagementData(engagementRes.value);
      }
      
      if (demographicsRes.status === 'fulfilled') {
        setDemographics(demographicsRes.value);
      }
    } catch (error) {
      console.error('Analytics load error:', error);
      Alert.alert('Error', 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAnalytics(false);
  }, [loadAnalytics]);

  // Calculated metrics
  const engagementRate = useMemo(() => {
    if (!overview) return 0;
    const totalInteractions = (overview.total_reactions || 0) + (overview.total_comments || 0);
    const totalViews = overview.total_views || 1;
    return ((totalInteractions / totalViews) * 100).toFixed(1);
  }, [overview]);

  const followerGrowth = useMemo(() => {
    return overview?.follower_growth || [];
  }, [overview]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Time Period Selector */}
        <TimePeriodSelector selected={timePeriod} onSelect={setTimePeriod} />

        {/* Revenue Card */}
        <View style={styles.section}>
          <RevenueCard 
            revenue={revenueData.total} 
            tips={revenueData.tips} 
            sales={revenueData.sales} 
          />
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="document-text"
              value={formatNumber(overview?.total_posts)}
              label="Total Posts"
              color={Colors.primary}
            />
            <StatCard
              icon="people"
              value={formatNumber(overview?.total_followers)}
              label="Followers"
              change={overview?.follower_change}
              color={Colors.success}
            />
            <StatCard
              icon="heart"
              value={formatNumber(overview?.total_reactions)}
              label="Reactions"
              color={Colors.secondary}
            />
            <StatCard
              icon="pulse"
              value={`${engagementRate}%`}
              label="Engagement"
              color={Colors.info}
            />
          </View>
        </View>

        {/* Follower Growth Chart */}
        <View style={styles.section}>
          <FollowerGrowthChart data={followerGrowth} />
        </View>

        {/* Engagement Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Engagement Breakdown</Text>
          <View style={styles.engagementGrid}>
            <View style={styles.engagementItem}>
              <View style={[styles.engagementDot, { backgroundColor: Colors.secondary }]} />
              <Text style={styles.engagementLabel}>Likes</Text>
              <Text style={styles.engagementValue}>{formatNumber(engagementData?.likes || overview?.total_reactions || 0)}</Text>
            </View>
            <View style={styles.engagementItem}>
              <View style={[styles.engagementDot, { backgroundColor: Colors.info }]} />
              <Text style={styles.engagementLabel}>Comments</Text>
              <Text style={styles.engagementValue}>{formatNumber(engagementData?.comments || 0)}</Text>
            </View>
            <View style={styles.engagementItem}>
              <View style={[styles.engagementDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.engagementLabel}>Shares</Text>
              <Text style={styles.engagementValue}>{formatNumber(engagementData?.shares || 0)}</Text>
            </View>
            <View style={styles.engagementItem}>
              <View style={[styles.engagementDot, { backgroundColor: Colors.warning }]} />
              <Text style={styles.engagementLabel}>Saves</Text>
              <Text style={styles.engagementValue}>{formatNumber(engagementData?.saves || 0)}</Text>
            </View>
          </View>
        </View>

        {/* Top Performing Content */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Performing Posts</Text>
            <TouchableOpacity onPress={() => router.push('/profile')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {contentPerformance.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bar-chart-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Create content to see performance</Text>
            </View>
          ) : (
            contentPerformance.map((post, index) => (
              <TopPostCard key={post.post_id || index} post={post} rank={index + 1} />
            ))
          )}
        </View>

        {/* Audience Demographics */}
        {demographics && demographics.total_followers > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Audience Demographics</Text>
            
            {/* Age Groups */}
            <View style={styles.demographicsCard}>
              <Text style={styles.demographicsSubtitle}>Age Distribution</Text>
              <View style={styles.ageGroups}>
                {Object.entries(demographics.age_groups || {}).map(([ageRange, count]: [string, any]) => {
                  const percentage = demographics.total_followers > 0 
                    ? ((count / demographics.total_followers) * 100).toFixed(0)
                    : 0;
                  return (
                    <View key={ageRange} style={styles.ageGroupItem}>
                      <Text style={styles.ageGroupLabel}>{ageRange}</Text>
                      <View style={styles.ageGroupBar}>
                        <View 
                          style={[
                            styles.ageGroupFill, 
                            { width: `${percentage}%`, backgroundColor: Colors.primary }
                          ]} 
                        />
                      </View>
                      <Text style={styles.ageGroupValue}>{percentage}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Top Locations */}
            {demographics.top_locations && demographics.top_locations.length > 0 && (
              <View style={styles.demographicsCard}>
                <Text style={styles.demographicsSubtitle}>Top Locations</Text>
                {demographics.top_locations.slice(0, 5).map((location: any, index: number) => (
                  <View key={index} style={styles.locationItem}>
                    <Ionicons name="location" size={16} color={Colors.primary} />
                    <Text style={styles.locationName}>{location.location}</Text>
                    <Text style={styles.locationPercentage}>{location.percentage}%</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Gender Distribution */}
            {demographics.gender_distribution && (
              <View style={styles.demographicsCard}>
                <Text style={styles.demographicsSubtitle}>Gender Distribution</Text>
                <View style={styles.genderGrid}>
                  {Object.entries(demographics.gender_distribution).map(([gender, count]: [string, any]) => {
                    const percentage = demographics.total_followers > 0
                      ? ((count / demographics.total_followers) * 100).toFixed(0)
                      : 0;
                    return (
                      <View key={gender} style={styles.genderItem}>
                        <Text style={styles.genderPercentage}>{percentage}%</Text>
                        <Text style={styles.genderLabel}>
                          {gender.charAt(0).toUpperCase() + gender.slice(1)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights & Tips</Text>
          
          <View style={styles.insightCard}>
            <LinearGradient
              colors={[Colors.primary + '30', Colors.secondary + '30']}
              style={styles.insightGradient}
            >
              <Ionicons name="bulb" size={24} color={Colors.warning} />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Best Time to Post</Text>
                <Text style={styles.insightText}>Your audience is most active on weekdays between 6-9 PM</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.insightCard}>
            <LinearGradient
              colors={[Colors.success + '30', Colors.info + '30']}
              style={styles.insightGradient}
            >
              <Ionicons name="trending-up" size={24} color={Colors.success} />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Growing Content</Text>
                <Text style={styles.insightText}>Videos are getting 2.5x more engagement than photos</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.insightCard}>
            <LinearGradient
              colors={[Colors.warning + '30', Colors.danger + '30']}
              style={styles.insightGradient}
            >
              <Ionicons name="people" size={24} color={Colors.info} />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Audience Demographics</Text>
                <Text style={styles.insightText}>65% of your followers are aged 18-34</Text>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 100 }} />
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  content: {
    flex: 1,
  },
  
  // Time Period Selector
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  
  // Section
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
  },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statInfo: {
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statChange: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statChangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Revenue Card
  revenueCard: {
    borderRadius: 20,
    padding: 20,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  revenueIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revenueLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  revenueBreakdown: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  revenueItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  revenueDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  revenueItemLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  revenueItemValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  // Chart Card
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  chartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  chartBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  
  // Bar Chart
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  barWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
    paddingHorizontal: 4,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 8,
  },
  barLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  
  // Mini Chart
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  miniChartBar: {
    borderRadius: 2,
  },
  
  // Engagement Grid
  engagementGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  engagementItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  engagementDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  engagementLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  engagementValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  
  // Top Post Card
  topPostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  topPostInfo: {
    flex: 1,
    gap: 8,
  },
  topPostContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  topPostStats: {
    flexDirection: 'row',
    gap: 16,
  },
  topPostStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topPostStatText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  topPostScore: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  topPostScoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.success,
  },
  topPostScoreLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  
  // Demographics
  demographicsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  demographicsSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  ageGroups: {
    gap: 12,
  },
  ageGroupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ageGroupLabel: {
    fontSize: 13,
    color: Colors.text,
    width: 60,
  },
  ageGroupBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ageGroupFill: {
    height: '100%',
    borderRadius: 4,
  },
  ageGroupValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    width: 40,
    textAlign: 'right',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  locationName: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  locationPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  genderGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  genderItem: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  genderPercentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  genderLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  
  // Insight Card
  insightCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  insightGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  insightText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});
