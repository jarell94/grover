import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../services/api';

const Colors = {
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  primary: '#8B5CF6',
  secondary: '#EC4899',
  danger: '#EF4444',
  success: '#10B981',
};

export default function LiveStreamScreen() {
  const params = useLocalSearchParams();
  const streamId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let mounted = true;
    let durationInterval: NodeJS.Timeout;

    const init = async () => {
      try {
        setLoading(true);
        const data = await api.getStreamJoinInfo(streamId);

        if (!mounted) return;
        setStreamInfo(data);
        setJoined(true);
        
        // Start duration timer
        durationInterval = setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load stream info');
        router.back();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();
    
    return () => {
      mounted = false;
      if (durationInterval) clearInterval(durationInterval);
    };
  }, [streamId]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const endStream = async () => {
    Alert.alert('End Stream', 'Are you sure you want to end this stream?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Stream',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.endStream(streamId);
          } catch {}
          router.back();
        },
      },
    ]);
  };

  const toggleMic = () => {
    setMicOn((p) => !p);
    // In real implementation: engineRef.current?.muteLocalAudioStream(!micOn);
  };

  const toggleCam = () => {
    setCamOn((p) => !p);
    // In real implementation: engineRef.current?.muteLocalVideoStream(!camOn);
  };

  const switchCamera = () => {
    // In real implementation: engineRef.current?.switchCamera();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Connecting to stream...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video area - placeholder gradient */}
      <LinearGradient
        colors={[Colors.primary, Colors.secondary]}
        style={styles.videoArea}
      >
        <View style={styles.videoPlaceholder}>
          <Ionicons name="videocam" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.videoPlaceholderText}>Live Video Feed</Text>
          <Text style={styles.videoPlaceholderSubtext}>
            Agora SDK required for real video
          </Text>
        </View>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
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
          >
            <Ionicons name={micOn ? 'mic' : 'mic-off'} size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, !camOn && styles.controlBtnOff]}
            onPress={toggleCam}
          >
            <Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
            <Ionicons name="camera-reverse" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.endBtn} onPress={endStream}>
            <Ionicons name="square" size={18} color="#fff" />
            <Text style={styles.endText}>End</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stream info */}
      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Text style={styles.metaTitle}>{streamInfo?.title || 'Live Stream'}</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Broadcasting</Text>
          </View>
        </View>
        
        {streamInfo?.description && (
          <Text style={styles.metaDescription}>{streamInfo.description}</Text>
        )}

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
            <Ionicons name="chatbubbles-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.statText}>Chat</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textSecondary, marginTop: 16, fontSize: 16 },

  videoArea: { flex: 1, position: 'relative' },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  videoPlaceholderSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 8,
  },

  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  liveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontWeight: '800', letterSpacing: 1 },
  durationText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  viewerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  viewerText: { color: '#fff', fontWeight: '600' },

  bottomBar: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },

  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnOff: {
    backgroundColor: 'rgba(239,68,68,0.5)',
  },

  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.danger,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
  },
  endText: { color: '#fff', fontWeight: '900' },

  meta: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: Colors.surface,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaTitle: { color: Colors.text, fontWeight: '800', fontSize: 18, flex: 1 },
  metaDescription: { color: Colors.textSecondary, fontSize: 14, marginBottom: 12 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  statusText: { color: Colors.success, fontWeight: '600', fontSize: 12 },

  statsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { color: Colors.textSecondary, fontSize: 14 },
});
