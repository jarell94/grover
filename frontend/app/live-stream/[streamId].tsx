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

// Agora imports - will only work on native
let createAgoraRtcEngine: any;
let RtcSurfaceView: any;
let ChannelProfileType: any;
let ClientRoleType: any;
let IRtcEngine: any;

try {
  const AgoraModule = require('react-native-agora');
  createAgoraRtcEngine = AgoraModule.createAgoraRtcEngine;
  RtcSurfaceView = AgoraModule.RtcSurfaceView;
  ChannelProfileType = AgoraModule.ChannelProfileType;
  ClientRoleType = AgoraModule.ClientRoleType;
  IRtcEngine = AgoraModule.IRtcEngine;
} catch (e) {
  console.log('Agora SDK not available - running in mock mode');
}

const { width, height } = Dimensions.get('window');

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

export default function LiveStreamScreen() {
  const params = useLocalSearchParams<{
    streamId: string;
    channelName?: string;
    isHost?: string;
    token?: string;
    uid?: string;
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
  const [agoraConfig, setAgoraConfig] = useState<any>(null);
  const [channelName, setChannelName] = useState(params.channelName || '');
  const [token, setToken] = useState(params.token || '');
  const [uid, setUid] = useState(parseInt(params.uid || '0'));
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  
  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [showSuperChat, setShowSuperChat] = useState(false);
  const [superChatAmount, setSuperChatAmount] = useState('5');
  const [superChatMessage, setSuperChatMessage] = useState('');
  
  const agoraEngineRef = useRef<any>(null);
  const messagesEndRef = useRef<ScrollView>(null);

  useEffect(() => {
    initializeStream();
    
    return () => {
      leaveChannel();
    };
  }, []);

  const initializeStream = async () => {
    try {
      setLoading(true);
      
      // Load stream data
      const streamData = await api.getStream(streamId);
      setStream(streamData);
      setViewers(streamData.viewers_count || 0);
      setChannelName(streamData.channel_name || streamId);
      
      // Get Agora config
      const config = await api.getAgoraConfig();
      setAgoraConfig(config);
      
      if (config.available && config.app_id) {
        // Get token for joining
        const role = isHost ? 'publisher' : 'subscriber';
        const tokenData = await api.getStreamToken(streamData.channel_name || streamId, role);
        
        if (tokenData.token) {
          setToken(tokenData.token);
          setUid(tokenData.uid);
          
          // Initialize Agora engine
          await initializeAgora(config.app_id, tokenData.token, streamData.channel_name, tokenData.uid);
        }
      }
      
      // Join stream (update viewer count)
      if (!isHost) {
        await api.joinStream(streamId);
      }
      
    } catch (error) {
      console.error('Initialize stream error:', error);
      Alert.alert('Error', 'Failed to load stream');
    } finally {
      setLoading(false);
    }
  };

  const initializeAgora = async (appId: string, agoraToken: string, channel: string, agoraUid: number) => {
    if (!createAgoraRtcEngine) {
      console.log('Agora SDK not available');
      setConnected(true); // Mock connected state
      return;
    }

    try {
      setConnecting(true);
      
      const engine = createAgoraRtcEngine();
      agoraEngineRef.current = engine;
      
      // Initialize engine
      engine.initialize({
        appId: appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      
      // Set up event handlers
      engine.addListener('onJoinChannelSuccess', (connection: any) => {
        console.log('Joined channel successfully');
        setConnected(true);
        setConnecting(false);
      });
      
      engine.addListener('onUserJoined', (connection: any, remoteUid: number) => {
        console.log('Remote user joined:', remoteUid);
        setRemoteUid(remoteUid);
        setViewers(v => v + 1);
      });
      
      engine.addListener('onUserOffline', (connection: any, remoteUid: number) => {
        console.log('Remote user left:', remoteUid);
        if (remoteUid === remoteUid) {
          setRemoteUid(null);
        }
        setViewers(v => Math.max(0, v - 1));
      });
      
      engine.addListener('onError', (err: any) => {
        console.error('Agora error:', err);
      });
      
      // Set client role
      const role = isHost ? ClientRoleType.ClientRoleBroadcaster : ClientRoleType.ClientRoleAudience;
      engine.setClientRole(role);
      
      // Enable video
      engine.enableVideo();
      
      if (isHost) {
        engine.startPreview();
      }
      
      // Join channel
      engine.joinChannel(agoraToken, channel, agoraUid, {
        clientRoleType: role,
        publishMicrophoneTrack: isHost,
        publishCameraTrack: isHost,
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
      });
      
    } catch (error) {
      console.error('Agora initialization error:', error);
      setConnecting(false);
      // Continue in mock mode
      setConnected(true);
    }
  };

  const leaveChannel = async () => {
    try {
      if (agoraEngineRef.current) {
        agoraEngineRef.current.leaveChannel();
        agoraEngineRef.current.release();
        agoraEngineRef.current = null;
      }
      
      if (!isHost) {
        await api.leaveStream(streamId);
      }
    } catch (error) {
      console.error('Leave channel error:', error);
    }
  };

  const handleEndStream = () => {
    Alert.alert(
      'End Stream',
      'Are you sure you want to end your live stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Stream',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.endStream(streamId);
              await leaveChannel();
              router.back();
            } catch (error) {
              console.error('End stream error:', error);
              Alert.alert('Error', 'Failed to end stream');
            }
          },
        },
      ]
    );
  };

  const toggleMute = () => {
    if (agoraEngineRef.current) {
      agoraEngineRef.current.muteLocalAudioStream(!isMuted);
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (agoraEngineRef.current) {
      agoraEngineRef.current.muteLocalVideoStream(isVideoEnabled);
    }
    setIsVideoEnabled(!isVideoEnabled);
  };

  const switchCamera = () => {
    if (agoraEngineRef.current) {
      agoraEngineRef.current.switchCamera();
    }
    setIsFrontCamera(!isFrontCamera);
  };

  const sendMessage = () => {
    if (!messageText.trim()) return;
    
    const newMessage = {
      id: Date.now().toString(),
      user: user?.name || 'Anonymous',
      text: messageText.trim(),
      timestamp: new Date(),
      isSuperChat: false,
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessageText('');
    
    // Auto scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollToEnd({ animated: true });
    }, 100);
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
        amount: amount,
        timestamp: new Date(),
        isSuperChat: true,
      };
      
      setMessages(prev => [...prev, newMessage]);
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
    // Mock video view for web/development
    if (!RtcSurfaceView || !connected) {
      return (
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          style={styles.videoPlaceholder}
        >
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
                {agoraConfig?.available ? 'Video streaming active' : 'Video preview (Agora not configured)'}
              </Text>
            </>
          )}
        </LinearGradient>
      );
    }

    // Native Agora video view
    if (isHost) {
      return (
        <RtcSurfaceView
          style={styles.videoView}
          canvas={{ uid: 0 }}
        />
      );
    } else if (remoteUid) {
      return (
        <RtcSurfaceView
          style={styles.videoView}
          canvas={{ uid: remoteUid }}
        />
      );
    }

    return (
      <View style={styles.videoPlaceholder}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.connectingText}>Waiting for host...</Text>
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
              <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
              <Ionicons name="camera-reverse" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Chat Section */}
      <View style={styles.chatContainer}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>{stream?.title || 'Live Chat'}</Text>
          {stream?.enable_super_chat && !isHost && (
            <TouchableOpacity
              style={styles.superChatButton}
              onPress={() => setShowSuperChat(true)}
            >
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
                style={[
                  styles.messageItem,
                  msg.isSuperChat && styles.superChatMessage,
                ]}
              >
                {msg.isSuperChat && (
                  <View style={styles.superChatBadge}>
                    <Text style={styles.superChatAmount}>${msg.amount}</Text>
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
                    style={[
                      styles.amountText,
                      superChatAmount === amount && styles.amountTextActive,
                    ]}
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    color: Colors.text,
    fontSize: 16,
  },
  videoContainer: {
    height: height * 0.45,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoView: {
    flex: 1,
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  placeholderSubtext: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
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
  streamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  viewersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  viewersText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  endButton: {
    backgroundColor: Colors.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  endButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
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
  controlButtonActive: {
    backgroundColor: Colors.error,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  chatTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  superChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  superChatButtonText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 8,
  },
  noMessages: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
  messageItem: {
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 8,
  },
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
  superChatAmount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  messageUser: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: {
    color: Colors.text,
    fontSize: 14,
  },
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
  superChatTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  amountButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  amountButtonActive: {
    backgroundColor: Colors.primary,
  },
  amountText: {
    color: Colors.text,
    fontWeight: '600',
  },
  amountTextActive: {
    color: '#fff',
  },
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
  sendSuperChatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
