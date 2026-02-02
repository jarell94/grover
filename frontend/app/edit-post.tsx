import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { api } from '../services/api';

export default function EditPostScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ postId?: string }>(); 
  const postId = params?.postId || '';

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPost = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getPostById(postId);
      setContent(data?.content || '');
    } catch (e) {
      console.error('Load post error:', e);
      Alert.alert('Error', 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleSave = async () => {
    if (!postId || postId === '') {
      Alert.alert('Error', 'Invalid post ID');
      return;
    }
    
    if (!content.trim()) {
      Alert.alert('Error', 'Post content cannot be empty');
      return;
    }

    setSaving(true);
    try {
      await api.updatePost(postId, { content: content.trim() });
      Alert.alert('Success', 'Post updated', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      console.error('Update post error:', e);
      Alert.alert('Error', 'Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Post</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.input}
          value={content}
          onChangeText={setContent}
          placeholder="What's on your mind?"
          placeholderTextColor={Colors.textSecondary}
          multiline
          autoFocus
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  input: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    minHeight: 200,
    textAlignVertical: 'top',
  },
});
