// Agora module mock for web platform
// Web browsers don't support react-native-agora native modules
// This file provides mock exports so the app can still render on web

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Mock exports for web - these do nothing but prevent import errors
export const createAgoraRtcEngine = () => {
  console.warn('Agora RTC Engine is not available on web');
  return null;
};

// Mock RtcSurfaceView component for web
export const RtcSurfaceView: React.FC<any> = ({ style }) => {
  const combinedStyles = style ? [styles.mockView, style] : [styles.mockView];
  return (
    <View style={combinedStyles}>
      <Text style={styles.mockText}>Video streaming requires native app</Text>
    </View>
  );
};

// Mock enums
export const ChannelProfileType = {
  ChannelProfileCommunication: 0,
  ChannelProfileLiveBroadcasting: 1,
};

export const ClientRoleType = {
  ClientRoleBroadcaster: 1,
  ClientRoleAudience: 2,
};

// Flag to indicate Agora is not available on web
export const AGORA_AVAILABLE = false;

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
