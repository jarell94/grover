import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  success: '#10B981',
  info: '#0EA5E9',
};

export default function AIAssistantScreen() {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [selectedTone, setSelectedTone] = useState('casual');
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [contentIdeas, setContentIdeas] = useState<any[]>([]);
  const [postingRecommendation, setPostingRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'caption' | 'hashtags' | 'ideas' | 'timing'>('caption');

  const tones = ['casual', 'professional', 'funny', 'inspirational'];

  const generateCaption = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Please enter some content');
      return;
    }

    setLoading(true);
    try {
      const result = await api.generateCaption(inputText, undefined, selectedTone);
      setGeneratedCaption(result.caption);
    } catch (error) {
      console.error('Generate caption error:', error);
      Alert.alert('Error', 'Failed to generate caption. AI service may not be available.');
    } finally {
      setLoading(false);
    }
  };

  const generateHashtags = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Please enter some content');
      return;
    }

    setLoading(true);
    try {
      const result = await api.suggestHashtags(inputText, 10);
      setSuggestedHashtags(result.hashtags);
    } catch (error) {
      console.error('Generate hashtags error:', error);
      Alert.alert('Error', 'Failed to generate hashtags. AI service may not be available.');
    } finally {
      setLoading(false);
    }
  };

  const loadContentIdeas = async () => {
    setLoading(true);
    try {
      const result = await api.getContentIdeas();
      setContentIdeas(result.ideas);
    } catch (error) {
      console.error('Load content ideas error:', error);
      Alert.alert('Error', 'Failed to load content ideas. AI service may not be available.');
    } finally {
      setLoading(false);
    }
  };

  const loadPostingRecommendation = async () => {
    setLoading(true);
    try {
      const result = await api.getPostingTimeRecommendation();
      setPostingRecommendation(result);
    } catch (error) {
      console.error('Load posting recommendation error:', error);
      Alert.alert('Error', 'Failed to load posting recommendation.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    // In a real app, use Clipboard from @react-native-clipboard/clipboard
    Alert.alert('Copied', 'Text copied to clipboard');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Content Assistant</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'caption' && styles.tabActive]}
          onPress={() => setActiveTab('caption')}
        >
          <Ionicons name="create" size={20} color={activeTab === 'caption' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'caption' && styles.tabTextActive]}>Caption</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hashtags' && styles.tabActive]}
          onPress={() => setActiveTab('hashtags')}
        >
          <Ionicons name="pricetag" size={20} color={activeTab === 'hashtags' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'hashtags' && styles.tabTextActive]}>Hashtags</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ideas' && styles.tabActive]}
          onPress={() => {
            setActiveTab('ideas');
            if (contentIdeas.length === 0) loadContentIdeas();
          }}
        >
          <Ionicons name="bulb" size={20} color={activeTab === 'ideas' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'ideas' && styles.tabTextActive]}>Ideas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'timing' && styles.tabActive]}
          onPress={() => {
            setActiveTab('timing');
            if (!postingRecommendation) loadPostingRecommendation();
          }}
        >
          <Ionicons name="time" size={20} color={activeTab === 'timing' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'timing' && styles.tabTextActive]}>Timing</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Caption Generator */}
        {activeTab === 'caption' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Generate AI Caption</Text>
            <Text style={styles.sectionDescription}>
              Enter your content idea, and AI will create an engaging caption for you.
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder="Describe what you want to post about..."
              placeholderTextColor={Colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />

            <View style={styles.toneSelector}>
              <Text style={styles.toneLabel}>Tone:</Text>
              <View style={styles.toneButtons}>
                {tones.map((tone) => (
                  <TouchableOpacity
                    key={tone}
                    style={[styles.toneButton, selectedTone === tone && styles.toneButtonActive]}
                    onPress={() => setSelectedTone(tone)}
                  >
                    <Text style={[styles.toneButtonText, selectedTone === tone && styles.toneButtonTextActive]}>
                      {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.generateButton, loading && styles.generateButtonDisabled]}
              onPress={generateCaption}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color="#fff" />
                  <Text style={styles.generateButtonText}>Generate Caption</Text>
                </>
              )}
            </TouchableOpacity>

            {generatedCaption && (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Generated Caption</Text>
                  <TouchableOpacity onPress={() => copyToClipboard(generatedCaption)}>
                    <Ionicons name="copy" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.resultText}>{generatedCaption}</Text>
              </View>
            )}
          </View>
        )}

        {/* Hashtag Generator */}
        {activeTab === 'hashtags' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Generate Hashtags</Text>
            <Text style={styles.sectionDescription}>
              Enter your post content, and AI will suggest relevant hashtags.
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder="Describe your post content..."
              placeholderTextColor={Colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />

            <TouchableOpacity
              style={[styles.generateButton, loading && styles.generateButtonDisabled]}
              onPress={generateHashtags}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color="#fff" />
                  <Text style={styles.generateButtonText}>Generate Hashtags</Text>
                </>
              )}
            </TouchableOpacity>

            {suggestedHashtags.length > 0 && (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Suggested Hashtags</Text>
                  <TouchableOpacity onPress={() => copyToClipboard(suggestedHashtags.map(h => `#${h}`).join(' '))}>
                    <Ionicons name="copy" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.hashtagContainer}>
                  {suggestedHashtags.map((hashtag, index) => (
                    <View key={index} style={styles.hashtagChip}>
                      <Text style={styles.hashtagText}>#{hashtag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Content Ideas */}
        {activeTab === 'ideas' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Content Ideas</Text>
            <Text style={styles.sectionDescription}>
              Get AI-powered content ideas based on trending topics.
            </Text>

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : contentIdeas.length > 0 ? (
              contentIdeas.map((idea, index) => (
                <View key={index} style={styles.ideaCard}>
                  <View style={styles.ideaHeader}>
                    <Text style={styles.ideaTitle}>{idea.title}</Text>
                    <View style={styles.ideaBadge}>
                      <Text style={styles.ideaBadgeText}>{idea.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.ideaDescription}>{idea.description}</Text>
                </View>
              ))
            ) : (
              <TouchableOpacity
                style={styles.generateButton}
                onPress={loadContentIdeas}
              >
                <Ionicons name="bulb" size={20} color="#fff" />
                <Text style={styles.generateButtonText}>Get Content Ideas</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Posting Time Recommendation */}
        {activeTab === 'timing' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Best Time to Post</Text>
            <Text style={styles.sectionDescription}>
              Get personalized recommendations for the optimal posting time.
            </Text>

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : postingRecommendation ? (
              <View>
                <View style={styles.timingCard}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    style={styles.timingGradient}
                  >
                    <Ionicons name="time" size={48} color="#fff" />
                    <Text style={styles.timingDay}>{postingRecommendation.recommended_day}</Text>
                    <Text style={styles.timingTime}>{postingRecommendation.recommended_time}</Text>
                    <Text style={styles.timingReason}>{postingRecommendation.reason}</Text>
                  </LinearGradient>
                </View>

                <View style={styles.tipCard}>
                  <Ionicons name="information-circle" size={24} color={Colors.info} />
                  <Text style={styles.tipText}>{postingRecommendation.general_tip}</Text>
                </View>

                {postingRecommendation.optimal_times_week && (
                  <View style={styles.weekSchedule}>
                    <Text style={styles.weekScheduleTitle}>Optimal Times This Week</Text>
                    {postingRecommendation.optimal_times_week.slice(0, 5).map((slot: any, index: number) => (
                      <View key={index} style={styles.scheduleSlot}>
                        <Text style={styles.scheduleDay}>{slot.day}</Text>
                        <Text style={styles.scheduleTime}>{slot.time}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.generateButton}
                onPress={loadPostingRecommendation}
              >
                <Ionicons name="time" size={20} color="#fff" />
                <Text style={styles.generateButtonText}>Get Recommendations</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  textInput: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: 15,
    padding: 16,
    borderRadius: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  toneSelector: {
    marginBottom: 20,
  },
  toneLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  toneButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.card,
  },
  toneButtonActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  toneButtonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  toneButtonTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  resultText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  hashtagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hashtagChip: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  hashtagText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  ideaCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  ideaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ideaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  ideaBadge: {
    backgroundColor: Colors.info + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ideaBadgeText: {
    fontSize: 11,
    color: Colors.info,
    fontWeight: '600',
  },
  ideaDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  timingCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  timingGradient: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  timingDay: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  timingTime: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  timingReason: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 8,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  weekSchedule: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  weekScheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  scheduleSlot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.card,
  },
  scheduleDay: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  scheduleTime: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
});
