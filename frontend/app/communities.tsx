import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
};

interface Community {
  community_id: string;
  name: string;
  description: string;
  category: string;
  member_count: number;
  is_member: boolean;
  created_at: string;
}

export default function CommunitiesScreen() {
  const { user } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDescription, setNewCommunityDescription] = useState('');
  const [newCommunityCategory, setNewCommunityCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'discover' | 'my'>('discover');

  useEffect(() => {
    loadCommunities();
  }, [tab]);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      const data = tab === 'discover' 
        ? await api.getDiscoverCommunities()
        : await api.getDiscoverCommunities(); // TODO: Add getMyCommunities endpoint
      setCommunities(data);
    } catch (error) {
      console.error('Load communities error:', error);
      Alert.alert('Error', 'Failed to load communities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const createCommunity = async () => {
    if (!newCommunityName.trim()) {
      Alert.alert('Error', 'Please enter a community name');
      return;
    }
    if (!newCommunityDescription.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    try {
      setCreating(true);
      await api.createCommunity({
        name: newCommunityName.trim(),
        description: newCommunityDescription.trim(),
        category: newCommunityCategory.trim() || 'General',
      });
      setNewCommunityName('');
      setNewCommunityDescription('');
      setNewCommunityCategory('');
      setCreateModalVisible(false);
      loadCommunities();
      Alert.alert('Success', 'Community created!');
    } catch (error) {
      console.error('Create community error:', error);
      Alert.alert('Error', 'Failed to create community');
    } finally {
      setCreating(false);
    }
  };

  const joinCommunity = async (communityId: string) => {
    try {
      await api.joinCommunity(communityId);
      setCommunities(communities.map(c => 
        c.community_id === communityId 
          ? { ...c, is_member: true, member_count: c.member_count + 1 }
          : c
      ));
      Alert.alert('Success', 'You joined the community!');
    } catch (error) {
      console.error('Join community error:', error);
      Alert.alert('Error', 'Failed to join community');
    }
  };

  const viewCommunity = (community: Community) => {
    router.push(`/community-detail?id=${community.community_id}`);
  };

  const renderCommunity = ({ item }: { item: Community }) => (
    <TouchableOpacity
      style={styles.communityCard}
      onPress={() => viewCommunity(item)}
    >
      <View style={styles.communityIcon}>
        <Ionicons name="people" size={28} color={Colors.primary} />
      </View>
      
      <View style={styles.communityInfo}>
        <Text style={styles.communityName}>{item.name}</Text>
        <Text style={styles.communityDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.communityMeta}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.category}</Text>
          </View>
          <View style={styles.memberCount}>
            <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.memberCountText}>
              {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>
      </View>
      
      {!item.is_member && (
        <TouchableOpacity
          style={styles.joinButton}
          onPress={(e) => {
            e.stopPropagation();
            joinCommunity(item.community_id);
          }}
        >
          <Ionicons name="add-circle" size={20} color={Colors.primary} />
          <Text style={styles.joinButtonText}>Join</Text>
        </TouchableOpacity>
      )}
      
      {item.is_member && (
        <View style={styles.memberBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.memberBadgeText}>Member</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#8B5CF6', '#EC4899', '#0EA5E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Communities</Text>
            <TouchableOpacity onPress={() => setCreateModalVisible(true)}>
              <Ionicons name="add-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === 'discover' && styles.tabActive]}
              onPress={() => setTab('discover')}
            >
              <Text style={[styles.tabText, tab === 'discover' && styles.tabTextActive]}>
                Discover
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'my' && styles.tabActive]}
              onPress={() => setTab('my')}
            >
              <Text style={[styles.tabText, tab === 'my' && styles.tabTextActive]}>
                My Communities
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={communities}
          renderItem={renderCommunity}
          keyExtractor={(item) => item.community_id}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadCommunities();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={80} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>
                {tab === 'discover' ? 'No Communities Found' : "You haven't joined any communities"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {tab === 'discover' 
                  ? 'Check back later for new communities'
                  : 'Discover and join communities that interest you'
                }
              </Text>
            </View>
          }
        />
      )}

      {/* Create Community Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Community</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Community name"
              placeholderTextColor={Colors.textSecondary}
              value={newCommunityName}
              onChangeText={setNewCommunityName}
              maxLength={50}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              placeholderTextColor={Colors.textSecondary}
              value={newCommunityDescription}
              onChangeText={setNewCommunityDescription}
              multiline
              maxLength={300}
            />

            <TextInput
              style={styles.input}
              placeholder="Category (e.g., Technology, Art, Gaming)"
              placeholderTextColor={Colors.textSecondary}
              value={newCommunityCategory}
              onChangeText={setNewCommunityCategory}
              maxLength={30}
            />

            <TouchableOpacity
              style={[styles.createButton, creating && styles.createButtonDisabled]}
              onPress={createCommunity}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create Community</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: Colors.primary,
  },
  listContainer: {
    padding: 16,
  },
  communityCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    gap: 12,
  },
  communityIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityInfo: {
    flex: 1,
    gap: 4,
  },
  communityName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  communityDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  communityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCountText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memberBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
