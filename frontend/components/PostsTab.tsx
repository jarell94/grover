import React, { memo, useCallback } from 'react';
import { FlatList } from 'react-native';

type Post = { post_id?: string; _id?: string; [k: string]: any };

type RenderItem = ({ item, index }: { item: Post; index: number }) => React.ReactElement | null;

type Props = {
  posts: Post[];
  renderPost: RenderItem;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  contentPaddingBottom?: number;
};

const PostsTab = memo(({ posts, renderPost, refreshing = false, onRefresh, onEndReached, contentPaddingBottom = 80 }: Props) => {
  const keyExtractor = useCallback((p: Post) => String(p.post_id ?? p._id ?? ''), []);
  const handleEndReached = useCallback(() => { if (onEndReached) onEndReached(); }, [onEndReached]);

  return (
    <FlatList
      data={posts}
      renderItem={renderPost}
      keyExtractor={keyExtractor}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews
      scrollEventThrottle={16}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
    />
  );
});

export default PostsTab;
