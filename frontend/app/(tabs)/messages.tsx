import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
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

interface MessageSearchResult {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  other_user?: {
    user_id: string;
    name?: string;
    picture?: string;
  };
}

export default function MessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [senderFilter, setSenderFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const previewValue = Array.isArray(params.preview) ? params.preview[0] : params.preview;
  const previewSearch = __DEV__ && previewValue === 'search';

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

  const runSearch = useCallback(async () => {
    if (previewSearch) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await api.searchMessages({
        query: trimmed,
        senderId: senderFilter.trim() || undefined,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
      });
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (error) {
      if (__DEV__) console.error('Search messages error:', error);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, senderFilter, startDate, endDate]);

  useEffect(() => {
    const handle = setTimeout(() => {
      runSearch();
    }, 300);
    return () => clearTimeout(handle);
  }, [runSearch]);

  useEffect(() => {
    if (!previewSearch) return;
    setSearchQuery('hello');
    setSearchResults([
      {
        message_id: 'preview_msg_1',
        conversation_id: 'conv_preview',
        sender_id: 'user_456',
        content: 'Hello there, this is a preview match.',
        created_at: new Date().toISOString(),
        other_user: { user_id: 'user_456', name: 'Alex', picture: undefined },
      },
      {
        message_id: 'preview_msg_2',
        conversation_id: 'conv_preview',
        sender_id: 'user_123',
        content: 'Another hello for the preview results.',
        created_at: new Date().toISOString(),
        other_user: { user_id: 'user_456', name: 'Alex', picture: undefined },
      },
    ]);
  }, [previewSearch]);

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

  const openSearchResult = (item: MessageSearchResult) => {
    const other = item.other_user || {};
    router.push({
      pathname: '/chat/[conversationId]',
      params: {
        conversationId: item.conversation_id,
        otherUserId: other.user_id,
        otherUserName: other.name,
        focusMessageId: item.message_id,
        highlightTerm: searchQuery.trim(),
      },
    });
  };

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const renderHighlightedText = (text: string, query: string) => {
    if (!query) return <Text style={styles.searchMessageText}>{text}</Text>;
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    const parts = text.split(regex);
    const lower = query.toLowerCase();
    return (
      <Text style={styles.searchMessageText}>
        {parts.map((part, index) =>
          part.toLowerCase() === lower ? (
            <Text key={index} style={styles.searchHighlight}>
              {part}
            </Text>
          ) : (
            part
          )
        )}
      </Text>
    );
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

  const renderSearchResult = ({ item }: { item: MessageSearchResult }) => {
    const other = item.other_user || {};
    return (
      <TouchableOpacity
        style={styles.searchCard}
        activeOpacity={0.8}
        onPress={() => openSearchResult(item)}
      >
        <Image
          source={{ uri: other.picture || 'https://via.placeholder.com/40' }}
          style={styles.searchAvatar}
        />
        <View style={styles.searchInfo}>
          <View style={styles.searchHeader}>
            <Text style={styles.searchTitle}>{other.name || 'Unknown'}</Text>
            <Text style={styles.searchTime}>{timeAgo(item.created_at)}</Text>
          </View>
          {renderHighlightedText(item.content || 'Message', searchQuery.trim())}
        </View>
      </TouchableOpacity>
    );
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
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <Text style={styles.headerTitle}>Messages</Text>
        {sorted.length > 0 && (
          <Text style={styles.headerSubtitle}>{sorted.length} conversation{sorted.length !== 1 ? 's' : ''}</Text>
        )}
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchInputRow}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages"
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styles.searchFilters}>
          <TextInput
            style={styles.filterInput}
            placeholder="Sender ID"
            placeholderTextColor={Colors.textSecondary}
            value={senderFilter}
            onChangeText={setSenderFilter}
          />
          <TextInput
            style={styles.filterInput}
            placeholder="Start date (YYYY-MM-DD)"
            placeholderTextColor={Colors.textSecondary}
            value={startDate}
            onChangeText={setStartDate}
          />
          <TextInput
            style={styles.filterInput}
            placeholder="End date (YYYY-MM-DD)"
            placeholderTextColor={Colors.textSecondary}
            value={endDate}
            onChangeText={setEndDate}
          />
        </View>
      </View>

      {searching && (
        <View style={styles.searchLoading}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.searchLoadingText}>Searching messages...</Text>
        </View>
      )}

      {searchQuery.trim().length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.message_id}
          renderItem={renderSearchResult}
          contentContainerStyle={styles.searchList}
          ListEmptyComponent={
            !searching ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={64} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>No matches found</Text>
              </View>
            ) : null
          }
          keyboardShouldPersistTaps="handled"
        />
      ) : (
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
      )}
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
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
  },
  searchFilters: {
    marginTop: 10,
    gap: 8,
  },
  filterInput: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.text,
    fontSize: 12,
  },
  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchLoadingText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  searchList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  searchInfo: {
    marginLeft: 12,
    flex: 1,
    gap: 4,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchTitle: {
    color: Colors.text,
    fontWeight: '600',
  },
  searchTime: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  searchMessageText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  searchHighlight: {
    color: Colors.text,
    backgroundColor: Colors.primary + '40',
    fontWeight: '700',
  },
});
