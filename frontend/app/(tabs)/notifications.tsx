import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';

const PAGE_SIZE = 50;

interface Notification {
  notification_id: string;
  type: string;
  content: string;
  read: boolean;
  created_at: string;
  related_id?: string;
  from_user_id?: string;
  post_id?: string;
  comment_id?: string;
  product_id?: string;
  order_id?: string;
}

interface Section {
  title: string;
  data: Notification[];
}

// ==================== Helpers ====================

const timeAgo = (iso: string) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
};

const isToday = (date: Date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const isThisWeek = (date: Date) => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo && !isToday(date);
};

const groupNotifications = (notifications: Notification[]): Section[] => {
  const today: Notification[] = [];
  const thisWeek: Notification[] = [];
  const earlier: Notification[] = [];

  for (const n of notifications) {
    const date = new Date(n.created_at);
    if (isToday(date)) {
      today.push(n);
    } else if (isThisWeek(date)) {
      thisWeek.push(n);
    } else {
      earlier.push(n);
    }
  }

  const sections: Section[] = [];
  if (today.length > 0) sections.push({ title: 'Today', data: today });
  if (thisWeek.length > 0) sections.push({ title: 'This Week', data: thisWeek });
  if (earlier.length > 0) sections.push({ title: 'Earlier', data: earlier });

  return sections;
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'like':
    case 'comment_like':
      return { name: 'heart', color: '#EF4444' };
    case 'follow':
      return { name: 'person-add', color: '#8B5CF6' };
    case 'comment':
    case 'reply':
      return { name: 'chatbubble', color: '#3B82F6' };
    case 'message':
      return { name: 'mail', color: '#EC4899' };
    case 'sale':
    case 'purchase':
      return { name: 'cash', color: '#10B981' };
    case 'mention':
    case 'tag':
      return { name: 'at', color: '#F59E0B' };
    case 'repost':
    case 'share':
      return { name: 'repeat', color: '#8B5CF6' };
    case 'order':
      return { name: 'bag-check', color: '#10B981' };
    case 'stream':
    case 'live':
      return { name: 'videocam', color: '#EF4444' };
    default:
      return { name: 'notifications', color: '#FBBF24' };
  }
};

// ==================== Routing Map ====================

const routeNotification = (n: Notification) => {
  // Route based on notification type and available IDs
  switch (n.type) {
    case 'like':
    case 'comment':
    case 'reply':
    case 'mention':
    case 'tag':
    case 'repost':
    case 'share':
      // These are post-related
      if (n.related_id || n.post_id) {
        return router.push(`/post/${n.related_id || n.post_id}`);
      }
      break;

    case 'comment_like':
      // Could go to post with comment highlighted
      if (n.related_id || n.post_id) {
        return router.push(`/post/${n.related_id || n.post_id}`);
      }
      break;

    case 'follow':
      // Go to the follower's profile or own profile
      if (n.from_user_id) {
        return router.push(`/user/${n.from_user_id}`);
      }
      return router.push('/(tabs)/profile');

    case 'message':
      // Go to messages tab
      return router.push('/(tabs)/messages');

    case 'sale':
    case 'purchase':
    case 'order':
      // Go to store or order details
      if (n.order_id) {
        return router.push(`/order/${n.order_id}`);
      }
      return router.push('/(tabs)/store');

    case 'stream':
    case 'live':
      // Go to live stream
      if (n.related_id) {
        return router.push(`/live-stream/${n.related_id}`);
      }
      break;

    default:
      // Fallback: if there's a related_id, try to open as post
      if (n.related_id) {
        return router.push(`/post/${n.related_id}`);
      }
  }
};

// ==================== Component ====================

// Notification type filter options
const FILTER_OPTIONS = [
  { key: 'all', label: 'All', icon: 'notifications' },
  { key: 'like', label: 'Likes', icon: 'heart' },
  { key: 'comment', label: 'Comments', icon: 'chatbubble' },
  { key: 'follow', label: 'Follows', icon: 'person-add' },
  { key: 'sale', label: 'Sales', icon: 'cash' },
  { key: 'mention', label: 'Mentions', icon: 'at' },
] as const;

