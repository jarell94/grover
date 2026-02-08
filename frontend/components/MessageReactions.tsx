import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { api } from '../services/api';

interface Reaction {
  user_id: string;
  created_at: string;
}

interface ReactionCounts {
  [emoji: string]: Reaction[];
}

interface MessageReactionsProps {
  messageId: string;
  reactions?: ReactionCounts;
  currentUserId: string;
  onReactionUpdate?: (reactions: ReactionCounts) => void;
}

const EMOJI_OPTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥', '🎉', '👏', '🙏', '💯'];

export const MessageReactionPicker: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}> = ({ visible, onClose, onSelect }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.pickerContainer}>
          {EMOJI_OPTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.emojiButton}
              onPress={() => {
                onSelect(emoji);
                onClose();
              }}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  reactions = {},
  currentUserId,
  onReactionUpdate,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReaction = async (emoji: string) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await api.addMessageReaction(messageId, emoji);
      if (onReactionUpdate && response.reaction_counts) {
        onReactionUpdate(response.reaction_counts);
      }
    } catch (error) {
      if (__DEV__) console.error('Add reaction error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if current user has reacted
  const userReacted = (emoji: string) => {
    return reactions[emoji]?.some((r) => r.user_id === currentUserId);
  };

  // Get total count for emoji
  const getCount = (emoji: string) => {
    return reactions[emoji]?.length || 0;
  };

  const reactionKeys = Object.keys(reactions).filter((emoji) => getCount(emoji) > 0);

  if (reactionKeys.length === 0) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="add-circle-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.addText}>React</Text>
        </TouchableOpacity>
        <MessageReactionPicker
          visible={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={handleReaction}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.reactionsRow}>
          {reactionKeys.map((emoji) => {
            const count = getCount(emoji);
            const reacted = userReacted(emoji);

            return (
              <TouchableOpacity
                key={emoji}
                style={[styles.reactionBubble, reacted && styles.reactionBubbleActive]}
                onPress={() => handleReaction(emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text
                  style={[
                    styles.reactionCount,
                    reacted && styles.reactionCountActive,
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowPicker(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
      <MessageReactionPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleReaction}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reactionBubbleActive: {
    backgroundColor: `${Colors.primary}20`,
    borderColor: Colors.primary,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  reactionCountActive: {
    color: Colors.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emojiButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: Colors.surface,
  },
  emojiText: {
    fontSize: 28,
  },
});
