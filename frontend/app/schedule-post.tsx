import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
};

export default function SchedulePostScreen() {
  const [postContent, setPostContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 3600000)); // 1 hour from now
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScheduledPosts();
  }, []);

  const loadScheduledPosts = async () => {
    try {
      setLoading(true);
      const data = await api.getScheduledPosts();
      setScheduledPosts(data);
    } catch (error) {
      console.error('Load scheduled posts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedMedia(result.assets[0]);
    }
  };

  const schedulePost = async () => {
    if (!postContent.trim() && !selectedMedia) {
      Alert.alert('Error', 'Please add some content');
      return;
    }

    if (scheduledDate <= new Date()) {
      Alert.alert('Error', 'Please select a future date and time');
      return;
    }

    try {
      setScheduling(true);
      const formData = new FormData();
      formData.append('content', postContent.trim());
      formData.append('scheduled_at', scheduledDate.toISOString());
      
      if (selectedMedia) {
        const blob = {
          uri: selectedMedia.uri,
          type: selectedMedia.type === 'video' ? 'video/mp4' : 'image/jpeg',
          name: selectedMedia.type === 'video' ? 'post.mp4' : 'post.jpg',
        };
        formData.append('media', blob as any);
      }

      await api.schedulePost(formData);
      setPostContent('');
      setSelectedMedia(null);
      setScheduledDate(new Date(Date.now() + 3600000));
      loadScheduledPosts();
      Alert.alert('Success', 'Post scheduled successfully!');
    } catch (error) {
      console.error('Schedule post error:', error);
      Alert.alert('Error', 'Failed to schedule post');
    } finally {
      setScheduling(false);
    }
  };

  const deleteScheduledPost = async (scheduledPostId: string) => {
    Alert.alert(
      'Delete Scheduled Post',
      'Are you sure you want to delete this scheduled post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteScheduledPost(scheduledPostId);
              loadScheduledPosts();
              Alert.alert('Deleted', 'Scheduled post deleted');
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setScheduledDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(scheduledDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setScheduledDate(newDate);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#8B5CF6', '#EC4899', '#0EA5E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Schedule Post</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Create Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New Scheduled Post</Text>
          <View style={styles.createCard}>
            <TextInput
              style={styles.textInput}
              placeholder="What would you like to post?"
              placeholderTextColor={Colors.textSecondary}
              value={postContent}
              onChangeText={setPostContent}
              multiline
            />
            
            {selectedMedia && (
              <View style={styles.selectedMediaContainer}>
                <Image
                  source={{ uri: selectedMedia.uri }}
                  style={styles.selectedMedia}
                />
                <TouchableOpacity
                  style={styles.removeMediaButton}
                  onPress={() => setSelectedMedia(null)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.secondary} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.dateTimeSection}>
              <Text style={styles.dateTimeLabel}>Schedule for:</Text>
              <View style={styles.dateTimeButtons}>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                  <Text style={styles.dateTimeText}>
                    {scheduledDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color={Colors.primary} />
                  <Text style={styles.dateTimeText}>
                    {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="date"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.mediaButton} onPress={pickMedia}>
                <Ionicons name="images-outline" size={20} color={Colors.primary} />
                <Text style={styles.mediaButtonText}>Add Media</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scheduleButton, scheduling && styles.scheduleButtonDisabled]}
                onPress={schedulePost}
                disabled={scheduling}
              >
                {scheduling ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="calendar" size={18} color="#fff" />
                    <Text style={styles.scheduleButtonText}>Schedule</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Scheduled Posts List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduled Posts</Text>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : scheduledPosts.length > 0 ? (
            scheduledPosts.map((post, index) => (
              <View key={index} style={styles.scheduledPostCard}>
                <View style={styles.scheduledPostContent}>
                  {post.media_url && (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${post.media_url}` }}
                      style={styles.scheduledPostMedia}
                    />
                  )}
                  <View style={styles.scheduledPostInfo}>
                    <Text style={styles.scheduledPostText} numberOfLines={2}>
                      {post.content}
                    </Text>
                    <View style={styles.scheduledPostMeta}>
                      <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.scheduledPostTime}>
                        {new Date(post.scheduled_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteScheduledPost(post.scheduled_post_id)}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.secondary} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={60} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Scheduled Posts</Text>
              <Text style={styles.emptySubtitle}>
                Schedule posts to publish them at the perfect time
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  createCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  textInput: {
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 15,
    padding: 12,
    borderRadius: 12,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  selectedMediaContainer: {
    position: 'relative',
  },
  selectedMedia: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  dateTimeSection: {
    gap: 12,
  },
  dateTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  dateTimeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
  },
  dateTimeText: {
    fontSize: 14,
    color: Colors.text,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  scheduleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  scheduleButtonDisabled: {
    opacity: 0.6,
  },
  scheduleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  scheduledPostCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    gap: 12,
  },
  scheduledPostContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduledPostMedia: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  scheduledPostInfo: {
    flex: 1,
    gap: 6,
  },
  scheduledPostText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  scheduledPostMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduledPostTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
