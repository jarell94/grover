import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const Colors = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  diamond: '#B9F2FF',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
};

interface BadgeProps {
  level: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onPress?: () => void;
}

const badgeIcons = {
  Bronze: '🥉',
  Silver: '⭐',
  Gold: '👑',
  Diamond: '💎',
};

const badgeColors = {
  Bronze: Colors.bronze,
  Silver: Colors.silver,
  Gold: Colors.gold,
  Diamond: Colors.diamond,
};

export default function SupporterBadge({ level, size = 'medium', showLabel = false, onPress }: BadgeProps) {
  const icon = badgeIcons[level];
  const color = badgeColors[level];

  const sizes = {
    small: { container: 24, icon: 16 },
    medium: { container: 32, icon: 20 },
    large: { container: 40, icon: 28 },
  };

  const currentSize = sizes[size];

  const badge = (
    <View
      style={[
        styles.container,
        {
          width: currentSize.container,
          height: currentSize.container,
          backgroundColor: color + '20',
          borderColor: color,
        },
      ]}
    >
      <Text style={[styles.icon, { fontSize: currentSize.icon }]}>{icon}</Text>
    </View>
  );

  if (showLabel) {
    const content = (
      <View style={styles.labelContainer}>
        {badge}
        <View>
          <Text style={styles.levelText}>{level}</Text>
          <Text style={styles.supporterText}>Supporter</Text>
        </View>
      </View>
    );

    return onPress ? (
      <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>
    ) : (
      content
    );
  }

  return onPress ? <TouchableOpacity onPress={onPress}>{badge}</TouchableOpacity> : badge;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    textAlign: 'center',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  supporterText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
