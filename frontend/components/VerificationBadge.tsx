import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface VerificationBadgeProps {
  verificationType?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

const Colors = {
  verified: '#1DA1F2',    // Twitter blue
  creator: '#FFD700',     // Gold
  business: '#4A90E2',    // Blue
  text: '#F1F5F9',
};

export default function VerificationBadge({ 
  verificationType, 
  size = 'small', 
  showLabel = false 
}: VerificationBadgeProps) {
  if (!verificationType) return null;

  const sizes = {
    small: 14,
    medium: 18,
    large: 24,
  };

  const iconSize = sizes[size];

  const getBadgeConfig = () => {
    switch (verificationType) {
      case 'verified':
        return {
          icon: 'checkmark-circle',
          color: Colors.verified,
          label: 'Verified',
          symbol: '✓',
        };
      case 'creator':
        return {
          icon: 'star',
          color: Colors.creator,
          label: 'Creator',
          symbol: '⭐',
        };
      case 'business':
        return {
          icon: 'business',
          color: Colors.business,
          label: 'Business',
          symbol: '🏢',
        };
      default:
        return null;
    }
  };

  const config = getBadgeConfig();
  if (!config) return null;

  if (showLabel) {
    return (
      <View style={styles.labelContainer}>
        <Ionicons name={config.icon as any} size={iconSize} color={config.color} />
        <Text style={[styles.labelText, { fontSize: iconSize * 0.8 }]}>
          {config.label}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons name={config.icon as any} size={iconSize} color={config.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 2,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  labelText: {
    color: Colors.text,
    fontWeight: '600',
  },
});
