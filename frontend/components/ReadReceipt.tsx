import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface ReadReceiptProps {
  sent?: boolean;
  delivered?: boolean;
  read?: boolean;
  readAt?: string;
}

export const ReadReceipt: React.FC<ReadReceiptProps> = ({
  sent = true,
  delivered = false,
  read = false,
  readAt,
}) => {
  if (read) {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-done" size={14} color={Colors.primary} />
        {readAt && (
          <Text style={styles.timeText}>
            {new Date(readAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        )}
      </View>
    );
  }

  if (delivered) {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-done" size={14} color={Colors.textSecondary} />
      </View>
    );
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark" size={14} color={Colors.textSecondary} />
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
});
