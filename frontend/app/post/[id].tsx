import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import MediaDisplay from "../../components/MediaDisplay";

export default function PostViewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { user } = useAuth();

  const postId = useMemo(() => {
    const v = params?.id;
    if (!v) return "";
    return Array.isArray(v) ? v[0] : v;
  }, [params]);

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Check if current user owns this post
  const isOwner = user?.user_id && post?.user_id === user.user_id;

  const load = useCallback(async () => {
    if (!postId) {
      setPost(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.getPostById(postId);
      setPost(data);
    } catch (e) {
      console.error("getPostById error", e);
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleEdit = () => {
    setShowMenu(false);
    router.push({ pathname: '/edit-post', params: { postId } });
  };

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deletePost(postId);
              Alert.alert('Success', 'Post deleted', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (e) {
              console.error('Delete post error:', e);
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundTitle}>Post not found.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); load(); }}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Post
        </Text>

        {/* Options Menu Button */}
        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowMenu(!showMenu)}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu */}
      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity 
            style={styles.menuBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowMenu(false)} 
          />
          <View style={styles.menu}>
            {isOwner && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                  <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
                  <Text style={styles.menuItemText}>Edit Post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  <Text style={[styles.menuItemText, { color: Colors.error }]}>Delete Post</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Ionicons name="share-outline" size={20} color={Colors.text} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Ionicons name="flag-outline" size={20} color={Colors.textSecondary} />
              <Text style={[styles.menuItemText, { color: Colors.textSecondary }]}>Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <Text style={styles.content}>{post.content}</Text>

        <MediaDisplay
          mediaUrl={post.media_url}
          mediaType={post.media_type}
          title={post.content}
        />

        {/* Optional metadata */}
        {!!post.created_at && (
          <Text style={styles.metaText}>
            {new Date(post.created_at).toLocaleString()}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    padding: 24,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  menuOverlay: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  menuBackdrop: {
    position: 'absolute',
    top: -100,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menu: {
    position: 'absolute',
    top: 0,
    right: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  content: { color: Colors.text, fontSize: 16, lineHeight: 22, marginBottom: 12 },
  metaText: {
    marginTop: 14,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  notFoundTitle: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: { color: "#fff", fontWeight: "800" },
  backLink: { paddingVertical: 8 },
  backLinkText: { color: Colors.primary, fontWeight: "700" },
});
