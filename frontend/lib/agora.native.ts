// Native platforms (iOS/Android)
// Re-export from react-native-agora for full functionality

export const AGORA_AVAILABLE = true;

export {
  createAgoraRtcEngine,
  RtcSurfaceView,
  ChannelProfileType,
  ClientRoleType,
} from 'react-native-agora';
