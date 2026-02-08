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
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 40) / 2;

const Colors = {
  primary: '#8B5CF6',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: 'rgba(255,255,255,0.1)',
};

interface StoryDraft {
  draft_id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url?: string;
  caption?: string;
  music_title?: string;
  music_artist?: string;
  created_at: string;
  updated_at: string;
}

export default function StoryDraftsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<StoryDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const response = await api.getStoryDrafts();
      setDrafts(response.drafts);
    } catch (error) {
      console.error('Failed to load drafts:', error);
      Alert.alert('Error', 'Failed to load story drafts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDrafts();
  };

  const handlePublish = (draftId: string) => {
    Alert.alert(
      'Publish Draft',
      'This will publish the story for 24 hours. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            try {
              await api.publishStoryDraft(draftId);
              Alert.alert('Success', 'Story published successfully');
              loadDrafts();
            } catch (error) {
              console.error('Failed to publish draft:', error);
              Alert.alert('Error', 'Failed to publish story');
            }
          },
        },
      ]
    );
  };

  const handleDelete = (draftId: string) => {
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteStoryDraft(draftId);
              setDrafts((prev) => prev.filter((d) => d.draft_id !== draftId));
              Alert.alert('Success', 'Draft deleted');
            } catch (error) {
              console.error('Failed to delete draft:', error);
              Alert.alert('Error', 'Failed to delete draft');
            }
          },
        },
      ]
    );
  };

  const renderDraftItem = ({ item }: { item: StoryDraft }) => (
    <TouchableOpacity
      style={styles.draftItem}
      onLongPress={() => {
        Alert.alert('Draft Options', '', [
          { text: 'Publish Now', onPress: () => handlePublish(item.draft_id) },
          { text: 'Delete Draft', style: 'destructive', onPress: () => handleDelete(item.draft_id) },
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
            <Ionicons name="play-circle" size={32} color="#fff" />
          </View>
        </View>
      ) : (
        <Image source={{ uri: item.media_url }} style={styles.thumbnail} />
      )}
      
      <View style={styles.draftInfo}>
        {item.caption && (
          <Text style={styles.caption} numberOfLines={2}>
            {item.caption}
          </Text>
        )}
        {item.music_title && (
          <View style={styles.musicInfo}>
            <Ionicons name="musical-notes" size={12} color={Colors.textSecondary} />
            <Text style={styles.musicText} numberOfLines={1}>
              {item.music_title}
            </Text>
          </View>
        )}
        <Text style={styles.dateText}>
          {new Date(item.updated_at).toLocaleDateString()}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.publishButton}
        onPress={() => handlePublish(item.draft_id)}
      >
        <Ionicons name="send" size={20} color={Colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading && drafts.length === 0) {
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
        <Text style={styles.headerTitle}>Story Drafts</Text>
        <View style={styles.draftCount}>
          <Text style={styles.draftCountText}>{drafts.length}</Text>
        </View>
      </View>

      {drafts.length === 0 ? (
        <View style={[styles.centerContent, { flex: 1 }]}>
          <Ionicons name="document-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No story drafts</Text>
          <Text style={styles.emptySubtext}>
            Save stories as drafts to publish later
          </Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(item) => item.draft_id}
          renderItem={renderDraftItem}
          numColumns={2}
          contentContainerStyle={styles.grid}
          onRefresh={handleRefresh}
          refreshing={refreshing}
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
  draftCount: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  draftCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  grid: {
    padding: 8,
  },
  draftItem: {
    width: ITEM_WIDTH,
    margin: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: Colors.card,
  },
  videoIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  draftInfo: {
    padding: 12,
  },
  caption: {
    fontSize: 12,
    color: Colors.text,
    marginBottom: 4,
  },
  musicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  musicText: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  dateText: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  publishButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: Colors.background,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
