import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get backend URL from environment
const getBackendUrl = () => {
  // Try to get from process.env first (works in web)
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  
  // Try Constants (works in native)
  if (Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL) {
    return Constants.expoConfig.extra.EXPO_PUBLIC_BACKEND_URL;
  }
  
  // Fallback based on platform
  if (Platform.OS === 'web') {
    // For web, use the current origin
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }
  
  // For native, this should be set in .env
  return '';
};

const BACKEND_URL = getBackendUrl();
console.log('Socket.IO Backend URL:', BACKEND_URL);

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(BACKEND_URL, {
          auth: { userId },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
          transports: ['websocket', 'polling'],
        });

        this.socket.on('connect', () => {
          console.log('Socket connected:', this.socket?.id);
          this.isConnected = true;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          this.isConnected = false;
        });
      } catch (error) {
        reject(error);
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

  onNewMessage(callback: (message: any) => void): void {
    if (this.socket) {
      this.socket.on('new_message', callback);
    }
  }

  onUserTyping(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('user_typing', callback);
    }
  }

  typing(conversationId: string, userId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing', {
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