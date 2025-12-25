import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "../constants/Colors";
import MediaViewer from "./MediaViewer";

type TabKey = "posts" | "photos" | "videos" | "audio";

type Post = {
  post_id: string;
  content: string;
  media_url?: string;
  media_type?: string; // "image" | "video" | "audio"
  likes_count: number;
  comments_count?: number;
  created_at: string;
};

type Props = {
  userId: string;
  api: {
    getUserPosts?: (userId: string, limit?: number, skip?: number) => Promise<Post[]>;
    getUserMedia?: (
      userId: string,
      mediaType: "image" | "video" | "audio",
      limit?: number,
      skip?: number
    ) => Promise<Post[]>;
  };
  stickyHeader?: boolean;
};

const PAGE_SIZE = 18;

function dedupeById(list: Post[]) {
  const map = new Map<string, Post>();
  for (const item of list) map.set(item.post_id, item);
  return Array.from(map.values());
}

function isUriLike(u?: string) {
  if (!u) return false;
  return (
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("file://") ||
    u.startsWith("content://") ||
    u.startsWith("ph://") ||
    u.startsWith("blob:") ||
    u.startsWith("data:")
  );
}

/**
 * Generate a Cloudinary video thumbnail URL from a video URL
 * Inserts transformation params after /upload/
 * Example: .../video/upload/v123/abc.mp4 → .../video/upload/w_400,h_400,c_fill,so_0/f_jpg/v123/abc.jpg
 */
function getCloudinaryVideoThumb(videoUrl: string, width = 400, height = 400): string | null {
  if (!videoUrl || !videoUrl.includes("cloudinary.com")) return null;
  
  // Match: .../video/upload/... or .../image/upload/...
  const uploadMatch = videoUrl.match(/(.*\/(?:video|image)\/upload\/)(v\d+\/)?(.+)/);
  if (!uploadMatch) return null;
  
  const [, base, version = "", publicIdWithExt] = uploadMatch;
  // Remove video extension and add jpg
  const publicId = publicIdWithExt.replace(/\.(mp4|mov|webm|avi|mkv)$/i, "");
  
  return `${base}w_${width},h_${height},c_fill,so_0/f_jpg/${version}${publicId}.jpg`;
}

