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

// Calendar View Component
const CalendarView = ({ scheduledPosts, onDeletePost }: { scheduledPosts: any[], onDeletePost: (id: string) => void }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Group posts by date
  const postsByDate = scheduledPosts.reduce((acc, post) => {
    const date = new Date(post.scheduled_at).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(post);
    return acc;
  }, {} as Record<string, any[]>);

  // Get days in current month
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const changeMonth = (delta: number) => {
    const newDate = new Date(year, month + delta, 1);
    setSelectedDate(newDate);
  };

  return (
    <View style={styles.calendarContainer}>
      {/* Month Navigation */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthNav}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthName}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNav}>
          <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekdays}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <Text key={i} style={styles.weekdayText}>{day}</Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {days.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const cellDate = new Date(year, month, day);
          const dateStr = cellDate.toDateString();
          const postsOnDay = postsByDate[dateStr] || [];
          const isToday = dateStr === new Date().toDateString();

          return (
            <View key={day} style={styles.dayCell}>
              <View style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
                <Text style={[styles.dayText, isToday && styles.dayTextToday]}>{day}</Text>
              </View>
              {postsOnDay.length > 0 && (
                <View style={styles.dayIndicator}>
                  <Text style={styles.dayIndicatorText}>{postsOnDay.length}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Posts for Selected Day */}
      <View style={styles.calendarPosts}>
        <Text style={styles.calendarPostsTitle}>All Scheduled Posts</Text>
        {scheduledPosts.slice(0, 3).map((post, index) => (
          <View key={index} style={styles.calendarPostItem}>
            <View style={styles.calendarPostTime}>
              <Ionicons name="time-outline" size={16} color={Colors.primary} />
              <Text style={styles.calendarPostTimeText}>
                {new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={styles.calendarPostContent} numberOfLines={1}>
              {post.content}
            </Text>
            <TouchableOpacity onPress={() => onDeletePost(post.scheduled_post_id)}>
              <Ionicons name="trash-outline" size={16} color={Colors.secondary} />
            </TouchableOpacity>
          </View>
        ))}
        {scheduledPosts.length > 3 && (
          <Text style={styles.calendarMorePosts}>
            +{scheduledPosts.length - 3} more posts
          </Text>
        )}
      </View>
    </View>
  );
};

export default function SchedulePostScreen() {
  const [postContent, setPostContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 3600000)); // 1 hour from now
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [batchMode, setBatchMode] = useState(false);

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
      allowsEditing: !batchMode,
      allowsMultipleSelection: batchMode,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets) {
      if (batchMode) {
        setSelectedMedia(result.assets);
      } else {
        setSelectedMedia([result.assets[0]]);
      }
    }
  };

  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const schedulePost = async () => {
    if (!postContent.trim() && selectedMedia.length === 0) {
      Alert.alert('Error', 'Please add some content');
      return;
    }

    if (scheduledDate <= new Date()) {
      Alert.alert('Error', 'Please select a future date and time');
      return;
    }

    try {
      setScheduling(true);
      
      if (batchMode && selectedMedia.length > 1) {
        // Batch mode: Schedule multiple posts
        let successCount = 0;
        for (const [index, media] of selectedMedia.entries()) {
          const formData = new FormData();
          formData.append('content', postContent.trim() || `Post ${index + 1}`);
          
          // Stagger posts by 15 minutes each
          const postDate = new Date(scheduledDate.getTime() + (index * 15 * 60 * 1000));
          formData.append('scheduled_at', postDate.toISOString());
          
          const blob = {
            uri: media.uri,
            type: media.type === 'video' ? 'video/mp4' : 'image/jpeg',
            name: media.type === 'video' ? `post-${index}.mp4` : `post-${index}.jpg`,
          };
          formData.append('media', blob as any);
          
          await api.schedulePost(formData);
          successCount++;
        }
        
        Alert.alert('Success', `${successCount} posts scheduled successfully!`);
      } else {
        // Single post mode
        const formData = new FormData();
        formData.append('content', postContent.trim());
        formData.append('scheduled_at', scheduledDate.toISOString());
        
        if (selectedMedia.length > 0) {
          const media = selectedMedia[0];
          const blob = {
            uri: media.uri,
            type: media.type === 'video' ? 'video/mp4' : 'image/jpeg',
            name: media.type === 'video' ? 'post.mp4' : 'post.jpg',
          };
          formData.append('media', blob as any);
        }

        await api.schedulePost(formData);
        Alert.alert('Success', 'Post scheduled successfully!');
      }
      
      setPostContent('');
      setSelectedMedia([]);
      setScheduledDate(new Date(Date.now() + 3600000));
      setBatchMode(false);
      loadScheduledPosts();
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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>New Scheduled Post</Text>
            <TouchableOpacity
              style={[styles.batchToggle, batchMode && styles.batchToggleActive]}
              onPress={() => setBatchMode(!batchMode)}
            >
              <Ionicons name="albums" size={16} color={batchMode ? '#fff' : Colors.primary} />
              <Text style={[styles.batchToggleText, batchMode && styles.batchToggleTextActive]}>
                Batch
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.createCard}>
            <TextInput
              style={styles.textInput}
              placeholder="What would you like to post?"
              placeholderTextColor={Colors.textSecondary}
              value={postContent}
              onChangeText={setPostContent}
              multiline
            />
            
            {selectedMedia.length > 0 && (
              <View style={styles.selectedMediaContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
                  {selectedMedia.map((media, index) => (
                    <View key={index} style={styles.mediaItem}>
                      <Image
                        source={{ uri: media.uri }}
                        style={styles.selectedMediaThumb}
                      />
                      <TouchableOpacity
                        style={styles.removeMediaButton}
                        onPress={() => removeMedia(index)}
                      >
                        <Ionicons name="close-circle" size={20} color={Colors.secondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                {batchMode && selectedMedia.length > 1 && (
                  <Text style={styles.batchInfo}>
                    {selectedMedia.length} posts will be scheduled 15 minutes apart
                  </Text>
                )}
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Scheduled Posts</Text>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
                onPress={() => setViewMode('list')}
              >
                <Ionicons name="list" size={18} color={viewMode === 'list' ? '#fff' : Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewButton, viewMode === 'calendar' && styles.viewButtonActive]}
                onPress={() => setViewMode('calendar')}
              >
                <Ionicons name="calendar" size={18} color={viewMode === 'calendar' ? '#fff' : Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : scheduledPosts.length > 0 ? (
            viewMode === 'list' ? (
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
              <CalendarView scheduledPosts={scheduledPosts} onDeletePost={deleteScheduledPost} />
            )
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  batchToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  batchToggleActive: {
    backgroundColor: Colors.primary,
  },
  batchToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  batchToggleTextActive: {
    color: '#fff',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 2,
  },
  viewButton: {
    padding: 8,
    borderRadius: 6,
  },
  viewButtonActive: {
    backgroundColor: Colors.primary,
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
    marginVertical: 8,
  },
  mediaScroll: {
    marginBottom: 8,
  },
  mediaItem: {
    position: 'relative',
    marginRight: 12,
  },
  selectedMediaThumb: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  selectedMedia: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.background + 'CC',
    borderRadius: 10,
  },
  batchInfo: {
    fontSize: 12,
    color: Colors.info,
    fontStyle: 'italic',
    textAlign: 'center',
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
  
  // Calendar View
  calendarContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthNav: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  weekdays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberToday: {
    backgroundColor: Colors.primary + '20',
  },
  dayText: {
    fontSize: 13,
    color: Colors.text,
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  dayIndicator: {
    position: 'absolute',
    bottom: 2,
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dayIndicatorText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  calendarPosts: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  calendarPostsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  calendarPostItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  calendarPostTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calendarPostTimeText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  calendarPostContent: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  calendarMorePosts: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
});
