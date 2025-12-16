import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
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

export default function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    notify_followers: true,
    notify_likes: true,
    notify_comments: true,
    notify_messages: true,
    notify_sales: true,
    notify_mentions: true,
    notify_reposts: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getNotificationSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    setSaving(true);
    try {
      await api.updateNotificationSettings({ [key]: value });
    } catch (error) {
      console.error('Failed to update setting:', error);
      // Revert on error
      setSettings(prev => ({ ...prev, [key]: !value }));
    } finally {
      setSaving(false);
    }
  };

  const notificationOptions = [
    {
      key: 'notify_followers',
      icon: 'person-add',
      title: 'New Followers',
      description: 'When someone follows you',
    },
    {
      key: 'notify_likes',
      icon: 'heart',
      title: 'Likes',
      description: 'When someone likes your post',
    },
    {
      key: 'notify_comments',
      icon: 'chatbubble',
      title: 'Comments & Replies',
      description: 'When someone comments on your post or replies to you',
    },
    {
      key: 'notify_messages',
      icon: 'mail',
      title: 'Messages',
      description: 'When you receive a new message',
    },
    {
      key: 'notify_sales',
      icon: 'cash',
      title: 'Product Sales',
      description: 'When someone purchases your product',
    },
    {
      key: 'notify_mentions',
      icon: 'at',
      title: 'Mentions & Tags',
      description: 'When someone tags you in a post',
    },
    {
      key: 'notify_reposts',
      icon: 'repeat',
      title: 'Reposts',
      description: 'When someone reposts your content',
    },
  ];

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
        <Text style={styles.sectionDescription}>
          Choose which notifications you want to receive
        </Text>

        {notificationOptions.map((option) => (
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
            <Switch
              value={settings[option.key as keyof typeof settings]}
              onValueChange={(value) => updateSetting(option.key, value)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.text}
              disabled={saving}
            />
          </View>
        ))}

        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.footerText}>
            You can change these settings anytime. Important notifications like security alerts
            will always be sent.
          </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  sectionDescription: {
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionText: {},
  optionTitle: {
    color: Colors.text,
    fontWeight: '600',
  },
  optionDescription: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  footer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
});