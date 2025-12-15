import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';

const { width } = Dimensions.get('window');

interface Post {
  post_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  likes_count: number;
  liked?: boolean;
  user?: any;
}

export default function ExploreScreen() {
  const [activeTab, setActiveTab] = useState('foryou'); // 'foryou', 'trending', 'categories'
  const [posts, setPosts] = useState<Post[]>([]);
  const [trendingData, setTrendingData] = useState({ trending_posts: [], rising_creators: [] });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadContent();
    loadCategories();
  }, [activeTab]);

  const loadContent = async () => {
    try {
      if (activeTab === 'foryou') {
        const data = await api.getForYouFeed();
        setPosts(data);
      } else if (activeTab === 'trending') {
        const data = await api.getTrending();
        setTrendingData(data);
      }
    } catch (error) {
      console.error('Load content error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Categories error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContent();
  };

  const handleLike = async (postId: string) => {
    try {
      const result = await api.likePost(postId);
      setPosts(posts.map(p => 
        p.post_id === postId 
          ? { ...p, liked: result.liked, likes_count: p.likes_count + (result.liked ? 1 : -1) }
          : p
      ));
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity style={styles.gridItem}>
      {item.media_url && item.media_type === 'image' ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.media_url}` }}
          style={styles.gridImage}
        />
      ) : (
        <View style={[styles.gridImage, styles.noImage]}>
          <Text style={styles.noImageText} numberOfLines={3}>{item.content}</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.likeButton}
        onPress={() => handleLike(item.post_id)}
      >
        <Ionicons
          name={item.liked ? 'heart' : 'heart-outline'}
          size={24}
          color={item.liked ? Colors.error : '#fff'}
        />
      </TouchableOpacity>
      <View style={styles.gridOverlay}>
        <Text style={styles.likesText}>{item.likes_count} likes</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search posts and users..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.post_id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No posts found</Text>
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
  searchContainer: {
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    paddingVertical: 12,
  },
  grid: {
    padding: 2,
  },
  gridItem: {
    flex: 1/3,
    aspectRatio: 1,
    margin: 2,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  noImage: {
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  noImageText: {
    color: Colors.text,
    fontSize: 12,
    textAlign: 'center',
  },
  likeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  likesText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    width: '100%',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
});