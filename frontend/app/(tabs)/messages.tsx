import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Safe time ago formatter with proper Date validation
 */
const timeAgo = (iso?: string) => {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
};

interface Conversation {
  conversation_id: string;
  other_user: any;
  last_message: string;
  unread_count: number;
  last_message_at: string;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Load conversations with mode (initial vs refresh)
   */
  const loadConversations = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);

    try {
      const data = await api.getConversations();
      setConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      if (__DEV__) console.error('Load conversations error:', error);
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  };

  // Load on focus with mounted flag
  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const run = async () => {
        try {
          if (mounted) setLoading(true);
          const data = await api.getConversations();
          if (mounted) setConversations(Array.isArray(data) ? data : []);
        } catch (error) {
          if (__DEV__) console.error('Load conversations error:', error);
        } finally {
          if (mounted) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      };

      run();

      return () => {
        mounted = false;
      };
    }, [])
  );

  const onRefresh = () => loadConversations('refresh');

  // Sort conversations by most recent message
  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const ta = Date.parse(a.last_message_at || '') || 0;
      const tb = Date.parse(b.last_message_at || '') || 0;
      return tb - ta;
    });
  }, [conversations]);

  /**
   * Open conversation with optimistic unread reset
   */
  const openConversation = (item: Conversation) => {
    // Optimistically reset unread count
    setConversations(prev =>
      prev.map(c =>
        c.conversation_id === item.conversation_id
          ? { ...c, unread_count: 0 }
          : c
      )
    );

    const other = item.other_user || {};
    router.push({
      pathname: '/chat/[conversationId]',
      params: {
        conversationId: item.conversation_id,
        otherUserId: other.user_id,
        otherUserName: other.name,
      },
    });
  };

  const renderConversation = useCallback(({ item }: { item: Conversation }) => {
    const other = item.other_user || {};
    
    return (
      <TouchableOpacity
        style={styles.conversationCard}
        activeOpacity={0.8}
        onPress={() => openConversation(item)}
      >
        <Image
          source={{ uri: other.picture || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={styles.username}>{other.name || "Unknown"}</Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {!!item.last_message_at && (
                <Text style={styles.timeText}>{timeAgo(item.last_message_at)}</Text>
              )}
              {item.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </View>
              )}
            </View>
          </View>
          <Text 
            style={[
              styles.lastMessage,
              item.unread_count > 0 && styles.lastMessageUnread
            ]} 
            numberOfLines={1}
          >
            {item.last_message || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <Text style={styles.headerTitle}>Messages</Text>
        {sorted.length > 0 && (
          <Text style={styles.headerSubtitle}>{sorted.length} conversation{sorted.length !== 1 ? 's' : ''}</Text>
        )}
      </View>

      <FlatList
        data={sorted}
        renderItem={renderConversation}
        keyExtractor={(item) => item.conversation_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>Start chatting with creators</Text>
          </View>
        }
        removeClippedSubviews
        initialNumToRender={12}
        windowSize={7}
        maxToRenderPerBatch={12}
        keyboardShouldPersistTaps="handled"
      />
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
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  lastMessageUnread: {
    color: Colors.text,
    fontWeight: '500',
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
  },
});