export default function ProfileContentTabs({ userId, api, stickyHeader }: Props) {
  const tabs = useMemo(
    () => [
      { key: "posts" as const, label: "Posts", icon: "apps" },
      { key: "photos" as const, label: "Photos", icon: "image" },
      { key: "videos" as const, label: "Videos", icon: "videocam" },
      { key: "audio" as const, label: "Audio", icon: "musical-notes" },
    ],
    []
  );

  const [active, setActive] = useState<TabKey>("posts");
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Media viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Pagination using ref to avoid stale closures
  const skipRef = useRef(0);

  // guards against stale async responses (tab switches / refresh)
  const requestSeq = useRef(0);

  // Reset viewer state when tab changes
  useEffect(() => {
    setViewerVisible(false);
    setViewerIndex(0);
    requestSeq.current += 1; // invalidate any in-flight response immediately
  }, [active]);

  const fetchPage = useCallback(
    async (tab: TabKey, isRefresh = false) => {
      const myReq = ++requestSeq.current; // newest request id
      
      if (isRefresh) {
        skipRef.current = 0;
      }
      
      const skip = skipRef.current;

      let data: Post[] = [];
      if (tab === "posts") {
        if (!api.getUserPosts) throw new Error("api.getUserPosts not implemented");
        data = await api.getUserPosts(userId, PAGE_SIZE, skip);
      } else {
        if (!api.getUserMedia) throw new Error("api.getUserMedia not implemented");
        const mediaType = tab === "photos" ? "image" : tab === "videos" ? "video" : "audio";
        data = await api.getUserMedia(userId, mediaType, PAGE_SIZE, skip);
      }

      // stale response? ignore
      if (myReq !== requestSeq.current) return;

      const safe = Array.isArray(data) ? data : [];
      const more = safe.length === PAGE_SIZE;

      setHasMore(more);
      
      // Update skip for next fetch
      skipRef.current += safe.length;

      if (isRefresh) {
        setItems(dedupeById(safe));
      } else {
        setItems((prev) => dedupeById([...prev, ...safe]));
      }
    },
    [api, userId]
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setHasMore(true);
    skipRef.current = 0;
    setItems([]);
    try {
      await fetchPage(active, true);
    } catch (e) {
      console.error("Profile tab load error:", e);
      setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [active, fetchPage]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPage(active, 0, true);
    } finally {
      setRefreshing(false);
    }
  }, [active, fetchPage]);

  const onEndReached = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPage(active, page, false).finally(() => setLoadingMore(false));
  }, [active, fetchPage, hasMore, loading, loadingMore, page, refreshing]);

  const openPost = (post: Post) => {
    router.push({ pathname: "/post/[id]", params: { id: post.post_id } });
  };

  // Open media viewer for photos/videos tabs
  const openMediaViewer = (index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  // Open media viewer by post ID (useful for direct navigation)
  const openMediaViewerByPostId = (postId: string) => {
    const idx = mediaItems.findIndex((m) => m.id === postId);
    if (idx >= 0) {
      setViewerIndex(idx);
      setViewerVisible(true);
    }
  };

  // Convert items to MediaViewer format - only include items with valid URIs
  const mediaItems = useMemo(() => {
    if (active !== "photos" && active !== "videos" && active !== "audio") return [];
    
    return items
      .filter((item) => item.media_url && isUriLike(item.media_url))
      .map((item) => ({
        id: item.post_id,
        uri: item.media_url!,
        type: (active === "videos" ? "video" : active === "audio" ? "audio" : "image") as "image" | "video" | "audio",
        caption: item.content,
        title: item.content,
        likes_count: item.likes_count,
        comments_count: item.comments_count,
      }));
  }, [items, active]);

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => setActive(t.key)}
          >
            <Ionicons
              name={t.icon as any}
              size={18}
              color={isActive ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderGridItem = ({ item, index }: { item: Post; index: number }) => {
    const isImage = item.media_type === "image";
    const isVideo = item.media_type === "video";
    const isAudio = item.media_type === "audio";

    // Only use URI if it's a valid URI format
    const uri = isUriLike(item.media_url) ? item.media_url : undefined;

    // For photos/videos/audio tabs, open media viewer; for posts, open post detail
    const handlePress = () => {
      if ((active === "photos" || active === "videos" || active === "audio") && item.media_url) {
        openMediaViewerByPostId(item.post_id);
      } else {
        openPost(item);
      }
    };

    return (
      <TouchableOpacity style={styles.tile} activeOpacity={0.9} onPress={handlePress}>
        {isImage && uri ? (
          <Image source={{ uri }} style={styles.tileImage} />
        ) : (
          <View style={styles.tileFallback}>
            <Ionicons
              name={isVideo ? "videocam" : isAudio ? "musical-notes" : "chatbox-ellipses"}
              size={26}
              color={Colors.textSecondary}
            />
            <Text style={styles.tileText} numberOfLines={3}>
              {item.content || (isVideo ? "Video" : isAudio ? "Audio" : "Post")}
            </Text>
          </View>
        )}

        {/* small badge for type */}
        {(isVideo || isAudio) && (
          <View style={styles.typeBadge}>
            <Ionicons
              name={isVideo ? "videocam" : "musical-notes"}
              size={12}
              color="#fff"
            />
          </View>
        )}

        <View style={styles.tileOverlay}>
          <Ionicons name="heart" size={12} color="#fff" />
          <Text style={styles.tileOverlayText}>{item.likes_count ?? 0}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const Empty = () => (
    <View style={styles.empty}>
      <Ionicons name="grid-outline" size={52} color={Colors.textSecondary} />
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      <Text style={styles.emptySub}>
        {active === "posts"
          ? "Create your first post."
          : active === "photos"
          ? "Post a photo to show it here."
          : active === "videos"
          ? "Post a video to show it here."
          : "Post an audio track to show it here."}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderTabBar()}
        <View style={{ paddingVertical: 24 }}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderTabBar()}
      <FlatList
        data={items}
        keyExtractor={(i) => i.post_id}
        numColumns={3}
        renderItem={renderGridItem}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={<Empty />}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : null
        }
      />

      {/* Full-screen Media Viewer */}
      <MediaViewer
        visible={viewerVisible}
        media={mediaItems}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
        onLike={(id) => {
          // Navigate to post for interactions
          router.push({ pathname: "/post/[id]", params: { id } });
          setViewerVisible(false);
        }}
        onComment={(id) => {
          router.push({ pathname: "/post/[id]", params: { id } });
          setViewerVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  tabBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tabActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}15`,
  },
  tabText: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },

  grid: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  tileImage: { width: "100%", height: "100%" },
  tileFallback: { flex: 1, padding: 10, justifyContent: "center", alignItems: "center", gap: 8 },
  tileText: { fontSize: 11, textAlign: "center", color: Colors.text },

  typeBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },

  tileOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tileOverlayText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 56, gap: 10, width: "100%" },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 24, lineHeight: 18 },
});
