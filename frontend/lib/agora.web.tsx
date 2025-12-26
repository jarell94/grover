// Web stub (Expo web)
// Agora is not available on web browsers
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const AGORA_AVAILABLE = false;

export const createAgoraRtcEngine = () => {
  throw new Error('Agora is not available on web');
};

// Dummy components/types so imports compile
export const RtcSurfaceView: React.FC<any> = ({ style }) => (
  <View style={[styles.mockView, style]}>
    <Text style={styles.mockText}>Live streaming requires native app</Text>
  </View>
);

export enum ChannelProfileType {
  ChannelProfileCommunication = 0,
  ChannelProfileLiveBroadcasting = 1,
}

export enum ClientRoleType {
  ClientRoleBroadcaster = 1,
  ClientRoleAudience = 2,
}

const styles = StyleSheet.create({
  mockView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  mockText: {
    color: '#94A3B8',
    fontSize: 14,
  },
});
