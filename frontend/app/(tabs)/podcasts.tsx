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

const categories = ['All', 'Technology', 'Business', 'Comedy', 'News', 'Sports', 'Education', 'Health', 'Arts', 'Science'];

export default function PodcastsScreen() {
  const [activeTab, setActiveTab] = useState<'discover' | 'library' | 'uploads'>('discover');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Discover data
  const [trendingPodcasts, setTrendingPodcasts] = useState<any[]>([]);
  const [podcastSeries, setPodcastSeries] = useState<any[]>([]);
  
  // Library data
  const [purchasedPodcasts, setPurchasedPodcasts] = useState<any[]>([]);
  const [likedPodcasts, setLikedPodcasts] = useState<any[]>([]);
  
  // My uploads data
  const [myPodcasts, setMyPodcasts] = useState<any[]>([]);
  const [mySeries, setMySeries] = useState<any[]>([]);
  const [myStats, setMyStats] = useState<any>({});

  useEffect(() => {
    loadData();
  }, [activeTab, selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'discover') {
        const params: any = { sort_by: 'trending', limit: 20 };
        if (selectedCategory !== 'All') {
          params.category = selectedCategory;
        }
        const podcastsResponse = await api.getPodcasts(params);
        setTrendingPodcasts(podcastsResponse.podcasts || []);
        
        const seriesResponse = await api.getPodcastSeries({ limit: 10 });
        setPodcastSeries(seriesResponse.series || []);
      } else if (activeTab === 'library') {
        const response = await api.getMyMediaLibrary();
        setPurchasedPodcasts(response.podcasts?.purchased_podcasts || []);
        setLikedPodcasts(response.podcasts?.liked_podcasts || []);
      } else if (activeTab === 'uploads') {
        const response = await api.getMyPodcasts();
        setMyPodcasts(response.podcasts || []);
        setMySeries(response.series || []);
        setMyStats(response.stats || {});
      }
    } catch (error: any) {
      console.error('Error loading podcasts:', error);
      if (error.status !== 401) {
        Alert.alert('Error', 'Failed to load podcasts');
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

  const handlePodcastPress = (podcastId: string) => {
    router.push(`/podcast-detail?podcastId=${podcastId}`);
  };

  const handleSeriesPress = (seriesId: string) => {
    router.push(`/podcast-series-detail?seriesId=${seriesId}`);
  };

  const handleUploadPodcast = () => {
    router.push('/upload-podcast');
  };

  const renderPodcastCard = (podcast: any) => (
    <TouchableOpacity
      key={podcast.podcast_id}
      style={styles.podcastCard}
      onPress={() => handlePodcastPress(podcast.podcast_id)}
    >
      {podcast.cover_art_url ? (
        <Image source={{ uri: podcast.cover_art_url }} style={styles.coverArt} />
      ) : (
        <View style={[styles.coverArt, styles.placeholderCover]}>
          <Ionicons name="mic" size={40} color="#999" />
        </View>
      )}
      
      {podcast.price > 0 && (
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>${podcast.price.toFixed(2)}</Text>
        </View>
      )}
      
      <View style={styles.podcastInfo}>
        <Text style={styles.podcastTitle} numberOfLines={2}>{podcast.title}</Text>
        <Text style={styles.hostName} numberOfLines={1}>{podcast.host_name}</Text>
        
        {podcast.episode_number && (
          <Text style={styles.episodeInfo}>
            {podcast.season_number && `S${podcast.season_number} `}E{podcast.episode_number}
          </Text>
        )}
        
        {podcast.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{podcast.category}</Text>
          </View>
        )}
        
        <View style={styles.podcastStats}>
          <View style={styles.statItem}>
            <Ionicons name="play" size={14} color="#666" />
            <Text style={styles.statText}>{podcast.plays_count || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={14} color="#666" />
            <Text style={styles.statText}>{podcast.likes_count || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSeriesCard = (series: any) => (
    <TouchableOpacity
      key={series.series_id}
      style={styles.seriesCard}
      onPress={() => handleSeriesPress(series.series_id)}
    >
      {series.cover_art_url ? (
        <Image source={{ uri: series.cover_art_url }} style={styles.seriesCover} />
      ) : (
        <View style={[styles.seriesCover, styles.placeholderCover]}>
          <Ionicons name="radio" size={30} color="#999" />
        </View>
      )}
      
      <View style={styles.seriesInfo}>
        <Text style={styles.seriesTitle} numberOfLines={1}>{series.title}</Text>
        <Text style={styles.seriesHost} numberOfLines={1}>{series.host_name}</Text>
        <Text style={styles.episodeCount}>{series.episodes?.length || 0} episodes</Text>
      </View>
    </TouchableOpacity>
  );

  const renderDiscoverTab = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Category Filters */}
      <View style={styles.section}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Popular Series */}
      {podcastSeries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Series</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {podcastSeries.map(renderSeriesCard)}
          </ScrollView>
        </View>
      )}

      {/* Trending Episodes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending Episodes</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.tint} style={{ marginTop: 20 }} />
        ) : trendingPodcasts.length === 0 ? (
          <Text style={styles.emptyText}>No podcasts found</Text>
        ) : (
          <View style={styles.podcastsGrid}>
            {trendingPodcasts.map(renderPodcastCard)}
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
      {/* Purchased Episodes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Purchases</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.tint} />
        ) : purchasedPodcasts.length === 0 ? (
          <Text style={styles.emptyText}>No purchased episodes yet</Text>
        ) : (
          <View style={styles.podcastsGrid}>
            {purchasedPodcasts.map(renderPodcastCard)}
          </View>
        )}
      </View>

      {/* Liked Episodes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Liked Episodes</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.tint} />
        ) : likedPodcasts.length === 0 ? (
          <Text style={styles.emptyText}>No liked episodes yet</Text>
        ) : (
          <View style={styles.podcastsGrid}>
            {likedPodcasts.map(renderPodcastCard)}
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
          <Ionicons name="mic" size={24} color={Colors.light.tint} />
          <Text style={styles.statNumber}>{myStats.total_episodes || 0}</Text>
          <Text style={styles.statLabel}>Episodes</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="play" size={24} color="#3B82F6" />
          <Text style={styles.statNumber}>{myStats.total_plays || 0}</Text>
          <Text style={styles.statLabel}>Plays</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="cash" size={24} color="#10B981" />
          <Text style={styles.statNumber}>${(myStats.total_revenue || 0).toFixed(2)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
      </View>

      {/* Upload Button */}
      <TouchableOpacity style={styles.uploadButton} onPress={handleUploadPodcast}>
        <Ionicons name="add-circle" size={24} color="white" />
        <Text style={styles.uploadButtonText}>Upload Episode</Text>
      </TouchableOpacity>

      {/* My Series */}
      {mySeries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Series ({mySeries.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {mySeries.map(renderSeriesCard)}
          </ScrollView>
        </View>
      )}

      {/* My Episodes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Episodes</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.tint} />
        ) : myPodcasts.length === 0 ? (
          <Text style={styles.emptyText}>No episodes uploaded yet</Text>
        ) : (
          <View style={styles.podcastsGrid}>
            {myPodcasts.map(renderPodcastCard)}
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#EC4899', '#F97316']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Podcasts</Text>
        
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
  categoryScroll: {
    marginBottom: 10,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  podcastsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  podcastCard: {
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
  coverArt: {
    width: '100%',
    height: 120,
    backgroundColor: '#F5F5F5',
  },
  placeholderCover: {
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
  podcastInfo: {
    padding: 12,
  },
  podcastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  hostName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  episodeInfo: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  categoryBadge: {
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#EC4899',
    fontWeight: '600',
  },
  podcastStats: {
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
  seriesCard: {
    width: 140,
    marginRight: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  seriesCover: {
    width: '100%',
    height: 140,
    backgroundColor: '#F5F5F5',
  },
  seriesInfo: {
    padding: 12,
  },
  seriesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  seriesHost: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  episodeCount: {
    fontSize: 11,
    color: '#999',
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
