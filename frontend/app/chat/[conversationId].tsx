import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { api } from "../../services/api";
import socketService from "../../services/socket";
import ForwardMessageModal from "../../components/ForwardMessageModal";

interface Message {
  message_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  forwarded_from?: string;
  original_sender_name?: string;
  forward_comment?: string;
  media_url?: string;
  media_type?: string;
}

const NEAR_BOTTOM_PX = 120;

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const conversationId = params.conversationId as string | undefined;
  const userId = params.userId as string | undefined;
  const otherUserId = params.otherUserId as string | undefined;
  const otherUserName = params.otherUserName as string | undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");

  const [otherTyping, setOtherTyping] = useState(false);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);

  // Forward modal state
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingStopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);

  // Keep ref in sync for use in callbacks
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const sortedMessages = useMemo(() => {
    // ensure chronological order (oldest -> newest)
    return [...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages]);

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  };

  const markRead = async () => {
    if (!conversationId) return;
    try {
      await api.markConversationRead(conversationId);
    } catch (e) {
      // non-fatal
      if (__DEV__) console.error("markConversationRead error:", e);
    }
  };

  const loadMessages = async () => {
    try {
      if (!otherUserId) return;
      const response = await api.getMessages(otherUserId);
      const list: Message[] = response?.messages || [];
      setMessages(list);

      // If user opens chat, mark read + snap to bottom once
      setTimeout(() => scrollToBottom(false), 50);
      await markRead();
      setNewMsgCount(0);
    } catch (error) {
      if (__DEV__) console.error("Load messages error:", error);
    }
  };

  useEffect(() => {
    // Initial load
    loadMessages();

    // Join conversation for sockets
    if (conversationId && userId) {
      socketService.joinConversation(conversationId, userId);
    }

    // Listen for new messages
    const offNewMessage = socketService.onNewMessage((message: Message) => {
      setMessages((prev) => {
        // Deduplicate if server sends duplicates
        if (prev.some((m) => m.message_id === message.message_id)) return prev;
        return [...prev, message];
      });

      // If user is at bottom, auto-scroll. If not, show "new messages" pill.
      setTimeout(() => {
        if (isAtBottomRef.current) {
          scrollToBottom(true);
          markRead();
          setNewMsgCount(0);
        } else {
          setNewMsgCount((c) => c + 1);
        }
      }, 50);
    });

    // Typing indicator support
    const offTyping = socketService.onTyping((payload) => {
      if (!conversationId) return;
      if (payload.conversationId !== conversationId) return;
      if (payload.userId === userId) return; // ignore myself
      setOtherTyping(payload.isTyping);
    });

    // Mark read on open
    markRead();

    return () => {
      // Cleanup listeners
      offNewMessage?.();
      offTyping?.();
      
      // Leave conversation
      if (conversationId && userId) {
        socketService.leaveConversation(conversationId, userId);
      }
      
      // Clear typing timeout
      if (typingStopTimeout.current) {
        clearTimeout(typingStopTimeout.current);
      }
    };
  }, [conversationId, userId, otherUserId]);

  const handleSend = () => {
    if (!inputText.trim() || !conversationId || !userId) return;

    // Stop typing immediately when sending
    emitTyping(false);

    socketService.sendMessage(conversationId, userId, inputText.trim());
    setInputText("");

    // Optimistic scroll if at bottom
    if (isAtBottomRef.current) {
      setTimeout(() => scrollToBottom(true), 50);
    }
  };

  const emitTyping = (isTyping: boolean) => {
    if (!conversationId || !userId) return;
    socketService.setTyping(conversationId, userId, isTyping);
  };

  const onChangeText = (text: string) => {
    setInputText(text);

    // Fire typing true
    emitTyping(true);

    // Debounce typing false after 900ms
    if (typingStopTimeout.current) clearTimeout(typingStopTimeout.current);
    typingStopTimeout.current = setTimeout(() => {
      emitTyping(false);
    }, 900);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);

    const atBottom = distanceFromBottom < NEAR_BOTTOM_PX;
    if (atBottom !== isAtBottom) setIsAtBottom(atBottom);

    // If user comes back to bottom, clear pill + mark read
    if (atBottom && newMsgCount > 0) {
      setNewMsgCount(0);
      markRead();
    }
  };

  const handleLongPress = (message: Message) => {
    Alert.alert(
      'Message Options',
      'What would you like to do?',
      [
        {
          text: 'Forward',
          onPress: () => {
            setSelectedMessage(message);
            setForwardModalVisible(true);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === userId;

    return (
      <TouchableOpacity
        style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
      >
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {/* Show forwarded indicator */}
          {item.forwarded_from && item.original_sender_name && (
            <View style={styles.forwardedHeader}>
              <Ionicons name="arrow-redo" size={12} color={Colors.textSecondary} />
              <Text style={styles.forwardedText}>
                Forwarded from @{item.original_sender_name}
              </Text>
            </View>
          )}

          {/* Show forward comment if present */}
          {item.forward_comment && (
            <Text style={[styles.forwardComment, isMe ? styles.myText : styles.theirText]}>
              {item.forward_comment}
            </Text>
          )}

          {/* Original message content */}
          {item.content && (
            <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
              {item.content}
            </Text>
          )}
        </View>
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Forward Modal */}
      <ForwardMessageModal
        visible={forwardModalVisible}
        message={selectedMessage}
        onClose={() => {
          setForwardModalVisible(false);
          setSelectedMessage(null);
        }}
        onSuccess={() => {
          // Optionally reload messages or show success
        }}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{otherUserName || "Chat"}</Text>
          {otherTyping && <Text style={styles.typingText}>typing…</Text>}
        </View>

        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={sortedMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.message_id}
        contentContainerStyle={styles.messagesList}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          // If user is at bottom, keep them at bottom as layout changes
          if (isAtBottomRef.current) scrollToBottom(false);
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No messages yet</Text>
          </View>
        }
      />

      {/* New messages pill */}
      {newMsgCount > 0 && !isAtBottom && (
        <TouchableOpacity
          style={styles.newMsgPill}
          onPress={() => {
            scrollToBottom(true);
            setNewMsgCount(0);
            markRead();
          }}
          activeOpacity={0.9}
        >
          <Ionicons name="arrow-down" size={16} color="#fff" />
          <Text style={styles.newMsgPillText}>
            {newMsgCount} new message{newMsgCount === 1 ? "" : "s"}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textSecondary}
          value={inputText}
          onChangeText={onChangeText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: Colors.text },
  typingText: { marginTop: 2, fontSize: 12, color: Colors.textSecondary },

  messagesList: { padding: 16, paddingBottom: 24 },

  messageContainer: { marginBottom: 16, maxWidth: "80%" },
  myMessage: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirMessage: { alignSelf: "flex-start", alignItems: "flex-start" },

  messageBubble: { padding: 12, borderRadius: 16, marginBottom: 4 },
  myBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: Colors.card, borderBottomLeftRadius: 4 },

  messageText: { fontSize: 14 },
  myText: { color: "#fff" },
  theirText: { color: Colors.text },

  timestamp: { fontSize: 10, color: Colors.textSecondary },

  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, marginTop: 16 },

  inputContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    maxHeight: 110,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.5 },

  newMsgPill: {
    position: "absolute",
    bottom: 86,
    alignSelf: "center",
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: `${Colors.primary}AA`,
  },
  newMsgPillText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  // Forwarded message styles
  forwardedHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    opacity: 0.7,
  },
  forwardedText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: 4,
    fontStyle: "italic",
  },
  forwardComment: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "500",
  },
});
