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

export default function CollectionsScreen() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const data = await api.getCollections();
      setCollections(data);
    } catch (error) {
      console.error('Load collections error:', error);
      Alert.alert('Error', 'Failed to load collections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) {
      Alert.alert('Error', 'Please enter a collection name');
      return;
    }

    try {
      setCreating(true);
      await api.createCollection({
        name: newCollectionName.trim(),
        description: newCollectionDescription.trim(),
        is_public: isPublic,
      });
      setNewCollectionName('');
      setNewCollectionDescription('');
      setCreateModalVisible(false);
      loadCollections();
      Alert.alert('Success', 'Collection created!');
    } catch (error) {
      console.error('Create collection error:', error);
      Alert.alert('Error', 'Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  const deleteCollection = async (collectionId: string) => {
    Alert.alert(
      'Delete Collection',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteCollection(collectionId);
              loadCollections();
              Alert.alert('Deleted', 'Collection deleted');
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete collection');
            }
          },
        },
      ]
    );
  };

  const viewCollection = (collection: Collection) => {
    router.push(`/collection-detail?id=${collection.collection_id}`);
  };

  const renderCollection = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={styles.collectionCard}
      onPress={() => viewCollection(item)}
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
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.collectionName} numberOfLines={1}>
            {item.name}
          </Text>
          
          {item.description && (
            <Text style={styles.collectionDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          
          <View style={styles.collectionStats}>
            <View style={styles.stat}>
              <Ionicons name="images-outline" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.statText}>{item.post_ids?.length || 0} posts</Text>
            </View>
            {item.is_public && (
              <View style={styles.stat}>
                <Ionicons name="people-outline" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.statText}>{item.followers_count || 0} followers</Text>
              </View>
            )}
            {!item.is_public && (
              <View style={styles.stat}>
                <Ionicons name="lock-closed-outline" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.statText}>Private</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
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
          <TouchableOpacity onPress={() => setCreateModalVisible(true)}>
            <Ionicons name="add-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={collections}
        renderItem={renderCollection}
        keyExtractor={(item) => item.collection_id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadCollections();
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={80} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Collections Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create collections to organize your saved posts
            </Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => setCreateModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createFirstButtonText}>Create Collection</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Create Collection Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Collection</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
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

            <TouchableOpacity
              style={styles.privacyToggle}
              onPress={() => setIsPublic(!isPublic)}
            >
              <View style={styles.privacyInfo}>
                <Ionicons
                  name={isPublic ? 'earth' : 'lock-closed'}
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.privacyText}>
                  {isPublic ? 'Public' : 'Private'}
                </Text>
              </View>
              <View style={[styles.toggle, isPublic && styles.toggleActive]}
              >
                <View style={[styles.toggleThumb, isPublic && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.createButton, creating && styles.createButtonDisabled]}
              onPress={createCollection}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create Collection</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
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
  listContainer: {
    padding: 16,
  },
  collectionCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  collectionGradient: {
    padding: 20,
  },
  collectionContent: {
    gap: 8,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  collectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
  },
  collectionName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  collectionDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  collectionStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
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
  createFirstButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
  privacyToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  privacyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  privacyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  toggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.textSecondary,
    padding: 4,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
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
