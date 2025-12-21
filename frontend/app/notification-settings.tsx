import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../services/api';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  accent: '#FBBF24',
  background: '#0F172A',
  surface: '#1E293B',
  border: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  error: '#EF4444',
};

type Settings = {
  notify_followers: boolean;
  notify_likes: boolean;
  notify_comments: boolean;
  notify_messages: boolean;
  notify_sales: boolean;
  notify_mentions: boolean;
  notify_reposts: boolean;
};

export default function NotificationSettings() {
  const [loading, setLoading] = useState(true);

  // Settings
  const [settings, setSettings] = useState<Settings>({
    notify_followers: true,
    notify_likes: true,
    notify_comments: true,
    notify_messages: true,
    notify_sales: true,
    notify_mentions: true,
    notify_reposts: true,
  });

  // Per-key saving state + local "saved" indicator
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Debounce timers per key
  const timersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    loadSettings();
    return () => {
      // cleanup timers
      Object.values(timersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getNotificationSettings();
      setSettings((prev) => ({ ...prev, ...data }));
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const notificationOptions = useMemo(
    () => [
      { key: 'notify_followers', icon: 'person-add', title: 'New Followers', description: 'When someone follows you' },
      { key: 'notify_likes', icon: 'heart', title: 'Likes', description: 'When someone likes your post' },
      { key: 'notify_comments', icon: 'chatbubble', title: 'Comments & Replies', description: 'When someone comments or replies to you' },
      { key: 'notify_messages', icon: 'mail', title: 'Messages', description: 'When you receive a new message' },
      { key: 'notify_sales', icon: 'cash', title: 'Product Sales', description: 'When someone purchases your product' },
      { key: 'notify_mentions', icon: 'at', title: 'Mentions & Tags', description: 'When someone tags you in a post' },
      { key: 'notify_reposts', icon: 'repeat', title: 'Reposts', description: 'When someone reposts your content' },
    ],
    []
  );

  const setKeySaving = (key: string, value: boolean) => {
    setSavingKeys((prev) => ({ ...prev, [key]: value }));
  };

  const updateSettingDebounced = (key: keyof Settings, value: boolean) => {
    // optimistic update immediately
    const previousValue = settings[key];
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaveStatus('saving');

    // clear existing timer for this key
    if (timersRef.current[key]) clearTimeout(timersRef.current[key]);

    // show per-toggle saving spinner state
    setKeySaving(key, true);

    // debounce network call
    timersRef.current[key] = setTimeout(async () => {
      try {
        await api.updateNotificationSettings({ [key]: value });
        setSaveStatus('saved');

        // after a moment, reset to idle
        setTimeout(() => setSaveStatus('idle'), 1200);
      } catch (error) {
        console.error('Failed to update setting:', error);
        // rollback
        setSettings((prev) => ({ ...prev, [key]: previousValue }));
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } finally {
        setKeySaving(key, false);
      }
    }, 450);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Settings</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  const StatusPill = () => {
    if (saveStatus === 'idle') return null;

    const icon =
      saveStatus === 'saving' ? 'time-outline' :
      saveStatus === 'saved' ? 'checkmark-circle' :
      'alert-circle';

    const text =
      saveStatus === 'saving' ? 'Saving…' :
      saveStatus === 'saved' ? 'Saved' :
      'Could not save';

    const color =
      saveStatus === 'saved' ? '#10B981' :
      saveStatus === 'error' ? Colors.error :
      Colors.textSecondary;

    return (
      <View style={styles.statusPill}>
        <Ionicons name={icon as any} size={16} color={color} />
        <Text style={[styles.statusText, { color }]}>{text}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={{ marginTop: 16, marginBottom: 12 }}>
          <Text style={styles.sectionDescription}>Choose which notifications you want to receive</Text>
          <StatusPill />
        </View>

        {notificationOptions.map((option) => {
          const key = option.key as keyof Settings;
          const isSaving = !!savingKeys[option.key];

          return (
            <View key={option.key} style={styles.optionCard}>
              <View style={styles.optionLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name={option.icon as any} size={24} color={Colors.primary} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
              </View>

              <View style={styles.rightControls}>
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Switch
                    value={settings[key]}
                    onValueChange={(value) => updateSettingDebounced(key, value)}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.text}
                  />
                )}
              </View>
            </View>
          );
        })}

        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.footerText}>
            You can change these settings anytime. Important notifications like security alerts will always be sent.
          </Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
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
  content: { flex: 1, paddingHorizontal: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionDescription: { fontSize: 14, color: Colors.textSecondary },

  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusText: { fontSize: 12, fontWeight: '700' },

  optionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  optionDescription: { fontSize: 13, color: Colors.textSecondary },

  rightControls: { width: 52, alignItems: 'flex-end', justifyContent: 'center' },

  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footerText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
