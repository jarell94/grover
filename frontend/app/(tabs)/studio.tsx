import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type TabType = 'overview' | 'content' | 'products';

export default function StudioScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState({ total_revenue: 0, total_orders: 0 });
  const [engagementData, setEngagementData] = useState({ total_posts: 0, total_likes: 0, total_followers: 0 });
  const [myPosts, setMyPosts] = useState([]);
  const [myProducts, setMyProducts] = useState([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [revenue, engagement, posts, products] = await Promise.all([
        api.getRevenue(),
        api.getEngagement(),
        api.getPosts(),
        api.getMyProducts(),
      ]);

      setRevenueData(revenue);
      setEngagementData(engagement);
      
      // Filter to only current user's posts
      const userPosts = posts.filter((p: any) => p.user_id === user?.user_id);
      setMyPosts(userPosts);
      setMyProducts(products);
    } catch (error) {
      console.error('Load analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deletePost(postId);
            setMyPosts(myPosts.filter((p: any) => p.post_id !== postId));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete post');
          }
        },
      },
    ]);
  };

  const handleDeleteProduct = async (productId: string) => {
    Alert.alert('Delete Product', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteProduct(productId);
            setMyProducts(myProducts.filter((p: any) => p.product_id !== productId));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete product');
          }
        },
      },
    ]);
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
      <LinearGradient
        colors={[Colors.gradient.start, Colors.gradient.middle]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Creator Studio</Text>
        <Text style={styles.headerSubtitle}>Manage your content and track performance</Text>
      </LinearGradient>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'content' && styles.activeTab]}
          onPress={() => setActiveTab('content')}
        >
          <Text style={[styles.tabText, activeTab === 'content' && styles.activeTabText]}>
            Content
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
            Products
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'overview' && (
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Revenue Analytics</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons name="cash" size={32} color={Colors.success} />
                  <Text style={styles.statValue}>${revenueData.total_revenue.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>Total Revenue</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="receipt" size={32} color={Colors.primary} />
                  <Text style={styles.statValue}>{revenueData.total_orders}</Text>
                  <Text style={styles.statLabel}>Total Orders</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Engagement Metrics</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons name="newspaper" size={32} color={Colors.accent} />
                  <Text style={styles.statValue}>{engagementData.total_posts}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="heart" size={32} color={Colors.error} />
                  <Text style={styles.statValue}>{engagementData.total_likes}</Text>
                  <Text style={styles.statLabel}>Total Likes</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="people" size={32} color={Colors.secondary} />
                  <Text style={styles.statValue}>{engagementData.total_followers}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Performing Posts</Text>
              {myPosts
                .sort((a: any, b: any) => b.likes_count - a.likes_count)
                .slice(0, 5)
                .map((post: any) => (
                  <View key={post.post_id} style={styles.postItem}>
                    <View style={styles.postInfo}>
                      <Text style={styles.postContent} numberOfLines={2}>
                        {post.content}
                      </Text>
                      <View style={styles.postStats}>
                        <Ionicons name="heart" size={16} color={Colors.error} />
                        <Text style={styles.postStatText}>{post.likes_count} likes</Text>
                      </View>
                    </View>
                  </View>
                ))}
            </View>
          </View>
        )}

        {activeTab === 'content' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Posts ({myPosts.length})</Text>
            {myPosts.map((post: any) => (
              <View key={post.post_id} style={styles.contentItem}>
                <View style={styles.contentInfo}>
                  <Text style={styles.contentText} numberOfLines={3}>
                    {post.content}
                  </Text>
                  <View style={styles.contentStats}>
                    <View style={styles.contentStat}>
                      <Ionicons name="heart" size={16} color={Colors.textSecondary} />
                      <Text style={styles.contentStatText}>{post.likes_count}</Text>
                    </View>
                    <Text style={styles.contentDate}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePost(post.post_id)}
                >
                  <Ionicons name="trash" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            {myPosts.length === 0 && (
              <Text style={styles.emptyText}>No posts yet</Text>
            )}
          </View>
        )}

        {activeTab === 'products' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Products ({myProducts.length})</Text>
            {myProducts.map((product: any) => (
              <View key={product.product_id} style={styles.contentItem}>
                <View style={styles.contentInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.contentText} numberOfLines={2}>
                    {product.description}
                  </Text>
                  <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteProduct(product.product_id)}
                >
                  <Ionicons name="trash" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            {myProducts.length === 0 && (
              <Text style={styles.emptyText}>No products yet</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 12,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  postItem: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  postInfo: {
    flex: 1,
  },
  postContent: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStatText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  contentItem: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  contentInfo: {
    flex: 1,
  },
  contentText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
  },
  contentStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contentStatText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  contentDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
});