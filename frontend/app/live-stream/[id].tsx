import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import {
  AGORA_AVAILABLE,
  createAgoraRtcEngine,
  RtcSurfaceView,
  ChannelProfileType,
  ClientRoleType,
} from "../../utils/agora";

const Colors = {
  background: "#0F172A",
  surface: "#1E293B",
  text: "#F1F5F9",
  textSecondary: "#94A3B8",
  primary: "#8B5CF6",
  secondary: "#EC4899",
  danger: "#EF4444",
  success: "#10B981",
};

const IS_WEB = Platform.OS === "web" || !AGORA_AVAILABLE;

function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function LiveStreamScreen() {
  const params = useLocalSearchParams();
  const streamId = params.id as string;

  const engineRef = useRef<any>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(true);
  const [streamInfo, setStreamInfo] = useState<any>(null);

  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const [viewerCount, setViewerCount] = useState(0);
  const [duration, setDuration] = useState(0);

  // Remote users (basic: show first remote)
  const [remoteUids, setRemoteUids] = useState<number[]>([]);

  const isBroadcaster = true; // this screen is for the host in your flow

  const channelName = useMemo(() => {
    // Adjust if your backend uses a different field name
    return streamInfo?.channel_name || streamInfo?.channel || streamInfo?.agora_channel || "";
  }, [streamInfo]);

  const appId = useMemo(() => {
    // Ideally your backend returns app_id (or you can inject via env)
    return streamInfo?.app_id || streamInfo?.agora_app_id || "";
  }, [streamInfo]);

  const cleanupAgora = async () => {
    try {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      const eng = engineRef.current;
      engineRef.current = null;

      if (eng) {
        try {
          await eng.leaveChannel();
        } catch {}
        try {
          await eng.stopPreview?.();
        } catch {}
        try {
          await eng.release?.();
        } catch {}
      }
    } catch {}
  };

  const initAgora = async (joinInfo: any) => {
    if (IS_WEB) return;

    const ch = joinInfo?.channel_name || joinInfo?.channel || joinInfo?.agora_channel;
    if (!ch) throw new Error("Missing channel name from server.");

    // Get a token from your backend (your api helper already exists)
    // role: publisher for host, subscriber for viewers
    const tokenRes = await api.getStreamToken(ch, isBroadcaster ? "publisher" : "subscriber");

    const token =
      tokenRes?.token ||
      tokenRes?.rtcToken ||
      tokenRes?.agora_token ||
      "";

    const uid =
      typeof tokenRes?.uid === "number"
        ? tokenRes.uid
        : typeof joinInfo?.uid === "number"
        ? joinInfo.uid
        : 0; // 0 = let Agora assign

    const resolvedAppId =
      tokenRes?.app_id ||
      tokenRes?.agora_app_id ||
      joinInfo?.app_id ||
      joinInfo?.agora_app_id ||
      appId;

    if (!resolvedAppId) {
      throw new Error("Missing Agora APP ID. Provide it in joinInfo/token response.");
    }
    if (!token) {
      throw new Error("Missing Agora token from server.");
    }

    const engine = createAgoraRtcEngine();
    engineRef.current = engine;

    engine.initialize({ appId: resolvedAppId });

    // Live broadcast
    engine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);

    // Broadcaster
    engine.setClientRole(
      isBroadcaster ? ClientRoleType.ClientRoleBroadcaster : ClientRoleType.ClientRoleAudience
    );

    engine.enableVideo();
    engine.enableAudio();

    // Events
    engine.registerEventHandler({
      onJoinChannelSuccess: () => {
        setJoined(true);
      },
      onUserJoined: (_connection: any, remoteUid: number) => {
        setRemoteUids((prev) => (prev.includes(remoteUid) ? prev : [...prev, remoteUid]));
        setViewerCount((c) => Math.max(0, c + 1));
      },
      onUserOffline: (_connection: any, remoteUid: number) => {
        setRemoteUids((prev) => prev.filter((u) => u !== remoteUid));
        setViewerCount((c) => Math.max(0, c - 1));
      },
      onLeaveChannel: () => {
        setJoined(false);
        setRemoteUids([]);
        setViewerCount(0);
      },
    });

    // Start local preview for broadcaster
    if (isBroadcaster) {
      engine.startPreview?.();
    }

    // Join
    engine.joinChannel(token, ch, uid, {});

    // Duration timer
    durationTimerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const info = await api.getStreamJoinInfo(streamId);
        if (!mounted) return;

        setStreamInfo(info);

        if (!IS_WEB) {
          await initAgora(info);
        } else {
          // web fallback: still start timer for UI
          durationTimerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
        }
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Failed to load stream info");
        router.back();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      cleanupAgora();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  const endStream = async () => {
    Alert.alert("End Stream", "Are you sure you want to end this stream?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Stream",
        style: "destructive",
        onPress: async () => {
          try {
            await api.endStream(streamId);
          } catch {}
          await cleanupAgora();
          router.back();
        },
      },
    ]);
  };

  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    try {
      engineRef.current?.muteLocalAudioStream?.(!next);
    } catch {}
  };

  const toggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    try {
      engineRef.current?.muteLocalVideoStream?.(!next);
      engineRef.current?.enableLocalVideo?.(next);
    } catch {}
  };

  const switchCamera = async () => {
    try {
      engineRef.current?.switchCamera?.();
    } catch {}
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Connecting to stream...</Text>
      </View>
    );
  }

  const firstRemoteUid = remoteUids[0];

  return (
    <View style={styles.container}>
      {/* Video area */}
      <View style={styles.videoArea}>
        {IS_WEB ? (
          <LinearGradient colors={[Colors.primary, Colors.secondary]} style={StyleSheet.absoluteFill}>
            <View style={styles.videoPlaceholder}>
              <Ionicons name="videocam" size={64} color="rgba(255,255,255,0.3)" />
              <Text style={styles.videoPlaceholderText}>Live Video Feed</Text>
              <Text style={styles.videoPlaceholderSubtext}>
                Live streaming is available on iOS/Android.
              </Text>
            </View>
          </LinearGradient>
        ) : (
          <>
            {/* Local video (host) */}
            <RtcSurfaceView
              style={StyleSheet.absoluteFill}
              canvas={{
                uid: 0, // local
              }}
            />

            {/* Remote video (optional picture-in-picture) */}
            {typeof firstRemoteUid === "number" && (
              <View style={styles.remotePip}>
                <RtcSurfaceView
                  style={StyleSheet.absoluteFill}
                  canvas={{ uid: firstRemoteUid }}
                />
              </View>
            )}
          </>
        )}

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={async () => {
              await cleanupAgora();
              router.back();
            }}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.liveInfo}>
            <View style={styles.livePill}>
              <View style={styles.dot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>

          <View style={styles.viewerPill}>
            <Ionicons name="eye" size={14} color="#fff" />
            <Text style={styles.viewerText}>{viewerCount}</Text>
          </View>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.controlBtn, !micOn && styles.controlBtnOff]}
            onPress={toggleMic}
            disabled={IS_WEB}
          >
            <Ionicons name={micOn ? "mic" : "mic-off"} size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, !camOn && styles.controlBtnOff]}
            onPress={toggleCam}
            disabled={IS_WEB}
          >
            <Ionicons name={camOn ? "videocam" : "videocam-off"} size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={switchCamera} disabled={IS_WEB}>
            <Ionicons name="camera-reverse" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.endBtn} onPress={endStream}>
            <Ionicons name="square" size={18} color="#fff" />
            <Text style={styles.endText}>End</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stream info */}
      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Text style={styles.metaTitle}>{streamInfo?.title || "Live Stream"}</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{IS_WEB ? "Preview" : joined ? "Broadcasting" : "Connecting"}</Text>
          </View>
        </View>

        {streamInfo?.description ? (
          <Text style={styles.metaDescription}>{streamInfo.description}</Text>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.statText}>{formatDuration(duration)}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.statText}>{viewerCount} viewers</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="radio-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.statText}>{channelName ? `#${channelName}` : "Channel"}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: "center", alignItems: "center" },
  loadingText: { color: Colors.textSecondary, marginTop: 16, fontSize: 16 },

  videoArea: { flex: 1, position: "relative", backgroundColor: "#000" },

  videoPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  videoPlaceholderText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  videoPlaceholderSubtext: { color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 },

  remotePip: {
    position: "absolute",
    right: 12,
    bottom: 110,
    width: 120,
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "#000",
  },

  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  liveInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  liveText: { color: "#fff", fontWeight: "800", letterSpacing: 1 },
  durationText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  viewerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  viewerText: { color: "#fff", fontWeight: "600" },

  bottomBar: {
    position: "absolute",
    bottom: 24,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlBtnOff: { backgroundColor: "rgba(239,68,68,0.5)" },

  endBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.danger,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
  },
  endText: { color: "#fff", fontWeight: "900" },

  meta: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: Colors.surface,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  metaTitle: { color: Colors.text, fontWeight: "800", fontSize: 18, flex: 1 },
  metaDescription: { color: Colors.textSecondary, fontSize: 14, marginBottom: 12 },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.success + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  statusText: { color: Colors.success, fontWeight: "600", fontSize: 12 },

  statsRow: { flexDirection: "row", gap: 20 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statText: { color: Colors.textSecondary, fontSize: 14 },
});
