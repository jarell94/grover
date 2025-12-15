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

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {[
        { key: 'foryou', label: 'For You', icon: 'heart' },
        { key: 'trending', label: 'Trending', icon: 'trending-up' },
        { key: 'categories', label: 'Categories', icon: 'grid' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.activeTab]}
          onPress={() => setActiveTab(tab.key)}
        >
          <Ionicons
            name={tab.icon as any}
            size={20}
            color={activeTab === tab.key ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[
            styles.tabText,
            activeTab === tab.key && styles.activeTabText
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

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

  const renderTrendingContent = () => (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔥 Trending Posts</Text>
        <FlatList
          data={trendingData.trending_posts}
          renderItem={renderPost}
          keyExtractor={(item: any) => item.post_id}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.grid}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⭐ Rising Creators</Text>
        <FlatList
          data={trendingData.rising_creators}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity style={styles.creatorCard}>
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName}>{item.username}</Text>
                <Text style={styles.creatorStats}>
                  {item.followers_count} followers • {item.engagement_rate}% engagement
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item: any) => item.user_id}
          scrollEnabled={false}
        />
      </View>
    </ScrollView>
  );

  const renderCategoriesContent = () => (
    <FlatList
      data={categories}
      renderItem={({ item }: { item: any }) => (
        <TouchableOpacity style={styles.categoryCard}>
          <Text style={styles.categoryEmoji}>{item.emoji}</Text>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.categoryCount}>{item.post_count} posts</Text>
        </TouchableOpacity>
      )}
      keyExtractor={(item: any) => item.category_id}
      numColumns={2}
      contentContainerStyle={styles.categoriesGrid}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderContent = () => {
    if (activeTab === 'trending') {
      return renderTrendingContent();
    } else if (activeTab === 'categories') {
      return renderCategoriesContent();
    } else {
      // For You tab
      return (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.post_id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={64} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No personalized content yet</Text>
              <Text style={styles.emptySubtext}>
                Like and interact with posts to improve your For You feed
              </Text>
            </View>
          }
        />
      );
    }
  };

  return (
    <View style={styles.container}>
      {renderTabBar()}
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  activeTabText: {
    color: Colors.primary,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
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
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  creatorCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  creatorStats: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  categoriesGrid: {
    padding: 16,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    padding: 20,
    borderRadius: 16,
    margin: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});