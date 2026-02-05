import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import VerificationBadge from '../components/VerificationBadge';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: 'rgba(255,255,255,0.1)',
  success: '#10B981',
  error: '#EF4444',
};

export default function CollaborationInviteScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const postId = params.postId as string;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [post, setPost] = useState<any>(null);
  const [collaborators, setCollaborators] = useState<any[]>([]);

  useEffect(() => {
    loadPost();
  }, [postId]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const [postData, collabData] = await Promise.all([
        api.getPostById(postId),
        api.getPostCollaborators(postId),
      ]);

      setPost(postData);
      setCollaborators(collabData.collaborators || []);
    } catch (error) {
      console.error('Failed to load post:', error);
      Alert.alert('Error', 'Failed to load collaboration invite');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setProcessing(true);
    try {
      await api.acceptCollaboration(postId);
      Alert.alert('Success', 'You are now a collaborator on this post!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept collaboration');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Collaboration?',
      'Are you sure you want to decline this collaboration invite?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await api.declineCollaboration(postId);
              Alert.alert('Declined', 'Collaboration invite declined', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to decline');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Post not found</Text>
      </View>
    );
  }

  const myStatus = post.collaborator_status?.[user?.user_id];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collaboration Invite</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Badge */}
        {myStatus && (
          <View style={[styles.statusBadge, myStatus === 'accepted' ? styles.acceptedBadge : styles.pendingBadge]}>
            <Ionicons 
              name={myStatus === 'accepted' ? 'checkmark-circle' : 'time'} 
              size={20} 
              color={myStatus === 'accepted' ? Colors.success : Colors.textSecondary} 
            />
            <Text style={styles.statusText}>
              {myStatus === 'accepted' ? 'Accepted' : 'Pending'}
            </Text>
          </View>
        )}

        {/* Creator Info */}
        {post.user && (
          <View style={styles.creatorCard}>
            {post.user.picture ? (
              <Image source={{ uri: post.user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={32} color={Colors.textSecondary} />
              </View>
            )}
            <View style={styles.creatorInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.creatorName}>{post.user.name}</Text>
                {post.user.is_verified && (
                  <VerificationBadge verificationType={post.user.verification_type} size="medium" />
                )}
              </View>
              <Text style={styles.inviteText}>invited you to collaborate</Text>
            </View>
          </View>
        )}

        {/* Post Preview */}
        <View style={styles.postPreview}>
          <Text style={styles.sectionTitle}>Post Content</Text>
          {post.content && (
            <Text style={styles.postContent} numberOfLines={10}>
              {post.content}
            </Text>
          )}
          {post.media_url && (
            <Image source={{ uri: post.media_url }} style={styles.postMedia} />
          )}
        </View>

        {/* Collaborators List */}
        {collaborators.length > 0 && (
          <View style={styles.collaboratorsSection}>
            <Text style={styles.sectionTitle}>
              Collaborators ({collaborators.length})
            </Text>
            {collaborators.map((collab) => (
              <View key={collab.user_id} style={styles.collaboratorItem}>
                {collab.picture ? (
                  <Image source={{ uri: collab.picture }} style={styles.smallAvatar} />
                ) : (
                  <View style={[styles.smallAvatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={16} color={Colors.textSecondary} />
                  </View>
                )}
                <View style={styles.collaboratorInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.collaboratorName}>{collab.name}</Text>
                    {collab.is_verified && (
                      <VerificationBadge verificationType={collab.verification_type} />
                    )}
                  </View>
                  <Text style={styles.statusLabel}>
                    {collab.status === 'accepted' ? '✓ Accepted' : '⏳ Pending'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        {myStatus === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.declineButton]}
              onPress={handleDecline}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color={Colors.text} />
                  <Text style={styles.buttonText}>Decline</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={handleAccept}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.text} />
                  <Text style={styles.buttonText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            As a collaborator, you'll be credited as a co-author of this post and it will appear on your profile.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  scrollContent: {
    padding: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 16,
  },
  acceptedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  pendingBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  inviteText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  postPreview: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  postContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  postMedia: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: Colors.card,
  },
  collaboratorsSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  collaboratorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  collaboratorInfo: {
    flex: 1,
  },
  collaboratorName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  declineButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
