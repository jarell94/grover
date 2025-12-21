// Agora module loader for native platforms only
// This file is only imported on iOS/Android

import { Platform } from 'react-native';

export let createAgoraRtcEngine: any = null;
export let RtcSurfaceView: any = null;
export let ChannelProfileType: any = null;
export let ClientRoleType: any = null;
export let AGORA_AVAILABLE = false;

// This module should only be imported on native
if (Platform.OS !== 'web') {
  try {
    const AgoraModule = require('react-native-agora');
    createAgoraRtcEngine = AgoraModule.createAgoraRtcEngine;
    RtcSurfaceView = AgoraModule.RtcSurfaceView;
    ChannelProfileType = AgoraModule.ChannelProfileType;
    ClientRoleType = AgoraModule.ClientRoleType;
    AGORA_AVAILABLE = true;
  } catch (e) {
    console.log('Agora SDK not available');
  }
}
