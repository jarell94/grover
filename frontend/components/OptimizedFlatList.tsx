// Optimized FlatList with Performance Enhancements

import React, { useCallback, useMemo, memo } from 'react';
import { FlatList, View } from 'react-native';

// Memoize components to prevent unnecessary re-renders
const ProfileHeader = memo(() => {
  return (
    // Header content
    <View>
      {/* Profile info */}
    </View>
  );
});

const Footer = memo(() => {
  return (
    <View>
      {/* Footer content */}
    </View>
  );
});

// Memoize post item to prevent re-renders of unchanged items
const PostItem = memo(({ item, index }) => {
  return (
    // Post content
    <View key={item.post_id}>
      {/* Post rendering */}
    </View>
  );
});

export const OptimizedFlatListProfile = ({ posts, onLoadMore, isLoading }) => {
  // Memoize renderPost to prevent recreation on every render
  const renderPost = useCallback(({ item, index }) => {
    return <PostItem item={item} index={index} />;
  }, []);

  // Extract keys efficiently
  const keyExtractor = useCallback((item, index) => {
    return item.post_id || `post-${index}`;
  }, []);

  // Handle pagination
  const handleEndReached = useCallback(() => {
    if (!isLoading && posts.length > 0) {
      onLoadMore();
    }
  }, [isLoading, posts.length, onLoadMore]);

  return (
    <FlatList
      data={posts}
      renderItem={renderPost}
      keyExtractor={keyExtractor}
      ListHeaderComponent={<ProfileHeader />}
      ListFooterComponent={<Footer />}
      
      // ===== CRITICAL PERFORMANCE OPTIMIZATIONS =====
      
      // Initial rendering
      initialNumToRender={10}           // Render first 10 items immediately
      maxToRenderPerBatch={10}          // Render 10 items per batch
      updateCellsBatchingPeriod={50}    // Batch updates every 50ms
      
      // Memory optimization
      removeClippedSubviews={true}      // Remove off-screen items (Android specific)
      scrollEventThrottle={16}          // Control scroll event frequency (~60fps)
      
      // Pagination
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}       // Trigger when 50% from bottom
      
      // Visual improvements
      showsVerticalScrollIndicator={false}
      
      // Performance monitoring (optional)
      onScrollBeginDrag={() => {
        // Can track user interaction
      }}
      onMomentumScrollEnd={() => {
        // Can trigger image loading
      }}
      
      // List optimization
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
    />
  );
};

export default OptimizedFlatListProfile;
