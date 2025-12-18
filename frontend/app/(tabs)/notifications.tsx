import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';

interface Notification {
  notification_id: string;
  type: string;
  content: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Load notifications error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error("Mark all read error:", error);
    }
  };

  const handleOpenNotification = async (n: Notification) => {
    // Optimistic mark read
    setNotifications(prev =>
      prev.map(x => (x.notification_id === n.notification_id ? { ...x, read: true } : x))
    );

    // Tell backend this one is read
    api.markNotificationRead?.(n.notification_id).catch(() => {});

    // Route by type
    if (n.type === "message") return router.push("/(tabs)/messages");
    if (n.type === "follow") return router.push("/(tabs)/profile");
    // Add more routes as needed:
    // if (n.post_id) return router.push({ pathname: "/post/[id]", params: { id: n.post_id } });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
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
      default:
        return { name: 'notifications', color: '#FBBF24' };
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item.type);

    return (
      <View style={[styles.notificationCard, !item.read && styles.unreadCard]}>
        <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
          <Ionicons name={icon.name as any} size={24} color={icon.color} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationText}>{item.content}</Text>
          <Text style={styles.notificationTime}>
            {new Date(item.created_at).toLocaleString()}
          </Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {notifications.some(n => !n.read) && (
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

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.notification_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>We'll notify you when something happens</Text>
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
    paddingTop: 60,
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
  list: {
    padding: 16,
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