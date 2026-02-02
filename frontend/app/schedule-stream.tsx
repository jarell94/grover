import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../services/api';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  border: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
};

export default function ScheduleStreamScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSchedule = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a stream title');
      return;
    }
    if (!scheduledDate.trim() || !scheduledTime.trim()) {
      Alert.alert('Error', 'Please select date and time');
      return;
    }

    // Validate date and time format and ensure it's in the future
    try {
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (isNaN(scheduledDateTime.getTime())) {
        Alert.alert('Error', 'Invalid date or time format');
        return;
      }
      
      const now = new Date();
      if (scheduledDateTime <= now) {
        Alert.alert('Error', 'Scheduled time must be in the future');
        return;
      }
    } catch (error) {
      Alert.alert('Error', 'Invalid date or time format');
      return;
    }

    setIsLoading(true);
    try {
      await api.scheduleStream({
        title: title.trim(),
        description: description.trim(),
        scheduled_at: `${scheduledDate}T${scheduledTime}:00`,
      });

      Alert.alert('Success', 'Stream scheduled successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Schedule stream error:', error);
      Alert.alert('Error', 'Failed to schedule stream');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Stream</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            style={styles.iconGradient}
          >
            <Ionicons name="calendar" size={40} color="#fff" />
          </LinearGradient>
          <Text style={styles.iconTitle}>Schedule a Live Stream</Text>
          <Text style={styles.iconSubtitle}>
            Let your followers know when you are going live
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Stream Title</Text>
          <TextInput
            style={styles.input}
            placeholder="What will you be streaming?"
            placeholderTextColor={Colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell viewers what to expect..."
            placeholderTextColor={Colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
          />

          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textSecondary}
            value={scheduledDate}
            onChangeText={setScheduledDate}
          />

          <Text style={styles.label}>Time</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM (24-hour format)"
            placeholderTextColor={Colors.textSecondary}
            value={scheduledTime}
            onChangeText={setScheduledTime}
          />
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Your followers will be notified when you schedule a stream.
            You can start the stream up to 30 minutes before the scheduled time.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.scheduleButton, isLoading && styles.buttonDisabled]}
          onPress={handleSchedule}
          disabled={isLoading}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            style={styles.buttonGradient}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="calendar-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Schedule Stream</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  content: { flex: 1 },

  iconContainer: { alignItems: 'center', padding: 32 },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  iconSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  section: { paddingHorizontal: 16 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    margin: 16,
    gap: 12,
  },
  infoText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  scheduleButton: { borderRadius: 12, overflow: 'hidden' },
  buttonDisabled: { opacity: 0.6 },
  buttonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
