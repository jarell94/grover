import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

const { width, height } = Dimensions.get('window');

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: 'rgba(255,255,255,0.1)',
};

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  category: string;
}

interface MusicPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (track: MusicTrack) => void;
}

export default function MusicPicker({ visible, onClose, onSelect }: MusicPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'search' | 'categories'>('trending');
  const [music, setMusic] = useState<MusicTrack[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTrendingMusic();
      loadCategories();
    }
  }, [visible]);

  const loadTrendingMusic = async () => {
    try {
      setLoading(true);
      const response = await api.getTrendingMusic(20);
      setMusic(response.music);
    } catch (error) {
      console.error('Failed to load music:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.getMusicCategories();
      setCategories(response.categories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadTrendingMusic();
      return;
    }

    try {
      setLoading(true);
      setActiveTab('search');
      const response = await api.searchMusic(searchQuery, 20);
      setMusic(response.results);
    } catch (error) {
      console.error('Failed to search music:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTrack = (track: MusicTrack) => {
    onSelect(track);
    onClose();
  };

  const renderMusicItem = ({ item }: { item: MusicTrack }) => (
    <TouchableOpacity
      style={styles.musicItem}
      onPress={() => handleSelectTrack(item)}
    >
      <View style={styles.musicIcon}>
        <Ionicons name="musical-note" size={24} color={Colors.primary} />
      </View>
      
      <View style={styles.musicInfo}>
        <Text style={styles.musicTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.musicArtist} numberOfLines={1}>
          {item.artist}
        </Text>
        <Text style={styles.musicDuration}>
          {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
        </Text>
      </View>

      <TouchableOpacity style={styles.playButton}>
        <Ionicons name="play" size={20} color={Colors.text} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderCategoryItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.categoryChip}
      onPress={() => {
        setSearchQuery(item);
        handleSearch();
      }}
    >
      <Text style={styles.categoryText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Music</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search music..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
            onPress={() => {
              setActiveTab('trending');
              loadTrendingMusic();
            }}
          >
            <Text style={[styles.tabText, activeTab === 'trending' && styles.activeTabText]}>
              Trending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'categories' && styles.activeTab]}
            onPress={() => setActiveTab('categories')}
          >
            <Text style={[styles.tabText, activeTab === 'categories' && styles.activeTabText]}>
              Categories
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : activeTab === 'categories' ? (
          <FlatList
            data={categories}
            keyExtractor={(item) => item}
            renderItem={renderCategoryItem}
            numColumns={2}
            contentContainerStyle={styles.categoriesGrid}
          />
        ) : (
          <FlatList
            data={music}
            keyExtractor={(item) => item.id}
            renderItem={renderMusicItem}
            contentContainerStyle={styles.musicList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="musical-notes-outline" size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>No music found</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.text,
  },
  musicList: {
    padding: 16,
  },
  musicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  musicIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  musicInfo: {
    flex: 1,
    marginLeft: 12,
  },
  musicTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  musicArtist: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  musicDuration: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  categoriesGrid: {
    padding: 16,
  },
  categoryChip: {
    flex: 1,
    margin: 4,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
});
