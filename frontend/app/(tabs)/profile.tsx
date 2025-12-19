import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  Switch,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const openUrl = async (url: string) => {
  const u = url.startsWith("http") ? url : `https://${url}`;
  const ok = await Linking.canOpenURL(u);
  if (ok) Linking.openURL(u);
  else Alert.alert("Invalid link", "This link can't be opened.");
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isPrivate, setIsPrivate] = useState(user?.is_private || false);
  const [website, setWebsite] = useState(user?.website || '');
  const [twitter, setTwitter] = useState(user?.twitter || '');
  const [instagram, setInstagram] = useState(user?.instagram || '');
  const [linkedin, setLinkedin] = useState(user?.linkedin || '');
  const [paypalEmail, setPaypalEmail] = useState(user?.paypal_email || '');
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadStats();
      setName(user.name);
      setBio(user.bio || '');
      setIsPrivate(user.is_private);
      setWebsite(user.website || '');
      setTwitter(user.twitter || '');
      setInstagram(user.instagram || '');
      setLinkedin(user.linkedin || '');
      setPaypalEmail(user.paypal_email || '');
    }
  }, [user]);

  const loadStats = async () => {
    try {
      if (user) {
        const data = await api.getUserStats(user.user_id);
        setStats(data);
      }
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  const handleUpdateProfile = async () => {
    if (paypalEmail.trim() && !isEmail(paypalEmail)) {
      Alert.alert("Invalid PayPal email", "Please enter a valid email address.");
      return;
    }

    try {
      await api.updateProfile({ 
        name, 
        bio, 
        is_private: isPrivate,
        website,
        twitter,
        instagram,
        linkedin,
        paypal_email: paypalEmail.trim()
      });
      await refreshUser();
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleTogglePrivacy = async (value: boolean) => {
    const prev = isPrivate;
    setIsPrivate(value);

    try {
      await api.updateProfile({ is_private: value });
      await refreshUser();
    } catch (e) {
      setIsPrivate(prev);
      Alert.alert("Error", "Failed to update privacy");
    }
  };

  const handlePremiumSubscribe = async () => {
    try {
      await api.subscribePremium();
      await refreshUser();
      setShowPremiumModal(false);
      Alert.alert('Success', 'Premium activated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to activate premium');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        onPress: async () => {
          await logout();
          router.replace('/');
        }, 
        style: 'destructive' 
      },
    ]);
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={[Colors.gradient.start, Colors.gradient.middle]}
        style={styles.header}
      >
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: user.picture || 'https://via.placeholder.com/100' }}
            style={styles.profileImage}
          />
          {user.is_premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={16} color="#fff" />
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

        {(user.website || user.twitter || user.instagram || user.linkedin) && (
          <View style={styles.socialLinks}>
            {user.website && (
              <TouchableOpacity style={styles.socialLink} onPress={() => openUrl(user.website)}>
                <Ionicons name="globe-outline" size={20} color={Colors.accent} />
                <Text style={styles.socialLinkText} numberOfLines={1}>{user.website}</Text>
              </TouchableOpacity>
            )}
            {user.twitter && (
              <TouchableOpacity style={styles.socialLink} onPress={() => openUrl(`https://twitter.com/${user.twitter}`)}>
                <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
                <Text style={styles.socialLinkText}>@{user.twitter}</Text>
              </TouchableOpacity>
            )}
            {user.instagram && (
              <TouchableOpacity style={styles.socialLink} onPress={() => openUrl(`https://instagram.com/${user.instagram}`)}>
                <Ionicons name="logo-instagram" size={20} color="#E4405F" />
                <Text style={styles.socialLinkText}>@{user.instagram}</Text>
              </TouchableOpacity>
            )}
            {user.linkedin && (
              <TouchableOpacity style={styles.socialLink} onPress={() => openUrl(user.linkedin)}>
                <Ionicons name="logo-linkedin" size={20} color="#0077B5" />
                <Text style={styles.socialLinkText}>{user.linkedin}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.posts}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setEditModalVisible(true)}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/mentions')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="at" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Mentions</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/marketplace')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="storefront" size={24} color={Colors.secondary} />
            </View>
            <Text style={styles.quickActionText}>Marketplace</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/collections')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="folder" size={24} color={Colors.accent} />
            </View>
            <Text style={styles.quickActionText}>Collections</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => router.push('/communities')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="people" size={24} color={Colors.success} />
            </View>
            <Text style={styles.quickActionText}>Communities</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        {!user.is_premium && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowPremiumModal(true)}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="star" size={24} color={Colors.accent} />
              <Text style={styles.menuItemText}>Upgrade to Premium</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="notifications" size={24} color={Colors.primary} />
            <Text style={styles.menuItemText}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="shield-checkmark" size={24} color={Colors.success} />
            <Text style={styles.menuItemText}>Privacy</Text>
          </View>
          <Switch value={isPrivate} onValueChange={handleTogglePrivacy} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="log-out" size={24} color={Colors.error} />
            <Text style={[styles.menuItemText, { color: Colors.error }]}>Logout</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={Colors.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Bio"
              placeholderTextColor={Colors.textSecondary}
              multiline
              value={bio}
              onChangeText={setBio}
            />

            <Text style={styles.sectionLabel}>Social Media Links</Text>

            <View style={styles.socialInputContainer}>
              <Ionicons name="globe-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.socialInput}
                placeholder="Website URL"
                placeholderTextColor={Colors.textSecondary}
                value={website}
                onChangeText={setWebsite}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.socialInputContainer}>
              <Ionicons name="logo-twitter" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.socialInput}
                placeholder="Twitter username (without @)"
                placeholderTextColor={Colors.textSecondary}
                value={twitter}
                onChangeText={setTwitter}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.socialInputContainer}>
              <Ionicons name="logo-instagram" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.socialInput}
                placeholder="Instagram username (without @)"
                placeholderTextColor={Colors.textSecondary}
                value={instagram}
                onChangeText={setInstagram}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.socialInputContainer}>
              <Ionicons name="logo-linkedin" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.socialInput}
                placeholder="LinkedIn profile URL or username"
                placeholderTextColor={Colors.textSecondary}
                value={linkedin}
                onChangeText={setLinkedin}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.sectionLabel}>Payment Information</Text>

            <View style={styles.paypalContainer}>
              <Ionicons name="logo-paypal" size={24} color="#003087" style={styles.inputIcon} />
              <TextInput
                style={styles.socialInput}
                placeholder="PayPal email (to receive payments)"
                placeholderTextColor={Colors.textSecondary}
                value={paypalEmail}
                onChangeText={setPaypalEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <Text style={styles.helperText}>
              Add your PayPal email to receive payments when someone buys your products
            </Text>

            <TouchableOpacity style={styles.saveButton} onPress={handleUpdateProfile}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPremiumModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPremiumModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Go Premium</Text>
              <TouchableOpacity onPress={() => setShowPremiumModal(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.premiumInfo}>
              <Ionicons name="star" size={64} color={Colors.accent} />
              <Text style={styles.premiumTitle}>Grover Premium</Text>
              <Text style={styles.premiumPrice}>$9.99/month</Text>

              <View style={styles.premiumFeatures}>
                <View style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                  <Text style={styles.featureText}>Exclusive badge</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                  <Text style={styles.featureText}>Priority support</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                  <Text style={styles.featureText}>Advanced analytics</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.subscribeButton} onPress={handlePremiumSubscribe}>
              <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  profileHeader: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  premiumBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  premiumText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 32,
    marginVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
    marginTop: 4,
  },
  editButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  editButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  premiumInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  premiumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
  },
  premiumPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 8,
  },
  premiumFeatures: {
    marginTop: 24,
    gap: 16,
    width: '100%',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: Colors.text,
  },
  subscribeButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  socialLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  socialLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  socialLinkText: {
    fontSize: 12,
    color: '#fff',
    maxWidth: 120,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  socialInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  socialInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    paddingVertical: 12,
  },
  paypalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#003087',
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
});