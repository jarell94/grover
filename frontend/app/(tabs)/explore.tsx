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
import { Colors } from "../../constants/Colors";
import { api } from "../../services/api";

type ExploreTab = "foryou" | "trending" | "categories";

export default function ExploreScreen() {
  const [activeTab, setActiveTab] = useState<ExploreTab>("foryou");
  const [posts, setPosts] = useState<any[]>([]);
  const [trendingData, setTrendingData] = useState<any>({
    trending_posts: [],
    rising_creators: [],
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load categories once (cache in state)
  useEffect(() => {
    (async () => {
      try {
        const data = await api.getCategories();
        setCategories(data || []);
      } catch (e) {
        console.error("Categories error:", e);
      }
    })();
  }, []);

  const loadContent = useCallback(async (tab: ExploreTab) => {
    try {
      if (tab === "foryou") {
        const data = await api.getExplore(20, 0);
        setPosts(Array.isArray(data) ? data : []);
      } else if (tab === "trending") {
        const data = await api.getTrending();
        setTrendingData(data || { trending_posts: [], rising_creators: [] });
      }
      // categories tab has no content fetch here
    } catch (error) {
      console.error("Load content error:", error);
    }
  }, []);

  // Fetch when tab changes
  useEffect(() => {
    setLoading(true);
    loadContent(activeTab).finally(() => setLoading(false));
  }, [activeTab, loadContent]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadContent(activeTab);
    setRefreshing(false);
  }, [activeTab, loadContent]);

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
                    : p.likes_count, // fallback if API doesn't return count
              }
            : p
        )
      );
    } catch (error) {
      console.error("Like error:", error);

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

  const getImageSource = (item: any) => {
    // supports base64 OR normal URL
    if (!item?.media_url) return null;
    if (item.media_url.startsWith("http")) return { uri: item.media_url };
    return { uri: `data:image/jpeg;base64,${item.media_url}` };
  };

  const renderPost = ({ item }: { item: any }) => {
    const img = item?.media_type === "image" ? getImageSource(item) : null;

    return (
      <TouchableOpacity style={styles.gridItem} activeOpacity={0.9}>
        {img ? (
          <Image source={img} style={styles.gridImage} />
        ) : (
          <View style={[styles.gridImage, styles.noImage]}>
            <Text style={styles.noImageText} numberOfLines={3}>
              {item?.content || ""}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.likeButton} onPress={() => handleLike(item.post_id)}>
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
          keyExtractor={(item) => item.post_id}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.grid}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⭐ Rising Creators</Text>
        <FlatList
          data={trendingData?.rising_creators || []}
          keyExtractor={(item) => item.user_id}
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
      keyExtractor={(item) => item.category_id}
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
          keyExtractor={(item) => item.post_id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
});
