import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  success: '#10B981',
};

interface Community {
  community_id: string;
  name: string;
  description: string;
  category: string;
  member_count: number;
  is_member: boolean;
  created_at: string;
  owner_id?: string;
}

type TabKey = 'discover' | 'my';
type SortKey = 'newest' | 'members' | 'name';

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

  const [tab, setTab] = useState<TabKey>('discover');

  // Search + sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Long-press action sheet
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);

  // Rename modal
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [joinLeavingId, setJoinLeavingId] = useState<string | null>(null);

  const sortLabel = useMemo(() => {
    if (sortKey === 'newest') return 'Newest';
    if (sortKey === 'members') return 'Members';
    return 'Name';
  }, [sortKey]);

  const loadCommunities = useCallback(
    async (opts?: { showLoader?: boolean }) => {
      const showLoader = opts?.showLoader ?? false;

      try {
        if (showLoader) setLoading(true);

        let data: Community[] = [];

        if (tab === 'discover') {
          data = await api.getDiscoverCommunities();
        } else {
          const discover = await api.getDiscoverCommunities();
          data = Array.isArray(discover) ? discover.filter((c) => c.is_member) : [];
        }

        setCommunities(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Load communities error:', error);
        Alert.alert('Error', 'Failed to load communities');
      } finally {
        if (showLoader) setLoading(false);
        setRefreshing(false);
      }
    },
    [tab]
  );

  useEffect(() => {
    loadCommunities({ showLoader: true });
  }, [loadCommunities]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCommunities();
  }, [loadCommunities]);

  const createCommunity = useCallback(async () => {
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
      const created = await api.createCommunity({
        name: newCommunityName.trim(),
        description: newCommunityDescription.trim(),
        category: newCommunityCategory.trim() || 'General',
      });

      if (created?.community_id) {
        setCommunities((prev) => [created, ...prev]);
      } else {
        await loadCommunities();
      }

      setNewCommunityName('');
      setNewCommunityDescription('');
      setNewCommunityCategory('');
      setCreateModalVisible(false);
      Alert.alert('Success', 'Community created!');
    } catch (error) {
      console.error('Create community error:', error);
      Alert.alert('Error', 'Failed to create community');
    } finally {
      setCreating(false);
    }
  }, [newCommunityName, newCommunityDescription, newCommunityCategory, loadCommunities]);

  const joinCommunity = useCallback(async (communityId: string) => {
    try {
      setJoinLeavingId(communityId);
      await api.joinCommunity(communityId);

      setCommunities((prev) =>
        prev.map((c) =>
          c.community_id === communityId
            ? { ...c, is_member: true, member_count: (c.member_count ?? 0) + 1 }
            : c
        )
      );

      Alert.alert('Success', 'You joined the community!');
    } catch (error) {
      console.error('Join community error:', error);
      Alert.alert('Error', 'Failed to join community');
    } finally {
      setJoinLeavingId(null);
    }
  }, []);

  const leaveCommunity = useCallback(async (communityId: string) => {
    try {
      setJoinLeavingId(communityId);

      // Uncomment when backend endpoint is ready:
      // await api.leaveCommunity(communityId);

      setCommunities((prev) =>
        prev.map((c) =>
          c.community_id === communityId
            ? { ...c, is_member: false, member_count: Math.max(0, (c.member_count ?? 0) - 1) }
            : c
        )
      );

      Alert.alert('Left', 'You left the community');
    } catch (error) {
      console.error('Leave community error:', error);
      Alert.alert('Error', 'Failed to leave community');
    } finally {
      setJoinLeavingId(null);
    }
  }, []);

  const viewCommunity = useCallback((community: Community) => {
    router.push(`/community-detail?id=${community.community_id}`);
  }, []);

  const openActionMenu = useCallback((community: Community) => {
    setSelectedCommunity(community);
    setActionMenuVisible(true);
  }, []);

  const closeActionMenu = useCallback(() => setActionMenuVisible(false), []);

  const isOwner = useMemo(() => {
    if (!selectedCommunity || !user) return false;
    if (selectedCommunity.owner_id) return selectedCommunity.owner_id === user.user_id;
    return false;
  }, [selectedCommunity, user]);

  const openRename = useCallback(() => {
    if (!selectedCommunity) return;
    setRenameValue(selectedCommunity.name ?? '');
    setActionMenuVisible(false);
    setRenameModalVisible(true);
  }, [selectedCommunity]);

  const closeRename = useCallback(() => setRenameModalVisible(false), []);

  const submitRename = useCallback(async () => {
    if (!selectedCommunity) return;
    const nextName = renameValue.trim();
    if (!nextName) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    try {
      setRenaming(true);

      // Uncomment when backend endpoint is ready:
      // const updated = await api.updateCommunity(selectedCommunity.community_id, { name: nextName });

      setCommunities((prev) =>
        prev.map((c) =>
          c.community_id === selectedCommunity.community_id ? { ...c, name: nextName } : c
        )
      );
      setSelectedCommunity((prev) => (prev ? { ...prev, name: nextName } : prev));

      setRenameModalVisible(false);
      Alert.alert('Success', 'Community renamed');
    } catch (error) {
      console.error('Rename community error:', error);
      Alert.alert('Error', 'Failed to rename community');
    } finally {
      setRenaming(false);
    }
  }, [selectedCommunity, renameValue]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let list = communities;

    if (q) {
      list = list.filter((c) => {
        const name = (c.name ?? '').toLowerCase();
        const desc = (c.description ?? '').toLowerCase();
        const cat = (c.category ?? '').toLowerCase();
        return name.includes(q) || desc.includes(q) || cat.includes(q);
      });
    }

    const copy = [...list];
    copy.sort((a, b) => {
      if (sortKey === 'newest') {
        const at = new Date(a.created_at).getTime() || 0;
        const bt = new Date(b.created_at).getTime() || 0;
        return bt - at;
      }
      if (sortKey === 'members') {
        return (b.member_count ?? 0) - (a.member_count ?? 0);
      }
      return (a.name ?? '').localeCompare(b.name ?? '');
    });

    return copy;
  }, [communities, searchQuery, sortKey]);

  const renderCommunity = useCallback(
    ({ item }: { item: Community }) => {
      const busy = joinLeavingId === item.community_id;

      return (
        <TouchableOpacity
          style={styles.communityCard}
          onPress={() => viewCommunity(item)}
          onLongPress={() => openActionMenu(item)}
          delayLongPress={250}
          activeOpacity={0.9}
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

            <Text style={styles.hintText}>Long-press for options</Text>
          </View>

          {!item.is_member ? (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={() => joinCommunity(item.community_id)}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color={Colors.primary} />
                  <Text style={styles.joinButtonText}>Join</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.memberBadge}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.memberBadgeText}>Member</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [joinCommunity, joinLeavingId, openActionMenu, viewCommunity]
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

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
              <Text style={[styles.tabText, tab === 'discover' && styles.tabTextActive]}>Discover</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'my' && styles.tabActive]}
              onPress={() => setTab('my')}
            >
              <Text style={[styles.tabText, tab === 'my' && styles.tabTextActive]}>My Communities</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Search + Sort row */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search communities..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearch}>
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.sortButton} onPress={() => setSortModalVisible(true)}>
          <Ionicons name="swap-vertical" size={18} color="#fff" />
          <Text style={styles.sortButtonText}>{sortLabel}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredAndSorted}
        renderItem={renderCommunity}
        keyExtractor={(item) => item.community_id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={80} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {communities.length === 0
                ? tab === 'discover'
                  ? 'No Communities Yet'
                  : 'You have not joined any communities'
                : 'No Results'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {communities.length === 0
                ? 'Be the first to create a community!'
                : 'Try a different search or sort.'}
            </Text>
            {communities.length === 0 && tab === 'discover' && (
              <TouchableOpacity
                style={styles.createFirstButton}
                onPress={() => setCreateModalVisible(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createFirstButtonText}>Create Community</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Sort Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setSortModalVisible(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>Sort by</Text>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setSortKey('newest');
                setSortModalVisible(false);
              }}
            >
              <Ionicons
                name={sortKey === 'newest' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.sheetRowText}>Newest</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setSortKey('members');
                setSortModalVisible(false);
              }}
            >
              <Ionicons
                name={sortKey === 'members' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.sheetRowText}>Most Members</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setSortKey('name');
                setSortModalVisible(false);
              }}
            >
              <Ionicons
                name={sortKey === 'name' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.sheetRowText}>Name (A-Z)</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Long-press Action Menu */}
      <Modal
        visible={actionMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeActionMenu}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeActionMenu}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>Community options</Text>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                closeActionMenu();
                if (selectedCommunity) viewCommunity(selectedCommunity);
              }}
            >
              <Ionicons name="enter-outline" size={20} color={Colors.text} />
              <Text style={styles.sheetRowText}>View Community</Text>
            </TouchableOpacity>

            {isOwner && (
              <TouchableOpacity style={styles.sheetRow} onPress={openRename}>
                <Ionicons name="pencil" size={20} color={Colors.text} />
                <Text style={styles.sheetRowText}>Rename</Text>
              </TouchableOpacity>
            )}

            {selectedCommunity?.is_member ? (
              <TouchableOpacity
                style={[styles.sheetRow, { borderBottomWidth: 0 }]}
                onPress={() => {
                  closeActionMenu();
                  if (selectedCommunity) leaveCommunity(selectedCommunity.community_id);
                }}
              >
                <Ionicons name="exit-outline" size={20} color={Colors.secondary} />
                <Text style={[styles.sheetRowText, { color: Colors.secondary }]}>Leave Community</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sheetRow, { borderBottomWidth: 0 }]}
                onPress={() => {
                  closeActionMenu();
                  if (selectedCommunity) joinCommunity(selectedCommunity.community_id);
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={Colors.success} />
                <Text style={[styles.sheetRowText, { color: Colors.success }]}>Join Community</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeRename}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={24}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Rename Community</Text>
                <TouchableOpacity onPress={closeRename}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="New name"
                placeholderTextColor={Colors.textSecondary}
                value={renameValue}
                onChangeText={setRenameValue}
                maxLength={50}
              />

              <TouchableOpacity
                style={[styles.createButton, renaming && styles.createButtonDisabled]}
                onPress={submitRename}
                disabled={renaming}
              >
                {renaming ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Create Community Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={24}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Community</Text>
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
                returnKeyType="next"
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
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 16 },
  headerContent: { gap: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },

  tabs: { flexDirection: 'row', gap: 12 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  tabTextActive: { color: Colors.primary },

  toolbar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15 },
  clearSearch: { padding: 4 },

  sortButton: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortButtonText: { color: '#fff', fontWeight: '700' },

  listContainer: { padding: 16, paddingTop: 8 },

  communityCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  communityIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityInfo: { flex: 1, gap: 4 },
  communityName: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  communityDescription: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  communityMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  badge: {
    backgroundColor: Colors.primary + '30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  memberCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberCountText: { fontSize: 12, color: Colors.textSecondary },
  hintText: { marginTop: 6, fontSize: 11, color: Colors.textSecondary },

  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinButtonText: { fontSize: 14, fontWeight: '600', color: Colors.primary },

  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.success },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 16, textAlign: 'center' },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createFirstButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // Bottom sheets
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 26,
  },
  sheetTitle: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetRowText: { color: Colors.text, fontSize: 16, fontWeight: '600' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
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
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.text },

  input: {
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  textArea: { height: 100, textAlignVertical: 'top' },

  createButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: { opacity: 0.6 },
  createButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