type FilterKey = typeof FILTER_OPTIONS[number]['key'];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<FilterKey>('all');
  
  const skipRef = useRef(0);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    const skip = isRefresh ? 0 : skipRef.current;
    const filterType = typeFilter === 'all' ? undefined : typeFilter;
    
    try {
      const response = await api.getNotifications(PAGE_SIZE, skip, unreadOnly, filterType);
      const newNotifications = response?.notifications || [];
      
      if (isRefresh) {
        setNotifications(newNotifications);
        skipRef.current = PAGE_SIZE;
      } else {
        setNotifications((prev) => [...prev, ...newNotifications]);
        skipRef.current += PAGE_SIZE;
      }
      
      setHasMore(response?.has_more ?? newNotifications.length === PAGE_SIZE);
    } catch (error) {
      if (__DEV__) console.error('Load notifications error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [unreadOnly, typeFilter]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      skipRef.current = 0;
      loadNotifications(true);
    }, [unreadOnly, typeFilter])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    skipRef.current = 0;
    loadNotifications(true);
  }, [loadNotifications]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadNotifications(false);
  }, [loadingMore, hasMore, loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.markNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      if (__DEV__) console.error("Mark all read error:", error);
    }
  }, []);

  const handleOpenNotification = useCallback(async (n: Notification) => {
    // Optimistic mark read
    setNotifications((prev) =>
      prev.map((x) => (x.notification_id === n.notification_id ? { ...x, read: true } : x))
    );

    // Tell backend this one is read
    try {
      await api.markNotificationRead(n.notification_id);
    } catch (e) {
      // Ignore errors
    }

    // Route to appropriate screen
    routeNotification(n);
  }, []);

  const handleToggleFilter = useCallback(() => {
    setUnreadOnly((prev) => !prev);
    setLoading(true);
    skipRef.current = 0;
  }, []);

  const handleTypeFilterChange = useCallback((filterKey: FilterKey) => {
    if (filterKey === typeFilter) return;
    setTypeFilter(filterKey);
    setLoading(true);
    skipRef.current = 0;
  }, [typeFilter]);

  const sections = useMemo(() => groupNotifications(notifications), [notifications]);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item.type);

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.read && styles.unreadCard]}
        activeOpacity={0.85}
        onPress={() => handleOpenNotification(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
          <Ionicons name={icon.name as any} size={24} color={icon.color} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationText}>{item.content}</Text>
          <Text style={styles.notificationTime}>{timeAgo(item.created_at)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllRead}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push('/notification-settings')}
          >
            <Ionicons name="settings-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        {/* Unread Toggle */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !unreadOnly && styles.filterChipActive]}
            onPress={() => unreadOnly && handleToggleFilter()}
          >
            <Text style={[styles.filterChipText, !unreadOnly && styles.filterChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, unreadOnly && styles.filterChipActive]}
            onPress={() => !unreadOnly && handleToggleFilter()}
          >
            <Text style={[styles.filterChipText, unreadOnly && styles.filterChipTextActive]}>
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Type Filter Chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.typeFilterScroll}
          contentContainerStyle={styles.typeFilterContent}
        >
          {FILTER_OPTIONS.map((option) => {
            const isActive = typeFilter === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.typeFilterChip, isActive && styles.typeFilterChipActive]}
                onPress={() => handleTypeFilterChange(option.key)}
              >
                <Ionicons 
                  name={option.icon as any} 
                  size={16} 
                  color={isActive ? '#fff' : Colors.textSecondary} 
                />
                <Text style={[styles.typeFilterText, isActive && styles.typeFilterTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderNotification}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.notification_id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>
              {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {unreadOnly
                ? "You are all caught up!"
                : "We will notify you when something happens"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  filterSection: {
    backgroundColor: Colors.background,
    paddingBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  typeFilterScroll: {
    flexGrow: 0,
  },
  typeFilterContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexDirection: 'row',
  },
  typeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeFilterText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  typeFilterTextActive: {
    color: '#fff',
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unreadCard: {
    backgroundColor: `${Colors.primary}10`,
    borderColor: Colors.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
