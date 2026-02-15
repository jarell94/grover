import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Colors } from "../../constants/Colors";
import { api } from "../../services/api";

type ExploreTab = "foryou" | "trending" | "categories";

interface ExplorePost {
  post_id: string;
  content?: string;
  media_url?: string;
  media_type?: string;
  likes_count?: number;
  liked?: boolean;
}

interface RisingCreator {
  user_id: string;
  username: string;
  followers_count?: number;
  engagement_rate?: number;
}

interface Category {
  category_id: string;
  emoji: string;
  name: string;
  post_count?: number;
}

interface TrendingData {
  trending_posts: ExplorePost[];
  rising_creators: RisingCreator[];
}

const PAGE_SIZE = 21; // 3 columns, so multiple of 3

export default function ExploreScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ExploreTab>("foryou");
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [trendingData, setTrendingData] = useState<TrendingData>({
    trending_posts: [],
    rising_creators: [],
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);

  // Load categories once (cache in state)
  useEffect(() => {
    (async () => {
      try {
        const data = await api.getCategories();
        setCategories(data || []);
      } catch (e) {
        if (__DEV__) console.error("Categories error:", e);
      }
    })();
  }, []);

  const loadContent = useCallback(async (tab: ExploreTab, isRefresh = false) => {
    try {
      if (tab === "foryou") {
        const newSkip = isRefresh ? 0 : skip;
        const data = await api.getExplore(PAGE_SIZE, newSkip);
        const newPosts = Array.isArray(data) ? data : [];
        
        if (isRefresh) {
          setPosts(newPosts);
          setSkip(PAGE_SIZE);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
          setSkip((prev) => prev + PAGE_SIZE);
        }
        
        // Check if we have more content
        setHasMore(newPosts.length === PAGE_SIZE);
      } else if (tab === "trending") {
        const data = await api.getTrending();
        setTrendingData(data || { trending_posts: [], rising_creators: [] });
      }
    } catch (error) {
      if (__DEV__) console.error("Load content error:", error);
    }
  }, [skip]);

  // Initial load and tab change
  const loadInitialContent = useCallback(async (tab: ExploreTab) => {
    setLoading(true);
    setPosts([]);
    setSkip(0);
    setHasMore(true);
    
    try {
      if (tab === "foryou") {
        const data = await api.getExplore(PAGE_SIZE, 0);
        const newPosts = Array.isArray(data) ? data : [];
        setPosts(newPosts);
        setSkip(PAGE_SIZE);
        setHasMore(newPosts.length === PAGE_SIZE);
      } else if (tab === "trending") {
        const data = await api.getTrending();
        setTrendingData(data || { trending_posts: [], rising_creators: [] });
      }
    } catch (error) {
      if (__DEV__) console.error("Load content error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh content when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (activeTab === "foryou" && posts.length === 0) {
        loadInitialContent(activeTab);
      }
    }, [activeTab])
  );

  // Fetch when tab changes
  useEffect(() => {
    loadInitialContent(activeTab);
  }, [activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPosts([]);
    setSkip(0);
    setHasMore(true);
    
    try {
      if (activeTab === "foryou") {
        const data = await api.getExplore(PAGE_SIZE, 0);
        const newPosts = Array.isArray(data) ? data : [];
        setPosts(newPosts);
        setSkip(PAGE_SIZE);
        setHasMore(newPosts.length === PAGE_SIZE);
      } else {
        await loadContent(activeTab, true);
      }
    } catch (error) {
      if (__DEV__) console.error("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || activeTab !== "foryou") return;
    
    setLoadingMore(true);
    try {
      const data = await api.getExplore(PAGE_SIZE, skip);
      const newPosts = Array.isArray(data) ? data : [];
      
      if (newPosts.length > 0) {
        setPosts((prev) => [...prev, ...newPosts]);
        setSkip((prev) => prev + PAGE_SIZE);
      }
      
      setHasMore(newPosts.length === PAGE_SIZE);
    } catch (error) {
      if (__DEV__) console.error("Load more error:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, skip, activeTab]);

  const handleLike = useCallback(async (postId: string) => {
    // optimistic update (instant UI)
    setPosts((prev) =>
      prev.map((p) =>
        p.post_id === postId
          ? { ...p, liked: !p.liked, likes_count: p.likes_count + (p.liked ? -1 : 1) }
          : p
      )
    );

    try {
      const result = await api.likePost(postId);

      // reconcile with server truth
      setPosts((prev) =>
        prev.map((p) =>
          p.post_id === postId
            ? {
                ...p,
                liked: !!result?.liked,
                likes_count:
                  typeof result?.likes_count === "number"
                    ? result.likes_count
                    : p.likes_count,
              }
            : p
        )
      );
    } catch (error) {
      if (__DEV__) console.error("Like error:", error);

      // rollback on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.post_id === postId
            ? { ...p, liked: !p.liked, likes_count: p.likes_count + (p.liked ? -1 : 1) }
            : p
        )
      );
    }
  }, []);

  const handleOpenPost = useCallback((postId: string) => {
    router.push(`/post/${postId}`);
  }, [router]);

  const tabs = useMemo(
    () => [
      { key: "foryou" as const, label: "For You", icon: "heart" },
      { key: "trending" as const, label: "Trending", icon: "trending-up" },
      { key: "categories" as const, label: "Categories", icon: "grid" },
    ],
    []
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
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
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const getImageSource = (item?: ExplorePost) => {
    // supports base64 OR normal URL
    if (!item?.media_url) return null;
    if (item.media_url.startsWith("http")) return { uri: item.media_url };
    return { uri: `data:image/jpeg;base64,${item.media_url}` };
  };

  const renderPost = ({ item }: { item: ExplorePost }) => {
    const img = item?.media_type === "image" ? getImageSource(item) : null;
    const isVideo = item?.media_type === "video";

    return (
      <TouchableOpacity 
        style={styles.gridItem} 
        activeOpacity={0.9}
        onPress={() => handleOpenPost(item.post_id)}
      >
        {img ? (
          <Image source={img} style={styles.gridImage} />
        ) : isVideo ? (
          <View style={[styles.gridImage, styles.videoThumbnail]}>
            <Ionicons name="play-circle" size={40} color="#fff" />
          </View>
        ) : (
          <View style={[styles.gridImage, styles.noImage]}>
            <Text style={styles.noImageText} numberOfLines={3}>
              {item?.content || ""}
            </Text>
          </View>
        )}

        {isVideo && (
          <View style={styles.videoIcon}>
            <Ionicons name="videocam" size={16} color="#fff" />
          </View>
        )}

        <TouchableOpacity 
          style={styles.likeButton} 
          onPress={(e) => {
            e.stopPropagation?.();
            handleLike(item.post_id);
          }}
        >
          <Ionicons
            name={item?.liked ? "heart" : "heart-outline"}
            size={24}
            color={item?.liked ? Colors.error : "#fff"}
          />
        </TouchableOpacity>

        <View style={styles.gridOverlay}>
          <Text style={styles.likesText}>{item?.likes_count ?? 0} likes</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTrendingContent = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔥 Trending Posts</Text>
        <FlatList
          data={trendingData?.trending_posts || []}
          renderItem={renderPost}
          keyExtractor={(item) => String(item.post_id)}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.grid}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⭐ Rising Creators</Text>
        <FlatList
          data={trendingData?.rising_creators || []}
          keyExtractor={(item) => String(item.user_id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.creatorCard} activeOpacity={0.8}>
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName}>{item.username}</Text>
                <Text style={styles.creatorStats}>
                  {item.followers_count} followers • {item.engagement_rate}% engagement
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </ScrollView>
  );

  const renderCategoriesContent = () => (
    <FlatList
      data={categories}
      keyExtractor={(item) => String(item.category_id)}
      numColumns={2}
      contentContainerStyle={styles.categoriesGrid}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.categoryCard} activeOpacity={0.85}>
          <Text style={styles.categoryEmoji}>{item.emoji}</Text>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.categoryCount}>{item.post_count} posts</Text>
        </TouchableOpacity>
      )}
    />
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
        {renderTabBar()}
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderTabBar()}

      {activeTab === "trending" ? (
        renderTrendingContent()
      ) : activeTab === "categories" ? (
        renderCategoriesContent()
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => String(item.post_id)}
          numColumns={3}
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          removeClippedSubviews={true}
          maxToRenderPerBatch={9}
          windowSize={5}
          initialNumToRender={12}
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
      )}
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
  videoThumbnail: {
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIcon: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 4,
  },
});
