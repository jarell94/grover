import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
  success: '#10B981',
};

export default function GoLiveScreen() {
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [enableSuperChat, setEnableSuperChat] = useState(false);
  const [enableShop, setEnableShop] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoLive = async () => {
    if (!streamTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your stream');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', streamTitle);
      if (streamDescription.trim()) {
        formData.append('description', streamDescription);
      }
      formData.append('enable_super_chat', enableSuperChat.toString());
      formData.append('enable_shopping', enableShop.toString());

      const result = await api.startStream(formData);
      
      router.push({
        pathname: '/live-stream',
        params: {
          streamId: result.stream_id,
          channelName: result.channel_name,
          isHost: 'true',
        },
      });
    } catch (error) {
      console.error('Start stream error:', error);
      Alert.alert('Error', 'Failed to start stream. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Go Live</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Live Preview Placeholder */}
        <View style={styles.previewContainer}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            style={styles.previewGradient}
          >
            <Ionicons name="videocam" size={64} color="rgba(255, 255, 255, 0.3)" />
            <Text style={styles.previewText}>Camera Preview</Text>
            <Text style={styles.previewSubtext}>Requires camera permission</Text>
          </LinearGradient>
        </View>

        {/* Stream Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stream Details</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Stream title"
            placeholderTextColor={Colors.textSecondary}
            value={streamTitle}
            onChangeText={setStreamTitle}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            placeholderTextColor={Colors.textSecondary}
            value={streamDescription}
            onChangeText={setStreamDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stream Features</Text>

          <View style={styles.featureRow}>
            <View style={styles.featureInfo}>
              <View style={styles.featureIcon}>
                <Ionicons name="cash" size={24} color={Colors.success} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureName}>Super Chat</Text>
                <Text style={styles.featureDescription}>
                  Let viewers send paid messages during your stream
                </Text>
              </View>
            </View>
            <Switch
              value={enableSuperChat}
              onValueChange={setEnableSuperChat}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureInfo}>
              <View style={styles.featureIcon}>
                <Ionicons name="storefront" size={24} color={Colors.accent} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureName}>Live Shopping</Text>
                <Text style={styles.featureDescription}>
                  Showcase and sell products during your stream
                </Text>
              </View>
            </View>
            <Switch
              value={enableShop}
              onValueChange={setEnableShop}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={Colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Stream Requirements</Text>
            <Text style={styles.infoText}>• Stable internet connection (3+ Mbps)</Text>
            <Text style={styles.infoText}>• Camera and microphone permissions</Text>
            <Text style={styles.infoText}>• At least 100 followers to go live</Text>
          </View>
        </View>

        {/* Streaming Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Live Streaming Tips</Text>
          <Text style={styles.tip}>• Test your internet before going live</Text>
          <Text style={styles.tip}>• Have good lighting and audio</Text>
          <Text style={styles.tip}>• Engage with your viewers in chat</Text>
          <Text style={styles.tip}>• Promote your stream in advance</Text>
        </View>
      </ScrollView>

      {/* Go Live Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.goLiveButton}
          onPress={handleGoLive}
          disabled={isLoading}
        >
          <LinearGradient
            colors={[Colors.error, Colors.secondary]}
            style={styles.goLiveGradient}
          >
            <Ionicons name="radio" size={24} color="#fff" />
            <Text style={styles.goLiveText}>Go Live</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => router.push('/schedule-stream')}
        >
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
          <Text style={styles.scheduleText}>Schedule for Later</Text>
        </TouchableOpacity>
      </View>
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
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  previewContainer: {
    height: 300,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 16,
  },
  previewSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  tipsCard: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 100,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  tip: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  goLiveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  goLiveGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  goLiveText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scheduleButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  scheduleText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
});
