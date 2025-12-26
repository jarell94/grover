import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import socketService from '../../services/socket';
import {
  AGORA_AVAILABLE,
  createAgoraRtcEngine,
  RtcSurfaceView,
  ChannelProfileType,
  ClientRoleType,
} from '../../utils/agora';

const { height } = Dimensions.get('window');

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  error: '#EF4444',
  success: '#10B981',
  background: '#000000',
  surface: '#1E293B',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

const IS_WEB = Platform.OS === 'web' || !AGORA_AVAILABLE;

type JoinInfo = {
  appId: string;
  channelName: string;
  token: string;
  uid: number; // 0 allowed
};

export default function LiveStreamScreen() {
  const params = useLocalSearchParams<{
    streamId: string;
    isHost?: string;
  }>();

  const streamId = params.streamId;
  const isHost = params.isHost === 'true';

  const { user } = useAuth();

  // Stream state
  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [viewers, setViewers] = useState(0);

  // Agora state
  const engineRef = useRef<any>(null);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const joinedRef = useRef(false);

  // Controls state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  // Chat state (UI only in this file)
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [showSuperChat, setShowSuperChat] = useState(false);
  const [superChatAmount, setSuperChatAmount] = useState('5');
  const [superChatMessage, setSuperChatMessage] = useState('');

  const messagesEndRef = useRef<ScrollView>(null);

  const resolveJoinInfo = async (): Promise<JoinInfo> => {
    // Recommended: one backend endpoint returns everything needed
    const info = await api.getStreamJoinInfo(streamId);

    // Adjust these mappings to your actual backend response:
    const appId = info?.app_id || info?.appId || info?.agora_app_id;
    const channelName = info?.channel_name || info?.channelName || info?.agora_channel;
    const token = info?.token || info?.rtcToken || info?.agora_token;
    const uid = typeof info?.uid === 'number' ? info.uid : 0;

    if (!appId) throw new Error('Missing Agora app_id from server');
    if (!channelName) throw new Error('Missing channel_name from server');
    if (!token) throw new Error('Missing Agora token from server');

    return { appId, channelName, token, uid };
  };

  const cleanupAgora = useCallback(async () => {
    try {
      const eng = engineRef.current;
      engineRef.current = null;

      if (eng) {
        try {
          await eng.stopPreview?.();
        } catch {}
        try {
          await eng.leaveChannel?.();
        } catch {}
        try {
          await eng.release?.();
        } catch {}
      }
    } finally {
      joinedRef.current = false;
      setRemoteUids([]);
      setConnected(false);
    }
  }, []);

  const initAgora = useCallback(async () => {
    if (IS_WEB) {
      setConnected(true);
      return;
    }

    setConnecting(true);

    const { appId, channelName, token, uid } = await resolveJoinInfo();

    // Create & init engine
    const engine = createAgoraRtcEngine();
    engineRef.current = engine;

    engine.initialize({ appId });

    // Live broadcasting mode
    engine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);
    engine.setClientRole(
      isHost ? ClientRoleType.ClientRoleBroadcaster : ClientRoleType.ClientRoleAudience
    );

    engine.enableAudio();
    engine.enableVideo();

    // Event handlers
    engine.registerEventHandler({
      onJoinChannelSuccess: () => {
        joinedRef.current = true;
        setConnected(true);
        setConnecting(false);
      },
      onUserJoined: (_conn: any, remoteUid: number) => {
        setRemoteUids((prev) => (prev.includes(remoteUid) ? prev : [...prev, remoteUid]));
      },
      onUserOffline: (_conn: any, remoteUid: number) => {
        setRemoteUids((prev) => prev.filter((u) => u !== remoteUid));
      },
      onLeaveChannel: () => {
        joinedRef.current = false;
        setConnected(false);
        setRemoteUids([]);
      },
    });

    // Host preview (shows local video)
    if (isHost) {
      engine.startPreview?.();
    }

    // Join channel
    engine.joinChannel(token, channelName, uid, {});
  }, [isHost]);

  const initializeStream = useCallback(async () => {
    try {
      setLoading(true);

      // Load stream data (title, super chat flag, viewers count, etc.)
      const streamData = await api.getStream(streamId);
      setStream(streamData);
      setViewers(streamData?.viewers_count || 0);

      // Join stream analytics for viewers
      if (!isHost) {
        api.joinStream(streamId).catch(() => {});
      }

      // Join Socket.io room for real-time chat
      setupSocketChat();

      await initAgora();
    } catch (error: any) {
      console.error('Initialize stream error:', error);
      Alert.alert('Error', error?.message || 'Failed to load stream');
      router.back();
    } finally {
      setLoading(false);
      setConnecting(false);
    }
  }, [initAgora, isHost, streamId]);

  // Socket.io real-time chat setup
  const setupSocketChat = useCallback(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Join stream chat room
    socket.emit('join_stream_chat', { stream_id: streamId });

    // Listen for incoming messages
    socket.on('stream_chat_message', (data: any) => {
      const newMsg = {
        id: data.message_id || Date.now().toString(),
        user: data.user_name || data.username || 'Anonymous',
        text: data.text || data.message,
        timestamp: new Date(data.timestamp || Date.now()),
        isSuperChat: data.is_super_chat || false,
        amount: data.amount,
      };
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => messagesEndRef.current?.scrollToEnd({ animated: true }), 100);
    });

    // Listen for viewer count updates
    socket.on('stream_viewer_count', (data: any) => {
      if (data.stream_id === streamId) {
        setViewers(data.count || 0);
      }
    });

    // Listen for stream ended event
    socket.on('stream_ended', (data: any) => {
      if (data.stream_id === streamId && !isHost) {
        Alert.alert('Stream Ended', 'The host has ended the stream.');
        cleanupAgora();
        router.back();
      }
    });
  }, [streamId, isHost, cleanupAgora]);

  const cleanupSocketChat = useCallback(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('leave_stream_chat', { stream_id: streamId });
    socket.off('stream_chat_message');
    socket.off('stream_viewer_count');
    socket.off('stream_ended');
  }, [streamId]);

  useEffect(() => {
    initializeStream();
    return () => {
      // Important: leave analytics + agora + socket
      if (!isHost) api.leaveStream(streamId).catch(() => {});
      cleanupSocketChat();
      cleanupAgora();
    };
  }, [cleanupAgora, cleanupSocketChat, initializeStream, isHost, streamId]);

  const handleEndStream = () => {
    Alert.alert('End Stream', 'Are you sure you want to end your live stream?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Stream',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.endStream(streamId);
          } catch (e) {
            console.error('End stream error:', e);
          } finally {
            await cleanupAgora();
            router.back();
          }
        },
      },
    ]);
  };

  // =========================
  // Agora controls (real)
  // =========================
  const toggleMute = async () => {
    const next = !isMuted;
    setIsMuted(next);

    if (!IS_WEB) {
      try {
        engineRef.current?.muteLocalAudioStream?.(next);
      } catch {}
    }
  };

  const toggleVideo = async () => {
    const nextEnabled = !isVideoEnabled;
    setIsVideoEnabled(nextEnabled);

    if (!IS_WEB) {
      try {
        // muteLocalVideoStream(true) effectively stops sending video
        engineRef.current?.muteLocalVideoStream?.(!nextEnabled);
        engineRef.current?.enableLocalVideo?.(nextEnabled);
      } catch {}
    }
  };

  const switchCamera = async () => {
    if (IS_WEB) return;
    try {
      engineRef.current?.switchCamera?.();
    } catch {}
  };

  // =========================
  // Chat (UI only here)
  // =========================
  const sendMessage = () => {
    if (!messageText.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      user: user?.name || 'Anonymous',
      text: messageText.trim(),
      timestamp: new Date(),
      isSuperChat: false,
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessageText('');

    setTimeout(() => messagesEndRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendSuperChat = async () => {
    const amount = parseFloat(superChatAmount);
    if (isNaN(amount) || amount < 1) {
      Alert.alert('Error', 'Minimum Super Chat is $1');
      return;
    }

    try {
      await api.sendSuperChat(streamId, amount, superChatMessage);

      const newMessage = {
        id: Date.now().toString(),
        user: user?.name || 'Anonymous',
        text: superChatMessage || '❤️',
        amount,
        timestamp: new Date(),
        isSuperChat: true,
      };

      setMessages((prev) => [...prev, newMessage]);
      setShowSuperChat(false);
      setSuperChatMessage('');
      setSuperChatAmount('5');

      Alert.alert('Success', 'Super Chat sent!');
    } catch (error) {
      console.error('Super chat error:', error);
      Alert.alert('Error', 'Failed to send Super Chat');
    }
  };

  const renderVideoView = () => {
    // WEB fallback (no Agora)
    if (IS_WEB) {
      return (
        <LinearGradient colors={[Colors.primary, Colors.secondary]} style={styles.videoPlaceholder}>
          {connecting ? (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.connectingText}>Connecting...</Text>
            </>
          ) : (
            <>
              <Ionicons name="videocam" size={64} color="rgba(255,255,255,0.5)" />
              <Text style={styles.placeholderText}>
                {isHost ? 'Your Live Stream' : stream?.title || 'Live Stream'}
              </Text>
              <Text style={styles.placeholderSubtext}>
                Video streaming requires a native build (Expo Go / Dev Client)
              </Text>
              <View style={styles.webNotice}>
                <Ionicons name="information-circle" size={16} color="#fff" />
                <Text style={styles.webNoticeText}>Open on iOS/Android for live video</Text>
              </View>
            </>
          )}
        </LinearGradient>
      );
    }

    // Native Agora video
    const firstRemote = remoteUids[0];

    return (
      <View style={styles.agoraWrap}>
        {/* Host sees local; Viewer sees remote */}
        {isHost ? (
          <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: 0 }} />
        ) : typeof firstRemote === 'number' ? (
          <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: firstRemote }} />
        ) : (
          <LinearGradient colors={[Colors.primary, Colors.secondary]} style={styles.videoPlaceholder}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.connectingText}>Waiting for host video...</Text>
          </LinearGradient>
        )}

        {/* Optional PiP: viewer can show their own cam if you want (currently off) */}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Video View */}
      <View style={styles.videoContainer}>
        {renderVideoView()}

        {/* Top Overlay */}
        <View style={styles.topOverlay}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={async () => {
              // leave agora + viewer analytics then go back
              if (!isHost) api.leaveStream(streamId).catch(() => {});
              await cleanupAgora();
              router.back();
            }}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.streamInfo}>
            <View style={styles.liveBadge}>
              <View style={styles.liveIndicator} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <View style={styles.viewersBadge}>
              <Ionicons name="eye" size={14} color="#fff" />
              <Text style={styles.viewersText}>{viewers}</Text>
            </View>
          </View>

          {isHost && (
            <TouchableOpacity style={styles.endButton} onPress={handleEndStream}>
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Host Controls */}
        {isHost && (
          <View style={styles.hostControls}>
            <TouchableOpacity
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={toggleMute}
            >
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
              onPress={toggleVideo}
            >
              <Ionicons
                name={isVideoEnabled ? 'videocam' : 'videocam-off'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
              <Ionicons name="camera-reverse" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Small status */}
        {!IS_WEB && (
          <View style={styles.nativeStatusPill}>
            <Text style={styles.nativeStatusText}>
              {connecting ? 'Connecting…' : connected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        )}
      </View>

      {/* Chat Section */}
      <View style={styles.chatContainer}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>{stream?.title || 'Live Chat'}</Text>
          {stream?.enable_super_chat && !isHost && (
            <TouchableOpacity style={styles.superChatButton} onPress={() => setShowSuperChat(true)}>
              <Ionicons name="cash" size={16} color={Colors.primary} />
              <Text style={styles.superChatButtonText}>Super Chat</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={messagesEndRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.length === 0 ? (
            <Text style={styles.noMessages}>No messages yet. Say hi!</Text>
          ) : (
            messages.map((msg) => (
              <View
                key={msg.id}
                style={[styles.messageItem, msg.isSuperChat && styles.superChatMessage]}
              >
                {msg.isSuperChat && (
                  <View style={styles.superChatBadge}>
                    <Text style={styles.superChatAmountText}>${msg.amount}</Text>
                  </View>
                )}
                <Text style={styles.messageUser}>{msg.user}</Text>
                <Text style={styles.messageText}>{msg.text}</Text>
              </View>
            ))
          )}
        </ScrollView>

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Send a message..."
            placeholderTextColor={Colors.textSecondary}
            value={messageText}
            onChangeText={setMessageText}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Super Chat Modal */}
      {showSuperChat && (
        <View style={styles.superChatModal}>
          <View style={styles.superChatContent}>
            <View style={styles.superChatHeader}>
              <Text style={styles.superChatTitle}>Send Super Chat</Text>
              <TouchableOpacity onPress={() => setShowSuperChat(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.amountRow}>
              {['5', '10', '20', '50'].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.amountButton,
                    superChatAmount === amount && styles.amountButtonActive,
                  ]}
                  onPress={() => setSuperChatAmount(amount)}
                >
                  <Text
                    style={[styles.amountText, superChatAmount === amount && styles.amountTextActive]}
                  >
                    ${amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.superChatInput}
              placeholder="Add a message (optional)"
              placeholderTextColor={Colors.textSecondary}
              value={superChatMessage}
              onChangeText={setSuperChatMessage}
              multiline
            />

            <TouchableOpacity style={styles.sendSuperChatButton} onPress={sendSuperChat}>
              <Text style={styles.sendSuperChatText}>Send ${superChatAmount}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: { marginTop: 16, color: Colors.text, fontSize: 16 },

  videoContainer: {
    height: height * 0.45,
    backgroundColor: '#000',
    position: 'relative',
  },

  agoraWrap: { flex: 1, backgroundColor: '#000' },

  videoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  connectingText: { marginTop: 16, color: '#fff', fontSize: 16, fontWeight: '600' },
  placeholderText: { marginTop: 16, color: '#fff', fontSize: 18, fontWeight: '700' },
  placeholderSubtext: { marginTop: 8, color: 'rgba(255,255,255,0.7)', fontSize: 14 },

  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  webNoticeText: { color: '#fff', fontSize: 12 },

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  streamInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  viewersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  viewersText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  endButton: { backgroundColor: Colors.error, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  endButtonText: { color: '#fff', fontWeight: '700' },

  hostControls: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: { backgroundColor: Colors.error },

  nativeStatusPill: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  nativeStatusText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  chatContainer: { flex: 1, backgroundColor: Colors.surface },

  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  chatTitle: { color: Colors.text, fontSize: 16, fontWeight: '600', flex: 1 },

  superChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  superChatButtonText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },

  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, gap: 8 },
  noMessages: { color: Colors.textSecondary, textAlign: 'center', marginTop: 32 },

  messageItem: { backgroundColor: Colors.background, padding: 10, borderRadius: 8 },
  superChatMessage: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  superChatBadge: {
    backgroundColor: Colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  superChatAmountText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  messageUser: { color: Colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  messageText: { color: Colors.text, fontSize: 14 },

  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  superChatModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  superChatContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  superChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  superChatTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },

  amountRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  amountButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  amountButtonActive: { backgroundColor: Colors.primary },
  amountText: { color: Colors.text, fontWeight: '600' },
  amountTextActive: { color: '#fff' },

  superChatInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 14,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sendSuperChatButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendSuperChatText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
