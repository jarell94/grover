import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 40) / 3;

const Colors = {
  primary: '#8B5CF6',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: 'rgba(255,255,255,0.1)',
};

interface ArchivedStory {
  archive_id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url?: string;
  caption?: string;
  views_count: number;
  reactions_count: number;
  original_created_at: string;
  archived_at: string;
}

export default function StoryArchiveScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [archives, setArchives] = useState<ArchivedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async (skip = 0) => {
    try {
      if (skip === 0) setLoading(true);
      const response = await api.getArchivedStories(20, skip);
      
      if (skip === 0) {
        setArchives(response.archives);
      } else {
        setArchives((prev) => [...prev, ...response.archives]);
      }
      
      setHasMore(response.has_more);
    } catch (error) {
      console.error('Failed to load archives:', error);
      Alert.alert('Error', 'Failed to load archived stories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadArchives(0);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadArchives(archives.length);
    }
  };

  const handleRestore = (archiveId: string) => {
    Alert.alert(
      'Restore Story',
      'This will post the story again for 24 hours. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              await api.restoreArchivedStory(archiveId);
              Alert.alert('Success', 'Story restored successfully');
              loadArchives(0);
            } catch (error) {
              console.error('Failed to restore story:', error);
              Alert.alert('Error', 'Failed to restore story');
            }
          },
        },
      ]
    );
  };

  const handleDelete = (archiveId: string) => {
    Alert.alert(
      'Delete Archive',
      'Are you sure you want to permanently delete this archived story?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteArchivedStory(archiveId);
              setArchives((prev) => prev.filter((a) => a.archive_id !== archiveId));
              Alert.alert('Success', 'Archived story deleted');
            } catch (error) {
              console.error('Failed to delete archive:', error);
              Alert.alert('Error', 'Failed to delete archive');
            }
          },
        },
      ]
    );
  };

  const renderArchiveItem = ({ item }: { item: ArchivedStory }) => (
    <TouchableOpacity
      style={styles.archiveItem}
      onLongPress={() => {
        Alert.alert('Story Options', '', [
          { text: 'Restore Story', onPress: () => handleRestore(item.archive_id) },
          { text: 'Delete Archive', style: 'destructive', onPress: () => handleDelete(item.archive_id) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }}
    >
      {item.media_type === 'video' ? (
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: item.thumbnail_url || item.media_url }}
            style={styles.thumbnail}
          />
          <View style={styles.videoIcon}>
            <Ionicons name="play-circle" size={24} color="#fff" />
          </View>
        </View>
      ) : (
        <Image source={{ uri: item.media_url }} style={styles.thumbnail} />
      )}
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="eye" size={12} color={Colors.textSecondary} />
          <Text style={styles.statText}>{item.views_count}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="heart" size={12} color={Colors.textSecondary} />
          <Text style={styles.statText}>{item.reactions_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && archives.length === 0) {
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
        <Text style={styles.headerTitle}>Story Archive</Text>
        <View style={{ width: 40 }} />
      </View>

      {archives.length === 0 ? (
        <View style={[styles.centerContent, { flex: 1 }]}>
          <Ionicons name="archive-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No archived stories</Text>
          <Text style={styles.emptySubtext}>
            Archived stories will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={archives}
          keyExtractor={(item) => item.archive_id}
          renderItem={renderArchiveItem}
          numColumns={3}
          contentContainerStyle={styles.grid}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && archives.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : null
          }
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
  grid: {
    padding: 8,
  },
  archiveItem: {
    width: ITEM_WIDTH,
    margin: 4,
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  videoIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 10,
    color: Colors.textSecondary,
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
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
