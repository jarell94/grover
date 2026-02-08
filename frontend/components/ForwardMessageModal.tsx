import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { api } from '../services/api';

interface Message {
  message_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  forwarded_from?: string;
  original_sender_name?: string;
  forward_comment?: string;
  media_url?: string;
  media_type?: string;
}

interface Recipient {
  id: string;
  name: string;
  type: 'user' | 'group';
  profile_picture?: string;
}

interface ForwardMessageModalProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ForwardMessageModal({
  visible,
  message,
  onClose,
  onSuccess,
}: ForwardMessageModalProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [shareToStory, setShareToStory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    if (visible) {
      loadRecipients();
    } else {
      // Reset state when modal closes
      setSelectedRecipients(new Set());
      setComment('');
      setShareToStory(false);
      setSearchQuery('');
    }
  }, [visible]);

  const loadRecipients = async () => {
    setLoading(true);
    try {
      const data = await api.getForwardRecipients();
      setRecipients(data.recipients || []);
    } catch (error) {
      console.error('Failed to load recipients:', error);
      Alert.alert('Error', 'Failed to load contacts and groups');
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipient = (recipientId: string) => {
    const newSelected = new Set(selectedRecipients);
    if (newSelected.has(recipientId)) {
      newSelected.delete(recipientId);
    } else {
      newSelected.add(recipientId);
    }
    setSelectedRecipients(newSelected);
  };

  const handleForward = async () => {
    if (!message) return;

    if (selectedRecipients.size === 0 && !shareToStory) {
      Alert.alert('No Recipients', 'Please select at least one recipient or enable "Share to Story"');
      return;
    }

    setForwarding(true);
    try {
      // Forward to selected recipients
      if (selectedRecipients.size > 0) {
        const recipientIds = Array.from(selectedRecipients).join(',');
        await api.forwardMessage(message.message_id, recipientIds, comment || undefined);
      }

      // Share to story if selected
      if (shareToStory) {
        await api.forwardMessageToStory(message.message_id);
      }

      Alert.alert(
        'Success',
        `Message forwarded to ${selectedRecipients.size} recipient${selectedRecipients.size !== 1 ? 's' : ''}${shareToStory ? ' and shared to story' : ''}`
      );

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to forward message:', error);
      Alert.alert('Error', 'Failed to forward message. Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  const filteredRecipients = recipients.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderRecipient = ({ item }: { item: Recipient }) => {
    const isSelected = selectedRecipients.has(item.id);

    return (
      <TouchableOpacity
        style={styles.recipientItem}
        onPress={() => toggleRecipient(item.id)}
      >
        <View style={styles.recipientLeft}>
          {item.profile_picture ? (
            <Image source={{ uri: item.profile_picture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons
                name={item.type === 'group' ? 'people' : 'person'}
                size={24}
                color={Colors.textSecondary}
              />
            </View>
          )}
          <View style={styles.recipientInfo}>
            <Text style={styles.recipientName}>{item.name}</Text>
            <Text style={styles.recipientType}>
              {item.type === 'group' ? 'Group' : 'Contact'}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected,
          ]}
        >
          {isSelected && (
            <Ionicons name="checkmark" size={16} color={Colors.white} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!message) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Forward Message</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts and groups..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Recipients List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredRecipients}
              renderItem={renderRecipient}
              keyExtractor={(item) => item.id}
              style={styles.recipientsList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No contacts or groups found</Text>
                </View>
              }
            />
          )}

          {/* Comment Input */}
          <View style={styles.commentSection}>
            <Text style={styles.commentLabel}>Add a comment (optional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Add your message..."
              placeholderTextColor={Colors.textSecondary}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={500}
            />
          </View>

          {/* Share to Story Option */}
          <TouchableOpacity
            style={styles.storyOption}
            onPress={() => setShareToStory(!shareToStory)}
          >
            <View style={styles.storyOptionLeft}>
              <Ionicons name="book" size={20} color={Colors.primary} />
              <Text style={styles.storyOptionText}>Share to Story</Text>
            </View>
            <View
              style={[
                styles.checkbox,
                shareToStory && styles.checkboxSelected,
              ]}
            >
              {shareToStory && (
                <Ionicons name="checkmark" size={16} color={Colors.white} />
              )}
            </View>
          </TouchableOpacity>

          {/* Forward Button */}
          <TouchableOpacity
            style={[
              styles.forwardButton,
              (selectedRecipients.size === 0 && !shareToStory) && styles.forwardButtonDisabled,
            ]}
            onPress={handleForward}
            disabled={forwarding || (selectedRecipients.size === 0 && !shareToStory)}
          >
            {forwarding ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="send" size={20} color={Colors.white} />
                <Text style={styles.forwardButtonText}>
                  Forward{selectedRecipients.size > 0 ? ` (${selectedRecipients.size})` : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: Colors.text,
    fontSize: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  recipientsList: {
    maxHeight: 300,
  },
  recipientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recipientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientInfo: {
    marginLeft: 12,
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  recipientType: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  commentSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commentLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  storyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  storyOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyOptionText: {
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
  },
  forwardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  forwardButtonDisabled: {
    backgroundColor: Colors.textSecondary,
    opacity: 0.5,
  },
  forwardButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
