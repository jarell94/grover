import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';

const genres = ['All', 'Drama', 'Comedy', 'Documentary', 'Horror', 'Sci-Fi', 'Action', 'Romance', 'Thriller', 'Animation'];

export default function FilmsScreen() {
  const [activeTab, setActiveTab] = useState<'discover' | 'library' | 'uploads'>('discover');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Discover data
  const [trendingFilms, setTrendingFilms] = useState<any[]>([]);
  
  // Library data
  const [purchasedFilms, setPurchasedFilms] = useState<any[]>([]);
  const [likedFilms, setLikedFilms] = useState<any[]>([]);
  
  // My uploads data
  const [myFilms, setMyFilms] = useState<any[]>([]);
  const [myStats, setMyStats] = useState<any>({});

  useEffect(() => {
    loadData();
  }, [activeTab, selectedGenre]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'discover') {
        const params: any = { sort_by: 'trending', limit: 20 };
        if (selectedGenre !== 'All') {
          params.genre = selectedGenre;
        }
        const response = await api.getFilms(params);
        setTrendingFilms(response.films || []);
      } else if (activeTab === 'library') {
        const response = await api.getMyMediaLibrary();
        setPurchasedFilms(response.films?.purchased_films || []);
        setLikedFilms(response.films?.liked_films || []);
      } else if (activeTab === 'uploads') {
        const response = await api.getMyFilms();
        setMyFilms(response.films || []);
        setMyStats(response.stats || {});
      }
    } catch (error: any) {
      console.error('Error loading films:', error);
      if (error.status !== 401) {
        Alert.alert('Error', 'Failed to load films');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleFilmPress = (filmId: string) => {
    router.push(`/film-detail?filmId=${filmId}`);
  };

  const handleUploadFilm = () => {
    router.push('/upload-film');
  };

  const renderFilmCard = (film: any) => (
    <TouchableOpacity
      key={film.film_id}
      style={styles.filmCard}
      onPress={() => handleFilmPress(film.film_id)}
    >
      {film.thumbnail_url ? (
        <Image source={{ uri: film.thumbnail_url }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
          <Ionicons name="film" size={40} color="#999" />
        </View>
      )}
      
      {film.price > 0 && (
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>${film.price.toFixed(2)}</Text>
        </View>
      )}
      
      <View style={styles.filmInfo}>
        <Text style={styles.filmTitle} numberOfLines={2}>{film.title}</Text>
        <Text style={styles.filmmakerName} numberOfLines={1}>{film.filmmaker_name}</Text>
        
        {film.genre && (
          <View style={styles.genreBadge}>
            <Text style={styles.genreBadgeText}>{film.genre}</Text>
          </View>
        )}
        
        <View style={styles.filmStats}>
          <View style={styles.statItem}>
            <Ionicons name="eye" size={14} color="#666" />
            <Text style={styles.statText}>{film.views_count || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={14} color="#666" />
            <Text style={styles.statText}>{film.likes_count || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderDiscoverTab = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Genre Filters */}
      <View style={styles.section}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
          {genres.map((genre) => (
            <TouchableOpacity
              key={genre}
              style={[styles.genreChip, selectedGenre === genre && styles.genreChipActive]}
              onPress={() => setSelectedGenre(genre)}
            >
              <Text style={[styles.genreText, selectedGenre === genre && styles.genreTextActive]}>
                {genre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Trending Films */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending Films</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.tint} style={{ marginTop: 20 }} />
        ) : trendingFilms.length === 0 ? (
          <Text style={styles.emptyText}>No films found</Text>
        ) : (
          <View style={styles.filmsGrid}>
            {trendingFilms.map(renderFilmCard)}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderLibraryTab = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Purchased Films */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Purchases</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.tint} />
        ) : purchasedFilms.length === 0 ? (
          <Text style={styles.emptyText}>No purchased films yet</Text>
        ) : (
          <View style={styles.filmsGrid}>
            {purchasedFilms.map(renderFilmCard)}
          </View>
        )}
      </View>

      {/* Liked Films */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Liked Films</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.tint} />
        ) : likedFilms.length === 0 ? (
          <Text style={styles.emptyText}>No liked films yet</Text>
        ) : (
          <View style={styles.filmsGrid}>
            {likedFilms.map(renderFilmCard)}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderUploadsTab = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="film" size={24} color={Colors.light.tint} />
          <Text style={styles.statNumber}>{myStats.total_films || 0}</Text>
          <Text style={styles.statLabel}>Films</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="eye" size={24} color="#3B82F6" />
          <Text style={styles.statNumber}>{myStats.total_views || 0}</Text>
          <Text style={styles.statLabel}>Views</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="cash" size={24} color="#10B981" />
          <Text style={styles.statNumber}>${(myStats.total_revenue || 0).toFixed(2)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
      </View>

      {/* Upload Button */}
      <TouchableOpacity style={styles.uploadButton} onPress={handleUploadFilm}>
        <Ionicons name="add-circle" size={24} color="white" />
        <Text style={styles.uploadButtonText}>Upload Film</Text>
      </TouchableOpacity>

      {/* My Films */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Films</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.tint} />
        ) : myFilms.length === 0 ? (
          <Text style={styles.emptyText}>No films uploaded yet</Text>
        ) : (
          <View style={styles.filmsGrid}>
            {myFilms.map(renderFilmCard)}
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#6B46C1', '#9333EA']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Films</Text>
        
        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
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
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'discover' && renderDiscoverTab()}
        {activeTab === 'library' && renderLibraryTab()}
        {activeTab === 'uploads' && renderUploadsTab()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: 'white',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tabTextActive: {
    color: Colors.light.tint,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  genreScroll: {
    marginBottom: 10,
  },
  genreChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  genreChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  genreText: {
    fontSize: 14,
    color: '#666',
  },
  genreTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  filmsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  filmCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnail: {
    width: '100%',
    height: 120,
    backgroundColor: '#F5F5F5',
  },
  placeholderThumbnail: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filmInfo: {
    padding: 12,
  },
  filmTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  filmmakerName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  genreBadge: {
    backgroundColor: '#F0E6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  genreBadgeText: {
    fontSize: 10,
    color: Colors.light.tint,
    fontWeight: '600',
  },
  filmStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  uploadButton: {
    backgroundColor: Colors.light.tint,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
