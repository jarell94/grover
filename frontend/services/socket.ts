import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get backend URL from environment
const getBackendUrl = () => {
  // For web, use the current origin (same domain)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Try to get from process.env (works in web build)
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) {
    const url = process.env.EXPO_PUBLIC_BACKEND_URL;
    // Skip if it contains REPLACEME placeholder
    if (!url.includes('REPLACEME')) {
      return url;
    }
  }
  
  // Try Constants (works in native)
  if (Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL) {
    const url = Constants.expoConfig.extra.EXPO_PUBLIC_BACKEND_URL;
    if (!url.includes('REPLACEME')) {
      return url;
    }
  }
  
  // Final fallback for web
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // For native, this should be set in .env
  return '';
};

const BACKEND_URL = getBackendUrl();
console.log('Socket.IO Backend URL:', BACKEND_URL);

interface MessageEditedPayload {
  message_id: string;
  conversation_id?: string;
  sender_id?: string;
  content?: string;
  created_at?: string;
  edited_at?: string | null;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Only attempt connection if BACKEND_URL is valid
        if (!BACKEND_URL || BACKEND_URL === '') {
          console.warn('Socket.IO: No backend URL configured, skipping connection');
          resolve(); // Resolve instead of rejecting to not break the app
          return;
        }

        // Disconnect existing connection if any
        if (this.socket) {
          this.socket.disconnect();
        }

        this.socket = io(BACKEND_URL, {
          auth: { userId },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
          transports: ['websocket', 'polling'],
          timeout: 10000,
          path: '/socket.io/',
        });

        this.socket.on('connect', () => {
          console.log('✅ Socket connected:', this.socket?.id);
          this.isConnected = true;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Socket connection error:', error.message);
          // Don't reject - just log the error and continue
          // This prevents the app from breaking if socket fails
          this.isConnected = false;
          resolve(); // Resolve instead of reject
        });

        this.socket.on('disconnect', (reason) => {
          console.log('🔌 Socket disconnected:', reason);
          this.isConnected = false;
        });

        this.socket.on('error', (error) => {
          console.error('⚠️ Socket error:', error);
        });

        // Auto-resolve after timeout to not block the app
        setTimeout(() => {
          if (!this.isConnected) {
            console.warn('⏱️ Socket connection timeout - continuing without real-time features');
            resolve();
          }
        }, 10000);

      } catch (error) {
        console.error('Socket initialization error:', error);
        resolve(); // Don't break the app
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }

  joinConversation(conversationId: string, userId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_conversation', {
        conversation_id: conversationId,
        user_id: userId,
      });
    }
  }

  sendMessage(conversationId: string, senderId: string, content: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('send_message', {
        conversation_id: conversationId,
        sender_id: senderId,
        content: content,
      });
    }
  }

  onNewMessage(callback: (message: any) => void): () => void {
    if (this.socket) {
      this.socket.on('new_message', callback);
      return () => {
        this.socket?.off('new_message', callback);
      };
    }
    return () => {};
  }

  onMessageEdited(callback: (message: MessageEditedPayload) => void): () => void {
    if (this.socket) {
      this.socket.on('message_edited', callback);
      return () => {
        this.socket?.off('message_edited', callback);
      };
    }
    return () => {};
  }

  onUserTyping(callback: (data: any) => void): () => void {
    if (this.socket) {
      this.socket.on('user_typing', callback);
      return () => {
        this.socket?.off('user_typing', callback);
      };
    }
    return () => {};
  }

  onTyping(callback: (payload: { conversationId: string; userId: string; isTyping: boolean }) => void): () => void {
    if (this.socket) {
      this.socket.on('typing_update', callback);
      return () => {
        this.socket?.off('typing_update', callback);
      };
    }
    return () => {};
  }

  typing(conversationId: string, userId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing', {
        conversation_id: conversationId,
        user_id: userId,
      });
    }
  }

  setTyping(conversationId: string, userId: string, isTyping: boolean): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_set', {
        conversation_id: conversationId,
        user_id: userId,
        is_typing: isTyping,
      });
    }
  }

  leaveConversation(conversationId: string, userId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_conversation', {
        conversation_id: conversationId,
        user_id: userId,
      });
    }
  }

  isConnectedToSocket(): boolean {
    return this.isConnected;
  }
}

export default new SocketService();
