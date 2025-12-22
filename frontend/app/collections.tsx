import React, { useEffect, useMemo, useCallback, useState } from 'react';
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

interface Collection {
  collection_id: string;
  user_id: string;
  name: string;
  description?: string;
  post_ids: string[];
  is_public: boolean;
  followers_count: number;
  created_at: string;
}

type SortKey = 'newest' | 'most_posts' | 'most_followers';

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // Search + sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Long-press menu (action sheet)
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);

  // Rename inline modal
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingPrivacyId, setTogglingPrivacyId] = useState<string | null>(null);

  const loadCollections = useCallback(async (opts?: { showLoader?: boolean }) => {
    const showLoader = opts?.showLoader ?? false;

    try {
      if (showLoader) setLoading(true);
      const data = await api.getCollections();
      setCollections(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load collections error:', error);
      Alert.alert('Error', 'Failed to load collections');
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCollections({ showLoader: true });
  }, [loadCollections]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCollections();
  }, [loadCollections]);

  const openCreateModal = useCallback(() => {
    setNewCollectionName('');
    setNewCollectionDescription('');
    setIsPublic(true);
    setCreateModalVisible(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateModalVisible(false);
  }, []);

  const viewCollection = useCallback((collection: Collection) => {
    router.push(`/collection-detail?id=${collection.collection_id}`);
  }, []);

  const createCollection = useCallback(async () => {
    if (!newCollectionName.trim()) {
      Alert.alert('Error', 'Please enter a collection name');
      return;
    }

    try {
      setCreating(true);

      const payload = {
        name: newCollectionName.trim(),
        description: newCollectionDescription.trim(),
        is_public: isPublic,
      };

      const created = await api.createCollection(payload);

      if (created?.collection_id) {
        setCollections((prev) => [created, ...prev]);
      } else {
        await loadCollections();
      }

      closeCreateModal();
      Alert.alert('Success', 'Collection created!');
    } catch (error) {
      console.error('Create collection error:', error);
      Alert.alert('Error', 'Failed to create collection');
    } finally {
      setCreating(false);
    }
  }, [newCollectionName, newCollectionDescription, isPublic, loadCollections, closeCreateModal]);

  const deleteCollection = useCallback(async (collectionId: string) => {
    Alert.alert('Delete Collection', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingId(collectionId);
            await api.deleteCollection(collectionId);
            setCollections((prev) => prev.filter((c) => c.collection_id !== collectionId));
            Alert.alert('Deleted', 'Collection deleted');
          } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('Error', 'Failed to delete collection');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }, []);

  const openActionMenu = useCallback((collection: Collection) => {
    setSelectedCollection(collection);
    setActionMenuVisible(true);
  }, []);

  const closeActionMenu = useCallback(() => {
    setActionMenuVisible(false);
  }, []);

  const openRename = useCallback(() => {
    if (!selectedCollection) return;
    setRenameValue(selectedCollection.name ?? '');
    setActionMenuVisible(false);
    setRenameModalVisible(true);
  }, [selectedCollection]);

  const closeRename = useCallback(() => {
    setRenameModalVisible(false);
  }, []);

  const submitRename = useCallback(async () => {
    if (!selectedCollection) return;
    const nextName = renameValue.trim();
    if (!nextName) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    try {
      setRenaming(true);

      const updated = await api.updateCollection(selectedCollection.collection_id, {
        name: nextName,
      });

      setCollections((prev) =>
        prev.map((c) =>
          c.collection_id === selectedCollection.collection_id
            ? { ...c, ...(updated ?? {}), name: nextName }
            : c
        )
      );

      setSelectedCollection((prev) =>
        prev ? { ...prev, ...(updated ?? {}), name: nextName } : prev
      );

      closeRename();
      Alert.alert('Success', 'Collection renamed');
    } catch (error) {
      console.error('Rename error:', error);
      Alert.alert('Error', 'Failed to rename collection');
    } finally {
      setRenaming(false);
    }
  }, [selectedCollection, renameValue, closeRename]);

  const togglePrivacy = useCallback(async () => {
    if (!selectedCollection) return;

    const nextIsPublic = !selectedCollection.is_public;

    try {
      setTogglingPrivacyId(selectedCollection.collection_id);
      setActionMenuVisible(false);

      const updated = await api.updateCollection(selectedCollection.collection_id, {
        is_public: nextIsPublic,
      });

      setCollections((prev) =>
        prev.map((c) =>
          c.collection_id === selectedCollection.collection_id
            ? { ...c, ...(updated ?? {}), is_public: nextIsPublic }
            : c
        )
      );

      setSelectedCollection((prev) =>
        prev ? { ...prev, ...(updated ?? {}), is_public: nextIsPublic } : prev
      );

      Alert.alert('Updated', nextIsPublic ? 'Collection is now Public' : 'Collection is now Private');
    } catch (error) {
      console.error('Toggle privacy error:', error);
      Alert.alert('Error', 'Failed to update privacy');
    } finally {
      setTogglingPrivacyId(null);
    }
  }, [selectedCollection]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let list = collections;

    if (q) {
      list = list.filter((c) => {
        const name = (c.name ?? '').toLowerCase();
        const desc = (c.description ?? '').toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    }

    const copy = [...list];

    copy.sort((a, b) => {
      if (sortKey === 'newest') {
        const aTime = new Date(a.created_at).getTime() || 0;
        const bTime = new Date(b.created_at).getTime() || 0;
        return bTime - aTime;
      }
      if (sortKey === 'most_posts') {
        const aPosts = a.post_ids?.length ?? 0;
        const bPosts = b.post_ids?.length ?? 0;
        return bPosts - aPosts;
      }
      // most_followers
      const aF = a.followers_count ?? 0;
      const bF = b.followers_count ?? 0;
      return bF - aF;
    });

    return copy;
  }, [collections, searchQuery, sortKey]);

  const sortLabel = useMemo(() => {
    if (sortKey === 'newest') return 'Newest';
    if (sortKey === 'most_posts') return 'Most posts';
    return 'Most followers';
  }, [sortKey]);

  const renderCollection = useCallback(
    ({ item }: { item: Collection }) => {
      const isDeleting = deletingId === item.collection_id;
      const isToggling = togglingPrivacyId === item.collection_id;

      return (
        <TouchableOpacity
          style={styles.collectionCard}
          onPress={() => viewCollection(item)}
          onLongPress={() => openActionMenu(item)}
          delayLongPress={250}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.collectionGradient}
          >
            <View style={styles.collectionContent}>
              <View style={styles.collectionHeader}>
                <View style={styles.collectionIcon}>
                  <Ionicons name="folder" size={24} color="#fff" />
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteCollection(item.collection_id)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.collectionName} numberOfLines={1}>
                {item.name}
              </Text>

              {!!item.description && (
                <Text style={styles.collectionDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              <View style={styles.collectionStats}>
                <View style={styles.stat}>
                  <Ionicons name="images-outline" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.statText}>{item.post_ids?.length ?? 0} posts</Text>
                </View>

                {item.is_public ? (
                  <View style={styles.stat}>
                    <Ionicons name="people-outline" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.statText}>{item.followers_count ?? 0} followers</Text>
                  </View>
                ) : (
                  <View style={styles.stat}>
                    <Ionicons name="lock-closed-outline" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.statText}>Private</Text>
                  </View>
                )}

                {isToggling && (
                  <View style={[styles.stat, { marginLeft: 8 }]}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.statText}>Updating...</Text>
                  </View>
                )}
              </View>

              <Text style={styles.hintText}>Long-press for options</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    },
    [viewCollection, openActionMenu, deleteCollection, deletingId, togglingPrivacyId]
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
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>My Collections</Text>

          <TouchableOpacity onPress={openCreateModal}>
            <Ionicons name="add-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search + Sort row */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search collections..."
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
        renderItem={renderCollection}
        keyExtractor={(item) => item.collection_id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={80} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {collections.length === 0 ? 'No Collections Yet' : 'No Results'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {collections.length === 0
                ? 'Create collections to organize your saved posts'
                : 'Try a different search or sort.'}
            </Text>
            {collections.length === 0 && (
              <TouchableOpacity style={styles.createFirstButton} onPress={openCreateModal}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createFirstButtonText}>Create Collection</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Sort Modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade" onRequestClose={() => setSortModalVisible(false)}>
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
              <Ionicons name={sortKey === 'newest' ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.primary} />
              <Text style={styles.sheetRowText}>Newest</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setSortKey('most_posts');
                setSortModalVisible(false);
              }}
            >
              <Ionicons name={sortKey === 'most_posts' ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.primary} />
              <Text style={styles.sheetRowText}>Most posts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setSortKey('most_followers');
                setSortModalVisible(false);
              }}
            >
              <Ionicons name={sortKey === 'most_followers' ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.primary} />
              <Text style={styles.sheetRowText}>Most followers</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Long-press Action Menu */}
      <Modal visible={actionMenuVisible} transparent animationType="fade" onRequestClose={closeActionMenu}>
        <Pressable style={styles.sheetOverlay} onPress={closeActionMenu}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>Collection options</Text>

            <TouchableOpacity style={styles.sheetRow} onPress={openRename}>
              <Ionicons name="pencil" size={20} color={Colors.text} />
              <Text style={styles.sheetRowText}>Rename</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={togglePrivacy}>
              <Ionicons name={selectedCollection?.is_public ? 'lock-closed' : 'earth'} size={20} color={Colors.text} />
              <Text style={styles.sheetRowText}>
                {selectedCollection?.is_public ? 'Make private' : 'Make public'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetRow, { borderBottomWidth: 0 }]}
              onPress={() => {
                closeActionMenu();
                if (selectedCollection) deleteCollection(selectedCollection.collection_id);
              }}
            >
              <Ionicons name="trash" size={20} color={Colors.secondary} />
              <Text style={[styles.sheetRowText, { color: Colors.secondary }]}>Delete</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={renameModalVisible} transparent animationType="slide" onRequestClose={closeRename}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={24}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Rename Collection</Text>
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
                {renaming ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Create Collection Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent onRequestClose={closeCreateModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={24}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Collection</Text>
                <TouchableOpacity onPress={closeCreateModal}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Collection name"
                placeholderTextColor={Colors.textSecondary}
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                maxLength={50}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                placeholderTextColor={Colors.textSecondary}
                value={newCollectionDescription}
                onChangeText={setNewCollectionDescription}
                multiline
                maxLength={200}
              />

              <TouchableOpacity style={styles.privacyToggle} onPress={() => setIsPublic((p) => !p)}>
                <View style={styles.privacyInfo}>
                  <Ionicons name={isPublic ? 'earth' : 'lock-closed'} size={20} color={Colors.primary} />
                  <Text style={styles.privacyText}>{isPublic ? 'Public' : 'Private'}</Text>
                </View>
                <View style={[styles.toggle, isPublic && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, isPublic && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createButton, creating && styles.createButtonDisabled]}
                onPress={createCollection}
                disabled={creating}
              >
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>Create Collection</Text>}
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

  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },

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

  collectionCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  collectionGradient: { padding: 20 },
  collectionContent: { gap: 8 },
  collectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  collectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: { padding: 8 },

  collectionName: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  collectionDescription: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },

  collectionStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  hintText: { marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
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

  // Bottom sheets / overlays
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
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
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

  privacyToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  privacyInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  privacyText: { fontSize: 16, fontWeight: '600', color: Colors.text },

  toggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.textSecondary,
    padding: 4,
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: Colors.primary },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  toggleThumbActive: { alignSelf: 'flex-end' },

  createButton: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  createButtonDisabled: { opacity: 0.6 },
  createButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
