import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { api } from "../../services/api";
import socketService from "../../services/socket";

interface Message {
  message_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  deleted_for_everyone?: boolean;
  deleted_at?: string | null;
  is_deleted?: boolean;
  read?: boolean;
}

const NEAR_BOTTOM_PX = 120;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_MS = 60 * 60 * 1000;

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const conversationId = params.conversationId as string | undefined;
  const userId = params.userId as string | undefined;
  const otherUserId = params.otherUserId as string | undefined;
  const otherUserName = params.otherUserName as string | undefined;
  const previewParam = Array.isArray(params.preview) ? params.preview[0] : params.preview;
  const previewMode = previewParam === "deleted" || conversationId === "conv_preview";

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [otherTyping, setOtherTyping] = useState(false);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);

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
      if (previewMode) {
        const now = new Date();
        setMessages([
          {
            message_id: "preview_deleted",
            sender_id: userId || "user_123",
            content: "Message deleted",
            created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
            deleted_for_everyone: true,
            deleted_at: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
            is_deleted: true,
          },
          {
            message_id: "preview_reply",
            sender_id: otherUserId || "user_456",
            content: "New message after deletion.",
            created_at: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
          },
        ]);
        return;
      }
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

  const canEditMessage = (message: Message) => {
    if (!userId || message.sender_id !== userId) return false;
    if (message.is_deleted || message.deleted_for_everyone) return false;
    if (!message.content?.trim()) return false;
    const createdAt = new Date(message.created_at).getTime();
    if (Number.isNaN(createdAt) || !Number.isFinite(createdAt)) {
      if (__DEV__) console.warn("Invalid message timestamp", message.created_at);
      return false;
    }
    return Date.now() - createdAt <= EDIT_WINDOW_MS;
  };

  const canDeleteForEveryone = (message: Message) => {
    if (!userId || message.sender_id !== userId) return false;
    if (message.is_deleted || message.deleted_for_everyone) return false;
    if (message.read === true) return false;
    if (message.edited_at != null) return false;
    const createdAt = new Date(message.created_at).getTime();
    if (Number.isNaN(createdAt) || !Number.isFinite(createdAt)) return false;
    return Date.now() - createdAt <= DELETE_WINDOW_MS;
  };

  const handleDelete = async (message: Message, deleteForEveryone: boolean) => {
    try {
      const response = await api.deleteMessage(message.message_id, deleteForEveryone);
      if (deleteForEveryone) {
        const deletedAt = response?.deleted_at || new Date().toISOString();
        setMessages((prev) =>
          prev.map((item) =>
            item.message_id === message.message_id
              ? {
                  ...item,
                  content: "Message deleted",
                  deleted_for_everyone: true,
                  deleted_at: deletedAt,
                  is_deleted: true,
                }
              : item
          )
        );
      } else {
        setMessages((prev) => prev.filter((item) => item.message_id !== message.message_id));
      }
    } catch (error) {
      if (__DEV__) console.error("Delete message error:", error);
      Alert.alert("Unable to delete message", "Please try again.");
    }
  };

  const startEdit = (message: Message) => {
    if (!canEditMessage(message)) return;
    setEditingMessageId(message.message_id);
    setInputText(message.content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setInputText("");
  };

  useEffect(() => {
    // Initial load
    loadMessages();

    if (previewMode) {
      return () => {};
    }

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

    const offMessageEdited = socketService.onMessageEdited((updated: Message) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.message_id === updated.message_id ? { ...message, ...updated } : message
        )
      );
    });

    const offMessageDeleted = socketService.onMessageDeleted((deleted) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.message_id === deleted.message_id
            ? {
                ...message,
                content: deleted.content || "Message deleted",
                deleted_for_everyone: true,
                deleted_at: deleted.deleted_at,
                is_deleted: true,
              }
            : message
        )
      );
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
      offMessageEdited?.();
      offMessageDeleted?.();
      
      // Leave conversation
      if (conversationId && userId) {
        socketService.leaveConversation(conversationId, userId);
      }
      
      // Clear typing timeout
      if (typingStopTimeout.current) {
        clearTimeout(typingStopTimeout.current);
      }
    };
  }, [conversationId, userId, otherUserId, previewMode]);

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (editingMessageId) {
      try {
        const response = await api.editMessage(editingMessageId, trimmed);
        const missing = [];
        if (!response?.message_id) missing.push("message_id");
        if (!response?.edited_at) missing.push("edited_at");
        if (!response?.content) missing.push("content");
        if (missing.length) {
          if (__DEV__) {
            console.error("Edit response missing fields", missing);
          }
          throw new Error(`Edit response missing required fields: ${missing.join(", ")}`);
        }
        if (response.message_id !== editingMessageId) {
          throw new Error("Edit response returned unexpected message_id");
        }
        setMessages((prev) =>
          prev.map((message) =>
            message.message_id === editingMessageId
              ? {
                  ...message,
                  content: response.content,
                  edited_at: response.edited_at,
                }
              : message
          )
        );
      } catch (error) {
        if (__DEV__) console.error("Edit message error:", error);
        Alert.alert("Unable to edit message", "Please try again.");
      } finally {
        emitTyping(false);
        setEditingMessageId(null);
        setInputText("");
      }
      return;
    }

    if (!conversationId || !userId) return;

    // Stop typing immediately when sending
    emitTyping(false);

    socketService.sendMessage(conversationId, userId, trimmed);
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

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === userId;
    const editable = canEditMessage(item);
    const canDeleteEveryone = canDeleteForEveryone(item);
    const isDeleted = item.is_deleted || item.deleted_for_everyone;
    const displayContent = isDeleted ? "Message deleted" : item.content;

    const openMessageActions = () => {
      const actions: { text: string; onPress?: () => void; style?: "destructive" | "cancel" }[] = [];

      if (editable) {
        actions.push({ text: "Edit", onPress: () => startEdit(item) });
      }

      actions.push({ text: "Delete for me", style: "destructive", onPress: () => handleDelete(item, false) });

      if (canDeleteEveryone) {
        actions.push({
          text: "Delete for everyone",
          style: "destructive",
          onPress: () => handleDelete(item, true),
        });
      }

      actions.push({ text: "Cancel", style: "cancel" });
      Alert.alert("Message options", "", actions);
    };

    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
        <Pressable
          onLongPress={openMessageActions}
          accessibilityLabel="Message actions"
        >
          <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
            <Text
              style={[
                styles.messageText,
                isMe ? styles.myText : styles.theirText,
                isDeleted && styles.deletedText,
              ]}
            >
              {displayContent}
            </Text>
          </View>
        </Pressable>
        <View style={styles.timestampRow}>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          {item.edited_at && !isDeleted && (
            <Text style={styles.editedText} accessibilityLabel="Message edited">
              edited
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
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

      <View style={styles.composerContainer}>
        {editingMessageId && (
          <View style={styles.editingBanner}>
            <Text style={styles.editingText}>Editing message</Text>
            <TouchableOpacity onPress={cancelEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.editingCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={editingMessageId ? "Edit your message..." : "Type a message..."}
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
            <Ionicons name={editingMessageId ? "checkmark" : "send"} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
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
  deletedText: { fontStyle: "italic", color: Colors.textSecondary },

  timestampRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timestamp: { fontSize: 10, color: Colors.textSecondary },
  editedText: { fontSize: 10, color: Colors.textSecondary },

  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, marginTop: 16 },

  composerContainer: {
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  editingBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  editingText: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },
  editingCancel: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
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
});
