import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  RefreshControl,
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

// Demographics Pie Chart Component
const DemographicsChart = ({ data, title, colors }: { 
  data: { [key: string]: number }, 
  title: string,
  colors: string[]
}) => {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const entries = Object.entries(data).map(([key, value], index) => ({
    label: key,
    value,
    percentage: ((value / total) * 100).toFixed(1),
    color: colors[index % colors.length]
  }));

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      
      {/* Legend */}
      <View style={styles.legend}>
        {entries.map((entry, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: entry.color }]} />
            <Text style={styles.legendLabel}>{entry.label}</Text>
            <View style={styles.legendSpacer} />
            <Text style={styles.legendValue}>{entry.value}</Text>
            <Text style={styles.legendPercentage}>({entry.percentage}%)</Text>
          </View>
        ))}
      </View>

      {/* Simple Bar Visualization */}
      <View style={styles.barVisualization}>
        {entries.map((entry, index) => (
          <View 
            key={index} 
            style={[
              styles.barSegment,
              { 
                width: `${entry.percentage}%`,
                backgroundColor: entry.color
              }
            ]}
          />
        ))}
      </View>
    </View>
  );
};

// Activity Heatmap Component
const ActivityHeatmap = ({ hourlyData, dailyData }: { 
  hourlyData: Array<{ hour: number, engagement: number }>,
  dailyData: Array<{ day: string, engagement: number }>
}) => {
  if (!hourlyData || hourlyData.length === 0) return null;

  const maxHourly = Math.max(...hourlyData.map(h => h.engagement), 1);
  const maxDaily = Math.max(...dailyData.map(d => d.engagement), 1);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Activity Patterns</Text>

      {/* Daily Activity */}
      <View style={styles.heatmapSection}>
        <Text style={styles.heatmapSubtitle}>Day of Week</Text>
        <View style={styles.dailyBars}>
          {dailyData.map((day, index) => {
            const intensity = day.engagement / maxDaily;
            const barHeight = Math.max(4, intensity * 60);
            
            return (
              <View key={index} style={styles.dailyBarContainer}>
                <Text style={styles.dailyValue}>{day.engagement}</Text>
                <View style={styles.dailyBarWrapper}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    style={[styles.dailyBar, { height: barHeight }]}
                  />
                </View>
                <Text style={styles.dailyLabel}>{day.day.slice(0, 3)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Hourly Activity */}
      <View style={styles.heatmapSection}>
        <Text style={styles.heatmapSubtitle}>Hour of Day (UTC)</Text>
        <View style={styles.hourlyGrid}>
          {hourlyData.map((hour, index) => {
            const intensity = hour.engagement / maxHourly;
            const opacity = 0.2 + (intensity * 0.8);
            
            return (
              <View key={index} style={styles.hourlyCell}>
                <View 
                  style={[
                    styles.hourlyBox,
                    { 
                      backgroundColor: Colors.primary,
                      opacity: opacity
                    }
                  ]}
                />
                {hour.hour % 3 === 0 && (
                  <Text style={styles.hourlyLabel}>{hour.hour}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

// Best Time Card Component
const BestTimeCard = ({ bestTime, peakHours, peakDays }: {
  bestTime: string,
  peakHours: number[],
  peakDays: string[]
}) => (
  <LinearGradient
    colors={[Colors.success, '#10B981', '#34D399']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.bestTimeCard}
  >
    <View style={styles.bestTimeHeader}>
      <View style={styles.bestTimeIconBg}>
        <Ionicons name="time" size={28} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bestTimeLabel}>Best Time to Post</Text>
        <Text style={styles.bestTimeValue}>{bestTime}</Text>
      </View>
    </View>

    <View style={styles.bestTimeDetails}>
      <View style={styles.bestTimeDetailItem}>
        <Ionicons name="sunny" size={18} color="rgba(255,255,255,0.9)" />
        <Text style={styles.bestTimeDetailLabel}>Peak Hours</Text>
        <Text style={styles.bestTimeDetailValue}>
          {peakHours.length > 0 ? peakHours.join(':00, ') + ':00' : 'N/A'}
        </Text>
      </View>
      
      <View style={styles.bestTimeDetailItem}>
        <Ionicons name="calendar" size={18} color="rgba(255,255,255,0.9)" />
        <Text style={styles.bestTimeDetailLabel}>Peak Days</Text>
        <Text style={styles.bestTimeDetailValue}>
          {peakDays.length > 0 ? peakDays.join(', ') : 'N/A'}
        </Text>
      </View>
    </View>
  </LinearGradient>
);

// Location List Component
const LocationList = ({ title, locations, icon }: {
  title: string,
  locations: Array<{ [key: string]: string | number }>,
  icon: string
}) => (
  <View style={styles.chartCard}>
    <View style={styles.locationHeader}>
      <Ionicons name={icon as any} size={20} color={Colors.primary} />
      <Text style={styles.chartTitle}>{title}</Text>
    </View>
    
    {locations.length === 0 ? (
      <Text style={styles.emptyText}>No location data available</Text>
    ) : (
      <View style={styles.locationList}>
        {locations.slice(0, 5).map((location, index) => {
          const locationName = location.country || location.city || 'Unknown';
          const count = location.count as number;
          
          return (
            <View key={index} style={styles.locationItem}>
              <Text style={styles.locationRank}>#{index + 1}</Text>
              <Text style={styles.locationName}>{locationName}</Text>
              <View style={styles.locationSpacer} />
              <Text style={styles.locationCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    )}
  </View>
);

export default function AudienceInsightsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [demographics, setDemographics] = useState<any>(null);
  const [activityTimes, setActivityTimes] = useState<any>(null);
  const [contentTypes, setContentTypes] = useState<any>(null);

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    try {
      const [demoRes, activityRes, contentRes] = await Promise.allSettled([
        api.getAudienceDemographics(),
        api.getActivityTimes(),
        api.getContentTypePerformance(),
      ]);

      if (demoRes.status === 'fulfilled') {
        setDemographics(demoRes.value);
      }

      if (activityRes.status === 'fulfilled') {
        setActivityTimes(activityRes.value);
      }

      if (contentRes.status === 'fulfilled') {
        setContentTypes(contentRes.value);
      }
    } catch (error) {
      console.error('Error loading audience insights:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(false);
  }, [loadData]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading insights...</Text>
      </View>
    );
  }

  const ageColors = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#0EA5E9'];
  const genderColors = ['#3B82F6', '#EC4899', '#A855F7', '#94A3B8'];

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
        <Text style={styles.headerTitle}>Audience Insights</Text>
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
        {/* Overview Stats */}
        <View style={styles.section}>
          <View style={styles.overviewGrid}>
            <View style={[styles.overviewCard, { backgroundColor: Colors.primary + '20', borderLeftColor: Colors.primary }]}>
              <Ionicons name="people" size={32} color={Colors.primary} />
              <Text style={styles.overviewValue}>{demographics?.follower_count || 0}</Text>
              <Text style={styles.overviewLabel}>Followers</Text>
            </View>
            
            <View style={[styles.overviewCard, { backgroundColor: Colors.secondary + '20', borderLeftColor: Colors.secondary }]}>
              <Ionicons name="trophy" size={32} color={Colors.secondary} />
              <Text style={styles.overviewValue}>{demographics?.subscriber_count || 0}</Text>
              <Text style={styles.overviewLabel}>Subscribers</Text>
            </View>
          </View>
        </View>

        {/* Best Time to Post */}
        {activityTimes && (
          <View style={styles.section}>
            <BestTimeCard
              bestTime={activityTimes.best_time_to_post || 'No data yet'}
              peakHours={activityTimes.peak_hours || []}
              peakDays={activityTimes.peak_days || []}
            />
          </View>
        )}

        {/* Age Demographics */}
        {demographics?.age_distribution && Object.keys(demographics.age_distribution).length > 0 && (
          <View style={styles.section}>
            <DemographicsChart
              title="Age Distribution"
              data={demographics.age_distribution}
              colors={ageColors}
            />
          </View>
        )}

        {/* Gender Demographics */}
        {demographics?.gender_distribution && Object.keys(demographics.gender_distribution).length > 0 && (
          <View style={styles.section}>
            <DemographicsChart
              title="Gender Distribution"
              data={demographics.gender_distribution}
              colors={genderColors}
            />
          </View>
        )}

        {/* Activity Heatmap */}
        {activityTimes && (
          <View style={styles.section}>
            <ActivityHeatmap
              hourlyData={activityTimes.hourly_engagement || []}
              dailyData={activityTimes.daily_engagement || []}
            />
          </View>
        )}

        {/* Top Locations */}
        {demographics?.top_countries && demographics.top_countries.length > 0 && (
          <View style={styles.section}>
            <LocationList
              title="Top Countries"
              locations={demographics.top_countries}
              icon="globe"
            />
          </View>
        )}

        {demographics?.top_cities && demographics.top_cities.length > 0 && (
          <View style={styles.section}>
            <LocationList
              title="Top Cities"
              locations={demographics.top_cities}
              icon="location"
            />
          </View>
        )}

        {/* Content Type Performance */}
        {contentTypes?.content_types && contentTypes.content_types.length > 0 && (
          <View style={styles.section}>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Content Performance</Text>
              
              {contentTypes.recommendation && (
                <View style={styles.recommendationBanner}>
                  <Ionicons name="bulb" size={20} color={Colors.warning} />
                  <Text style={styles.recommendationText}>{contentTypes.recommendation}</Text>
                </View>
              )}

              <View style={styles.contentTypeList}>
                {contentTypes.content_types.map((ct: any, index: number) => (
                  <View key={index} style={styles.contentTypeItem}>
                    <View style={styles.contentTypeLeft}>
                      <Ionicons 
                        name={ct.type === 'video' ? 'videocam' : ct.type === 'image' ? 'image' : 'text'} 
                        size={20} 
                        color={Colors.primary} 
                      />
                      <Text style={styles.contentTypeName}>{ct.type}</Text>
                    </View>
                    
                    <View style={styles.contentTypeStats}>
                      <Text style={styles.contentTypeStat}>{ct.total_posts} posts</Text>
                      <Text style={styles.contentTypeAvg}>{ct.avg_engagement.toFixed(1)} avg</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

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

  // Section
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },

  // Overview Grid
  overviewGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderLeftWidth: 4,
  },
  overviewValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 12,
  },
  overviewLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Chart Card
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },

  // Demographics
  legend: {
    gap: 12,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  legendSpacer: {
    flex: 1,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  legendPercentage: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
  },

  // Bar Visualization
  barVisualization: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },

  // Activity Heatmap
  heatmapSection: {
    marginBottom: 20,
  },
  heatmapSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
  },

  // Daily Bars
  dailyBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
  },
  dailyBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  dailyValue: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  dailyBarWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '80%',
  },
  dailyBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  dailyLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 6,
  },

  // Hourly Grid
  hourlyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  hourlyCell: {
    alignItems: 'center',
  },
  hourlyBox: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  hourlyLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Best Time Card
  bestTimeCard: {
    borderRadius: 20,
    padding: 20,
  },
  bestTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  bestTimeIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bestTimeLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  bestTimeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  bestTimeDetails: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  bestTimeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bestTimeDetailLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  bestTimeDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Location List
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  locationList: {
    gap: 12,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    gap: 12,
  },
  locationRank: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  locationName: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  locationSpacer: {
    flex: 1,
  },
  locationCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },

  // Content Type Performance
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  contentTypeList: {
    gap: 12,
  },
  contentTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  contentTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contentTypeName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    textTransform: 'capitalize',
  },
  contentTypeStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  contentTypeStat: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  contentTypeAvg: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },

  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
