import React, { useEffect, useState, useCallback } from "react";
import { Tabs, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch unread notifications count
      const notifications = await api.getNotifications();
      const unreadNotifCount = notifications?.filter?.((n: any) => !n.read)?.length || 0;
      setUnreadNotifications(unreadNotifCount);

      // Fetch unread messages count
      const conversations = await api.getConversations();
      const unreadMsgCount = conversations?.reduce?.((acc: number, conv: any) => {
        return acc + (conv.unread_count || 0);
      }, 0) || 0;
      setUnreadMessages(unreadMsgCount);
    } catch (error) {
      // Silently fail - don't show error for badge counts
      if (__DEV__) {
        console.log('Failed to fetch unread counts:', error);
      }
    }
  }, [user]);

  // Fetch counts when layout mounts and user changes
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Refresh counts every 30 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [user, fetchUnreadCounts]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarShowLabel: false,

        // Haptics on tab press
        tabBarButton: (props) => (
          <Pressable
            {...props}
            onPress={(e) => {
              Haptics.selectionAsync().catch(() => {});
              props.onPress?.(e);
            }}
          />
        ),

        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,

          // safer + cleaner sizing across devices
          height: 56 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        },

        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "search" : "search-outline"} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="music"
        options={{
          title: "Music",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "musical-notes" : "musical-notes-outline"} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="films"
        options={{
          title: "Films",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "film" : "film-outline"} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="podcasts"
        options={{
          title: "Podcasts",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "mic" : "mic-outline"} size={size} color={color} />
          ),
        }}
      />

      {/* Hidden tabs (still navigable with router.push("/(tabs)/...")) */}
      <Tabs.Screen name="messages" options={{ href: null, title: "Messages", headerShown: false }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: "Notifications", headerShown: false }} />
      <Tabs.Screen name="profile" options={{ href: null, title: "Profile", headerShown: false }} />
      <Tabs.Screen name="store" options={{ href: null, title: "Store", headerShown: false }} />
      <Tabs.Screen name="studio" options={{ href: null, title: "Studio", headerShown: false }} />
    </Tabs>
  );
}
