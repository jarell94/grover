import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import AudioPlayer from '../../components/AudioPlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SONG_CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

type TabType = 'discover' | 'library' | 'uploads';

interface Song {
  song_id: string;
  title: string;
  artist_name: string;
  artist_id: string;
  cover_art_url?: string;
  audio_url: string;
  duration?: number;
  genre?: string;
  plays_count: number;
  likes_count: number;
  price: number;
  can_play?: boolean;
  can_download?: boolean;
}

interface Album {
  album_id: string;
  title: string;
  artist_name: string;
  artist_id: string;
  cover_art_url: string;
  songs?: string[];
  genre?: string;
  price: number;
}

export default function MusicScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  
  // Data states
  const [discoverSongs, setDiscoverSongs] = useState<Song[]>([]);
  const [discoverAlbums, setDiscoverAlbums] = useState<Album[]>([]);
  const [librarySongs, setLibrarySongs] = useState<Song[]>([]);
  const [uploadedSongs, setUploadedSongs] = useState<Song[]>([]);
  const [uploadedAlbums, setUploadedAlbums] = useState<Album[]>([]);
  const [stats, setStats] = useState({ total_revenue: 0, total_plays: 0, total_songs: 0 });
  
  // Playback state
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  const genres = ['All', 'Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 'Classical', 'Country'];

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [activeTab])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'discover') {
        const [songsRes, albumsRes] = await Promise.all([
          api.get('/songs', { params: { limit: 20, sort_by: 'plays_count' } }),
          api.get('/albums', { params: { limit: 10 } }),
        ]);
        setDiscoverSongs(songsRes.data.songs || []);
        setDiscoverAlbums(albumsRes.data.albums || []);
      } else if (activeTab === 'library') {
        const libraryRes = await api.get('/my-library');
        setLibrarySongs([
          ...(libraryRes.data.purchased_songs || []),
          ...(libraryRes.data.liked_songs || []),
        ]);
      } else if (activeTab === 'uploads') {
        const myMusicRes = await api.get('/my-music');
        setUploadedSongs(myMusicRes.data.songs || []);
        setUploadedAlbums(myMusicRes.data.albums || []);
        setStats(myMusicRes.data.stats || {});
      }
    } catch (error) {
      console.error('Failed to load music data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePlaySong = async (song: Song) => {
    if (!song.can_play && song.price > 0) {
      // Show purchase modal
      router.push(`/song-purchase?songId=${song.song_id}&price=${song.price}`);
      return;
    }
    
    try {
      // Get playback URL
      const response = await api.post(`/songs/${song.song_id}/play`);
      setCurrentSong({ ...song, audio_url: response.data.audio_url });
    } catch (error) {
      console.error('Failed to play song:', error);
    }
  };

  const handleLikeSong = async (songId: string) => {
    try {
      await api.post(`/songs/${songId}/like`);
      loadData(); // Refresh to update like status
    } catch (error) {
      console.error('Failed to like song:', error);
    }
  };

  const renderSongCard = ({ item }: { item: Song }) => (
    <TouchableOpacity
      style={styles.songCard}
      onPress={() => handlePlaySong(item)}
    >
      <View style={styles.songCover}>
        {item.cover_art_url ? (
          <Image source={{ uri: item.cover_art_url }} style={styles.coverImage} />
        ) : (
          <LinearGradient
            colors={[Colors.primary + '40', Colors.primary + '80']}
            style={styles.coverImage}
          >
            <Ionicons name="musical-notes" size={32} color={Colors.background} />
          </LinearGradient>
        )}
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={40} color={Colors.background} />
        </View>
        {item.price > 0 && !item.can_play && (
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>${item.price}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{item.artist_name}</Text>
        
        <View style={styles.songStats}>
          <View style={styles.statItem}>
            <Ionicons name="play" size={12} color={Colors.textSecondary} />
            <Text style={styles.statText}>{formatNumber(item.plays_count)}</Text>
          </View>
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => handleLikeSong(item.song_id)}
          >
            <Ionicons name="heart" size={12} color={Colors.textSecondary} />
            <Text style={styles.statText}>{formatNumber(item.likes_count)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderAlbumCard = ({ item }: { item: Album }) => (
    <TouchableOpacity
      style={styles.albumCard}
      onPress={() => router.push(`/album-detail?albumId=${item.album_id}`)}
    >
      <Image source={{ uri: item.cover_art_url }} style={styles.albumCover} />
      {item.price > 0 && (
        <View style={styles.albumPrice}>
          <Text style={styles.albumPriceText}>${item.price}</Text>
        </View>
      )}
      <Text style={styles.albumTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.albumArtist} numberOfLines={1}>{item.artist_name}</Text>
    </TouchableOpacity>
  );

  const renderDiscoverContent = () => (
    <ScrollView
      style={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Search and filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search songs, albums, artists..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Genre filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genresContainer}>
        {genres.map((genre) => (
          <TouchableOpacity
            key={genre}
            style={[
              styles.genreChip,
              selectedGenre === genre && styles.genreChipActive,
            ]}
            onPress={() => setSelectedGenre(genre === selectedGenre ? null : genre)}
          >
            <Text
              style={[
                styles.genreText,
                selectedGenre === genre && styles.genreTextActive,
              ]}
            >
              {genre}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Popular Albums */}
      {discoverAlbums.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Albums</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
            {discoverAlbums.map((album) => (
              <View key={album.album_id} style={{ marginRight: 16 }}>
                {renderAlbumCard({ item: album })}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Trending Songs */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trending Songs</Text>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.songsGrid}>
          {discoverSongs.map((song) => (
            <View key={song.song_id} style={{ width: SONG_CARD_WIDTH }}>
              {renderSongCard({ item: song })}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderLibraryContent = () => (
    <ScrollView
      style={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.sectionTitle}>Your Library</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      ) : librarySongs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyStateText}>Your library is empty</Text>
          <Text style={styles.emptyStateSubtext}>Like or purchase songs to see them here</Text>
        </View>
      ) : (
        <View style={styles.songsGrid}>
          {librarySongs.map((song) => (
            <View key={song.song_id} style={{ width: SONG_CARD_WIDTH }}>
              {renderSongCard({ item: song })}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderUploadsContent = () => (
    <ScrollView
      style={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total_songs || 0}</Text>
          <Text style={styles.statLabel}>Songs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatNumber(stats.total_plays || 0)}</Text>
          <Text style={styles.statLabel}>Plays</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${stats.total_revenue?.toFixed(2) || '0.00'}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
      </View>

      {/* Upload buttons */}
      <View style={styles.uploadButtons}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => router.push('/upload-song')}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primary + 'CC']}
            style={styles.uploadButtonGradient}
          >
            <Ionicons name="musical-note" size={24} color={Colors.background} />
            <Text style={styles.uploadButtonText}>Upload Song</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => router.push('/upload-album')}
        >
          <LinearGradient
            colors={[Colors.primary + 'AA', Colors.primary + '88']}
            style={styles.uploadButtonGradient}
          >
            <Ionicons name="albums" size={24} color={Colors.background} />
            <Text style={styles.uploadButtonText}>Create Album</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Uploaded Albums */}
      {uploadedAlbums.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Your Albums</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
            {uploadedAlbums.map((album) => (
              <View key={album.album_id} style={{ marginRight: 16 }}>
                {renderAlbumCard({ item: album })}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Uploaded Songs */}
      <Text style={styles.sectionTitle}>Your Songs</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      ) : uploadedSongs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyStateText}>No songs uploaded yet</Text>
          <Text style={styles.emptyStateSubtext}>Start by uploading your first song</Text>
        </View>
      ) : (
        <View style={styles.songsGrid}>
          {uploadedSongs.map((song) => (
            <View key={song.song_id} style={{ width: SONG_CARD_WIDTH }}>
              {renderSongCard({ item: song })}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary + '20', Colors.background]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Music</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'library' && styles.tabActive]}
          onPress={() => setActiveTab('library')}
        >
          <Text style={[styles.tabText, activeTab === 'library' && styles.tabTextActive]}>
            Library
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'uploads' && styles.tabActive]}
          onPress={() => setActiveTab('uploads')}
        >
          <Text style={[styles.tabText, activeTab === 'uploads' && styles.tabTextActive]}>
            My Uploads
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'discover' && renderDiscoverContent()}
      {activeTab === 'library' && renderLibraryContent()}
      {activeTab === 'uploads' && renderUploadsContent()}

      {/* Mini Player (sticky at bottom) */}
      {currentSong && (
        <View style={styles.miniPlayer}>
          <AudioPlayer uri={currentSong.audio_url} title={`${currentSong.title} - ${currentSong.artist_name}`} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  genresContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  genreChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genreChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genreText: {
    fontSize: 14,
    color: Colors.text,
  },
  genreTextActive: {
    color: Colors.background,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
  },
  horizontalList: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  songsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
  },
  songCard: {
    marginBottom: 16,
  },
  songCover: {
    width: SONG_CARD_WIDTH,
    height: SONG_CARD_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  priceTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  songInfo: {
    marginTop: 8,
  },
  songTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  songStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  albumCard: {
    width: 140,
  },
  albumCover: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 8,
    position: 'relative',
  },
  albumPrice: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  albumPriceText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  albumTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  albumArtist: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  uploadButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  uploadButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  miniPlayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 8,
  },
});
