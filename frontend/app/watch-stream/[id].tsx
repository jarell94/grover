import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { api } from '../../services/api';
import socketService from '../../services/socket';

// Import Agora utilities (platform-specific)
import { createAgoraEngine, AgoraView } from '../../utils/agora';

const Colors = {
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  primary: '#8B5CF6',
  secondary: '#EC4899',
  danger: '#EF4444',
  success: '#10B981',
  accent: '#FBBF24',
};

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';

type ChatMsg = {
  id: string;
  userId: string;
  name: string;
  text: string;
  createdAt: string;
  type?: 'chat' | 'like' | 'gift' | 'superchat';
  amount?: number;
  giftId?: string;
};

const GIFTS = [
  { id: 'rose', name: 'Rose', price: 1, icon: '🌹' },
  { id: 'fire', name: 'Fire', price: 5, icon: '🔥' },
  { id: 'crown', name: 'Crown', price: 20, icon: '👑' },
  { id: 'rocket', name: 'Rocket', price: 50, icon: '🚀' },
  { id: 'diamond', name: 'Diamond', price: 100, icon: '💎' },
];

export default function WatchStreamScreen() {
  const params = useLocalSearchParams();
  const streamId = params.id as string;

  // Agora engine ref (will be null on web)
  const engineRef = useRef<any>(null);

  // Stream join info from backend
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [token, setToken] = useState('');
  const [uid, setUid] = useState<number>(0);

  // Host info from backend
  const [hostUid, setHostUid] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('Live Stream');
  const [hostName, setHostName] = useState<string>('Host');

  // Realtime state
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState('');

  // UI state
  const [chatOpen, setChatOpen] = useState(true);
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [superChatModalOpen, setSuperChatModalOpen] = useState(false);
  const [superChatAmount, setSuperChatAmount] = useState('5');
  const [superChatMsg, setSuperChatMsg] = useState('');

  const [joined, setJoined] = useState(false);

  const hasCreds = useMemo(
    () => !!channelName && !!token && !!uid,
    [channelName, token, uid]
  );

  // ---------- Load stream info from backend ----------
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        // Backend returns: { channelName, token, uid, hostUid, title, hostName, viewerCount, likeCount, recentChat }
        const joinInfo = await api.getStreamJoinInfo(streamId);

        if (!mounted) return;

        setChannelName(joinInfo.channelName || '');
        setToken(joinInfo.token || '');
        setUid(Number(joinInfo.uid) || 0);

        // Host UID is critical - backend should provide this
        if (joinInfo.hostUid != null) setHostUid(Number(joinInfo.hostUid));

        if (joinInfo.title) setTitle(joinInfo.title);
        if (joinInfo.hostName) setHostName(joinInfo.hostName);
        if (typeof joinInfo.viewerCount === 'number') setViewerCount(joinInfo.viewerCount);
        if (typeof joinInfo.likeCount === 'number') setLikeCount(joinInfo.likeCount);
        if (Array.isArray(joinInfo.recentChat)) setChat(joinInfo.recentChat);
      } catch (e) {
        console.error('Load stream info error:', e);
        Alert.alert('Error', 'Failed to load stream');
        router.back();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [streamId]);

  // ---------- Initialize Agora Engine (Native only) ----------
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Agora RTC not supported on web - use placeholder
      return;
    }

    const initAgora = async () => {
      try {
        const engine = createAgoraEngine();
        if (!engine) return;

        engineRef.current = engine;

        // Initialize with Live Broadcasting profile
        engine.initialize({
          appId: AGORA_APP_ID,
          // IMPORTANT: Use Live Broadcasting for live streams
          channelProfile: 1, // ChannelProfileType.ChannelProfileLiveBroadcasting
        });

        // Enable video
        engine.enableVideo();

        // IMPORTANT: Set client role to AUDIENCE for viewers
        engine.setClientRole(2); // ClientRoleType.ClientRoleAudience

        // Register event handlers
        engine.registerEventHandler({
          onJoinChannelSuccess: () => {
            console.log('Joined channel successfully');
            setJoined(true);
          },
          onLeaveChannel: () => {
            console.log('Left channel');
            setJoined(false);
          },
          // Host video appears as remote user for audience
          onUserJoined: (_connection: any, remoteUid: number) => {
            console.log('Remote user joined:', remoteUid);
            // If backend provided hostUid, use that; otherwise first remote is likely host
            if (hostUid == null) {
              setHostUid(remoteUid);
            }
          },
          // IMPORTANT: If host leaves, viewers should exit
          onUserOffline: (_connection: any, remoteUid: number, reason: number) => {
            console.log('Remote user offline:', remoteUid, reason);
            if (hostUid != null && remoteUid === hostUid) {
              Alert.alert('Stream Ended', 'The host has ended the stream.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            }
          },
          onError: (err: number, msg: string) => {
            console.error('Agora error:', err, msg);
          },
        });
      } catch (e) {
        console.error('Agora init error:', e);
      }
    };

    initAgora();

    return () => {
      try {
        engineRef.current?.leaveChannel();
        engineRef.current?.release();
        engineRef.current = null;
      } catch {}
    };
  }, [hostUid]);

  // ---------- Join Agora channel when credentials are ready ----------
  useEffect(() => {
    if (!hasCreds || joined || Platform.OS === 'web') return;

    const joinChannel = async () => {
      if (!engineRef.current) return;

      setJoining(true);
      try {
        // Join as audience
        engineRef.current.joinChannel(token, channelName, uid, {
          clientRoleType: 2, // ClientRoleType.ClientRoleAudience
        });

        // Join socket room for chat/likes/gifts
        socketService.emit('stream:join', { streamId });
        socketService.emit('stream:sync', { streamId });
      } catch (e) {
        console.error('Join channel error:', e);
        Alert.alert('Error', 'Failed to join stream');
      } finally {
        setJoining(false);
      }
    };

    joinChannel();
  }, [hasCreds, joined, token, channelName, uid, streamId]);

  // ---------- Socket listeners for real-time updates ----------
  useEffect(() => {
    const onViewerCount = (payload: { streamId: string; count: number }) => {
      if (payload.streamId === streamId) setViewerCount(payload.count);
    };

    const onLikes = (payload: { streamId: string; likes: number }) => {
      if (payload.streamId === streamId) setLikeCount(payload.likes);
    };

    const onChat = (msg: ChatMsg & { streamId: string }) => {
      if (msg.streamId !== streamId) return;
      setChat((prev) => [msg, ...prev].slice(0, 200));
    };

    const onEnded = (payload: { streamId: string }) => {
      if (payload.streamId !== streamId) return;
      Alert.alert('Stream Ended', 'The host ended the stream.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    };

    socketService.on('stream:viewers', onViewerCount);
    socketService.on('stream:likes', onLikes);
    socketService.on('stream:chat', onChat);
    socketService.on('stream:ended', onEnded);

    // Join socket room on web (since Agora won't join)
    if (Platform.OS === 'web' && !loading) {
      socketService.emit('stream:join', { streamId });
      setJoined(true);
    }

    return () => {
      socketService.off('stream:viewers', onViewerCount);
      socketService.off('stream:likes', onLikes);
      socketService.off('stream:chat', onChat);
      socketService.off('stream:ended', onEnded);
      socketService.emit('stream:leave', { streamId });
    };
  }, [streamId, loading]);

  // ---------- Actions ----------
  const sendChat = async () => {
    const text = chatText.trim();
    if (!text) return;

    setChatText('');

    const optimistic: ChatMsg = {
      id: `optimistic_${Date.now()}`,
      userId: 'me',
      name: 'You',
      text,
      createdAt: new Date().toISOString(),
      type: 'chat',
    };
    setChat((prev) => [optimistic, ...prev].slice(0, 200));

    try {
      await api.sendStreamChat(streamId, { text });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to send message');
      setChat((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  const like = async () => {
    setLikeCount((p) => p + 1);
    try {
      await api.likeStream(streamId);
    } catch (e) {
      console.error(e);
      setLikeCount((p) => Math.max(0, p - 1));
    }
  };

  const sendGift = async (giftId: string) => {
    const gift = GIFTS.find((g) => g.id === giftId);
    setGiftModalOpen(false);

    setChat((prev) =>
      [
        {
          id: `optimistic_gift_${Date.now()}`,
          userId: 'me',
          name: 'You',
          text: `sent a ${gift?.name}!`,
          createdAt: new Date().toISOString(),
          type: 'gift',
          giftId,
        },
        ...prev,
      ].slice(0, 200)
    );

    try {
      await api.sendStreamGift(streamId, { giftId });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gift failed');
    }
  };

  const sendSuperChat = async () => {
    const amount = Number(superChatAmount);
    const message = superChatMsg.trim();

    if (!amount || amount < 1) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    if (!message) {
      Alert.alert('Error', 'Add a message for Super Chat');
      return;
    }

    setSuperChatModalOpen(false);
    setSuperChatMsg('');

    setChat((prev) =>
      [
        {
          id: `optimistic_superchat_${Date.now()}`,
          userId: 'me',
          name: 'You',
          text: message,
          createdAt: new Date().toISOString(),
          type: 'superchat',
          amount,
        },
        ...prev,
      ].slice(0, 200)
    );

    try {
      await api.sendStreamSuperChat(streamId, { amount, message });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Super Chat failed');
    }
  };

  const leave = () => {
    engineRef.current?.leaveChannel();
    router.back();
  };

  // ---------- Render video area ----------
  const renderVideo = () => {
    // On web, show placeholder
    if (Platform.OS === 'web') {
      return (
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          style={styles.videoPlaceholder}
        >
          <Ionicons name="videocam" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.videoText}>Live Video Feed</Text>
          <Text style={styles.videoSubtext}>
            Video requires native app (Expo Go or dev build)
          </Text>
        </LinearGradient>
      );
    }

    // On native, show Agora view or waiting state
    if (hostUid != null) {
      return (
        <AgoraView
          style={StyleSheet.absoluteFill}
          uid={hostUid}
        />
      );
    }

    return (
      <View style={[styles.videoPlaceholder, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.videoText}>Waiting for host video...</Text>
      </View>
    );
  };

  const renderChatItem = ({ item }: { item: ChatMsg }) => {
    const isSuperChat = item.type === 'superchat';
    const isGift = item.type === 'gift';

    return (
      <View style={[styles.chatRow, isSuperChat && styles.superChatRow]}>
        <Text style={styles.chatName}>
          {item.name}
          {isSuperChat && (
            <Text style={{ color: Colors.accent }}> ${item.amount}</Text>
          )}
          {isGift && (
            <Text style={{ color: Colors.secondary }}>
              {' '}
              {GIFTS.find((g) => g.id === item.giftId)?.icon ?? '🎁'}
            </Text>
          )}
          :{' '}
        </Text>
        <Text style={styles.chatText}>{item.text}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Joining stream...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video area */}
      <View style={styles.videoWrap}>
        {renderVideo()}

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={leave} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subTitle} numberOfLines={1}>
              {hostName} • {viewerCount} watching
            </Text>
          </View>

          <View style={styles.livePill}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Right action rail */}
        <View style={styles.rightRail}>
          <TouchableOpacity style={styles.railBtn} onPress={like}>
            <Ionicons name="heart" size={22} color={Colors.secondary} />
            <Text style={styles.railText}>{likeCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.railBtn} onPress={() => setGiftModalOpen(true)}>
            <Ionicons name="gift" size={22} color="#fff" />
            <Text style={styles.railText}>Gifts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.railBtn} onPress={() => setSuperChatModalOpen(true)}>
            <Ionicons name="cash" size={22} color={Colors.success} />
            <Text style={styles.railText}>Super</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.railBtn} onPress={() => setChatOpen((p) => !p)}>
            <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
            <Text style={styles.railText}>{chatOpen ? 'Hide' : 'Chat'}</Text>
          </TouchableOpacity>
        </View>

        {/* Chat overlay */}
        {chatOpen && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
            style={styles.chatOverlay}
          >
            <FlatList
              data={chat}
              keyExtractor={(m) => m.id}
              renderItem={renderChatItem}
              inverted
              contentContainerStyle={{ padding: 10 }}
              style={styles.chatList}
            />

            <View style={styles.chatInputRow}>
              <TextInput
                value={chatText}
                onChangeText={setChatText}
                placeholder="Say something..."
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={styles.chatInput}
              />
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={sendChat}
                disabled={!chatText.trim()}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* Joining overlay */}
        {joining && (
          <View style={styles.joiningOverlay}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: '#fff', marginTop: 10, fontWeight: '700' }}>
              Joining...
            </Text>
          </View>
        )}
      </View>

      {/* Gift Modal */}
      <Modal
        visible={giftModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGiftModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setGiftModalOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send a Gift</Text>
            {GIFTS.map((g) => (
              <TouchableOpacity key={g.id} style={styles.giftRow} onPress={() => sendGift(g.id)}>
                <Text style={styles.giftIcon}>{g.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.giftName}>{g.name}</Text>
                  <Text style={styles.giftPrice}>${g.price}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Super Chat Modal */}
      <Modal
        visible={superChatModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSuperChatModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSuperChatModalOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Super Chat</Text>
            <Text style={styles.modalSubtitle}>
              Highlight your message with a donation
            </Text>

            <View style={styles.superRow}>
              <Text style={styles.superLabel}>Amount</Text>
              <View style={styles.superAmountRow}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>$</Text>
                <TextInput
                  value={superChatAmount}
                  onChangeText={setSuperChatAmount}
                  keyboardType="number-pad"
                  style={styles.superAmountInput}
                  placeholder="5"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                />
              </View>
            </View>

            <TextInput
              value={superChatMsg}
              onChangeText={setSuperChatMsg}
              placeholder="Your message..."
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.superMsg}
              multiline
              maxLength={200}
            />

            <TouchableOpacity style={styles.superSend} onPress={sendSuperChat}>
              <Ionicons name="cash" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '900' }}>Send Super Chat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textSecondary, marginTop: 16, fontSize: 16 },

  videoWrap: { flex: 1, backgroundColor: '#000', position: 'relative' },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  videoSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: { flex: 1 },
  title: { color: '#fff', fontWeight: '900', fontSize: 14 },
  subTitle: { color: 'rgba(255,255,255,0.75)', marginTop: 2, fontSize: 12 },

  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },

  rightRail: {
    position: 'absolute',
    right: 12,
    bottom: 140,
    gap: 14,
    alignItems: 'center',
  },
  railBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  railText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  chatOverlay: {
    position: 'absolute',
    left: 12,
    right: 86,
    bottom: 24,
    height: 240,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  chatList: { flex: 1 },
  chatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  superChatRow: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 8,
    padding: 6,
    marginBottom: 8,
  },
  chatName: { color: '#fff', fontWeight: '900' },
  chatText: { color: 'rgba(255,255,255,0.92)' },

  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  chatInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    color: '#fff',
  },
  sendBtn: {
    width: 44,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  joiningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { color: '#fff', fontWeight: '900', fontSize: 18, marginBottom: 4 },
  modalSubtitle: { color: Colors.textSecondary, fontSize: 14, marginBottom: 16 },

  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  giftIcon: { fontSize: 28 },
  giftName: { color: '#fff', fontWeight: '800', fontSize: 16 },
  giftPrice: { color: Colors.textSecondary, marginTop: 2, fontSize: 12 },

  superRow: { marginBottom: 12 },
  superLabel: { color: Colors.textSecondary, fontWeight: '800', marginBottom: 6 },
  superAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  superAmountInput: { flex: 1, color: '#fff', fontWeight: '900', fontSize: 18 },
  superMsg: {
    minHeight: 80,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: '#fff',
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  superSend: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
