import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Colors } from "../../constants/Colors";
import { api } from "../../services/api";
import MediaDisplay from "../../components/MediaDisplay";

export default function PostViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getPostById(id);
        setPost(data);
      } catch (e) {
        console.error("getPostById error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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
        <Text style={{ color: Colors.text }}>Post not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.content}>{post.content}</Text>
      <MediaDisplay mediaUrl={post.media_url} mediaType={post.media_type} title={post.content} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  content: { color: Colors.text, fontSize: 16, lineHeight: 22, marginBottom: 12 },
});
