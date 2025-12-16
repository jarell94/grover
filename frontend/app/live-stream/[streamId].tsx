import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

const Colors = {
  primary: '#8B5CF6',
  error: '#EF4444',
  background: '#000000',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export default function LiveStreamScreen() {
  const params = useLocalSearchParams();
  const { streamId, isHost } = params;
  const { user } = useAuth();
  
  const [stream, setStream] = useState<any>(null);
  const [viewers, setViewers] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [showSuperChat, setShowSuperChat] = useState(false);
  const [superChatAmount, setSuperChatAmount] = useState('5');
  const [superChatMessage, setSuperChatMessage] = useState('');
  
  const messagesEndRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadStream();
    // Simulate viewer count updates
    const interval = setInterval(() => {
      setViewers(v => v + Math.floor(Math.random() * 3) - 1);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadStream = async () => {
    try {
      const data = await api.getStream(streamId as string);
      setStream(data);
      setViewers(data.viewers_count || 0);
    } catch (error) {
      console.error('Load stream error:', error);
      Alert.alert('Error', 'Failed to load stream');
    }
  };

  const handleEndStream = async () => {
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
              await api.endStream(streamId as string);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to end stream');
            }
          },
        },
      ]
    );
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    
    const newMessage = {
      id: Date.now().toString(),
      user: user?.name || 'You',
      text: messageText,
      timestamp: new Date(),
    };
    
    setMessages([...messages, newMessage]);
    setMessageText('');
    messagesEndRef.current?.scrollToEnd({ animated: true });
  };

  const handleSendSuperChat = async () => {
    const amount = parseFloat(superChatAmount);
    if (isNaN(amount) || amount < 1) {
      Alert.alert('Error', 'Please enter a valid amount ($1 minimum)');
      return;
    }
    
    if (!superChatMessage.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    try {
      await api.sendSuperChat(streamId as string, amount, superChatMessage);
      
      const newMessage = {
        id: Date.now().toString(),
        user: user?.name || 'You',
        text: superChatMessage,
        amount: amount,
        isSuperChat: true,
        timestamp: new Date(),
      };
      
      setMessages([...messages, newMessage]);
      setSuperChatMessage('');
      setSuperChatAmount('5');
      setShowSuperChat(false);
      Alert.alert('Success', 'Super Chat sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send Super Chat');
    }
  };

  if (!stream) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Video Placeholder (In production, this would be Agora RtcSurfaceView) */}
      <View style={styles.videoContainer}>
        <LinearGradient
          colors={['#1F2937', '#111827']}
          style={styles.videoPlaceholder}
        >
          <Ionicons name="videocam" size={80} color="rgba(255, 255, 255, 0.2)" />
          <Text style={styles.placeholderText}>
            {isHost === 'true' ? 'Your Camera Feed' : 'Live Stream'}
          </Text>
          <Text style={styles.placeholderSubtext}>
            Agora Video SDK integration required
          </Text>
        </LinearGradient>

        {/* Stream Info Overlay */}
        <View style={styles.topOverlay}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          
          <View style={styles.viewersContainer}>
            <Ionicons name="eye" size={16} color="#fff" />
            <Text style={styles.viewersText}>{viewers}</Text>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stream Title */}
        <View style={styles.bottomOverlay}>
          <View style={styles.streamInfo}>
            <Text style={styles.streamTitle}>{stream.title}</Text>
            <Text style={styles.streamerName}>{stream.user?.name}</Text>
          </View>

          {isHost === 'true' && (
            <TouchableOpacity style={styles.endStreamButton} onPress={handleEndStream}>
              <Text style={styles.endStreamText}>End Stream</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chat Section */}
      <View style={styles.chatContainer}>
        <ScrollView 
          ref={messagesEndRef}
          style={styles.messagesContainer}
          onContentSizeChange={() => messagesEndRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={[
              styles.message,
              msg.isSuperChat && styles.superChatMessage
            ]}>
              {msg.isSuperChat && (
                <View style={styles.superChatBadge}>
                  <Ionicons name="cash" size={14} color="#FFD700" />
                  <Text style={styles.superChatAmount}>${msg.amount}</Text>
                </View>
              )}
              <Text style={styles.messageUser}>{msg.user}</Text>
              <Text style={styles.messageText}>{msg.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Send a message..."
            placeholderTextColor={Colors.textSecondary}
            value={messageText}
            onChangeText={setMessageText}
            onSubmitEditing={handleSendMessage}
          />
          
          <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
            <Ionicons name="send" size={20} color={Colors.primary} />
          </TouchableOpacity>

          {stream.enable_super_chat && (
            <TouchableOpacity 
              style={styles.superChatButton}
              onPress={() => setShowSuperChat(!showSuperChat)}
            >
              <Ionicons name="cash" size={20} color="#FFD700" />
            </TouchableOpacity>
          )}
        </View>

        {/* Super Chat Input */}
        {showSuperChat && (
          <View style={styles.superChatInput}>
            <Text style={styles.superChatTitle}>Send a Super Chat</Text>
            <View style={styles.superChatRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="5"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
                value={superChatAmount}
                onChangeText={setSuperChatAmount}
              />
            </View>
            <TextInput
              style={styles.superChatMessageInput}
              placeholder="Your message..."
              placeholderTextColor={Colors.textSecondary}
              value={superChatMessage}
              onChangeText={setSuperChatMessage}
              multiline
            />
            <View style={styles.superChatActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowSuperChat(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sendSuperChatButton}
                onPress={handleSendSuperChat}
              >
                <Text style={styles.sendSuperChatText}>Send ${superChatAmount}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  videoContainer: {
    width: width,
    height: height * 0.5,
    position: 'relative',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  topOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  viewersText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  streamInfo: {
    flex: 1,
  },
  streamTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  streamerName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  endStreamButton: {
    backgroundColor: Colors.error,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  endStreamText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#1F2937',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  message: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  superChatMessage: {
    backgroundColor: '#FFD700',
    borderWidth: 2,
    borderColor: '#FFA500',
  },
  superChatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  superChatAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  messageUser: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  superChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  superChatInput: {
    backgroundColor: '#111827',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#FFD700',
  },
  superChatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
    marginBottom: 12,
  },
  superChatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  superChatMessageInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 60,
    marginBottom: 12,
  },
  superChatActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sendSuperChatButton: {
    flex: 2,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFD700',
    alignItems: 'center',
  },
  sendSuperChatText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
});
