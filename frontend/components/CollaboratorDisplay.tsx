import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import VerificationBadge from './VerificationBadge';

interface CollaboratorDisplayProps {
  post: any;
  maxDisplay?: number;
  size?: 'small' | 'medium';
}

const Colors = {
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  primary: '#8B5CF6',
};

export default function CollaboratorDisplay({ 
  post, 
  maxDisplay = 2,
  size = 'small'
}: CollaboratorDisplayProps) {
  if (!post.is_collaboration || !post.collaborator_details || post.collaborator_details.length === 0) {
    return null;
  }

  // Filter to only show accepted collaborators
  const acceptedCollaborators = post.collaborator_details.filter(
    (collab: any) => collab.status === 'accepted'
  );

  if (acceptedCollaborators.length === 0) {
    return null;
  }

  const displayCollaborators = acceptedCollaborators.slice(0, maxDisplay);
  const remainingCount = acceptedCollaborators.length - maxDisplay;

  const fontSize = size === 'small' ? 12 : 14;

  return (
    <View style={styles.container}>
      <Ionicons name="people" size={fontSize + 2} color={Colors.textSecondary} />
      <Text style={[styles.text, { fontSize }]}>
        with{' '}
        {displayCollaborators.map((collab: any, index: number) => (
          <Text key={collab.user_id}>
            <TouchableOpacity onPress={() => router.push(`/profile/${collab.user_id}`)}>
              <Text style={styles.collaboratorName}>{collab.name}</Text>
            </TouchableOpacity>
            {collab.is_verified && (
              <VerificationBadge verificationType={collab.verification_type} size={size} />
            )}
            {index < displayCollaborators.length - 1 && ', '}
          </Text>
        ))}
        {remainingCount > 0 && (
          <Text style={styles.more}>
            {' '}and {remainingCount} other{remainingCount > 1 ? 's' : ''}
          </Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  text: {
    color: Colors.textSecondary,
    flexWrap: 'wrap',
  },
  collaboratorName: {
    color: Colors.text,
    fontWeight: '600',
  },
  more: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});
