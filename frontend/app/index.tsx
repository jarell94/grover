import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [loggingIn, setLoggingIn] = React.useState(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    console.log('Index useEffect - loading:', loading, 'user:', user?.email || 'null', 'hasNavigated:', hasNavigated.current);
    if (!loading && user && !hasNavigated.current) {
      console.log('Navigating to tabs...');
      hasNavigated.current = true;
      router.replace('/(tabs)');
    }
  }, [user, loading, router]);

  const handleGoogleSignUp = async () => {
    try {
      setLoggingIn(true);
      console.log('Starting signup...');
      await login({ mode: 'signup' });
      console.log('Signup completed');
    } catch (error) {
      console.error('Signup failed:', error);
      Alert.alert('Sign up failed', 'Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoggingIn(true);
      console.log('Starting signin...');
      await login({ mode: 'signin' });
      console.log('Signin completed');
    } catch (error) {
      console.error('Signin failed:', error);
      Alert.alert('Sign in failed', 'Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.gradient.start, Colors.gradient.middle, Colors.gradient.end]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Ionicons name="sparkles" size={80} color="#fff" />
            <Text style={styles.title}>Grover</Text>
            <Text style={styles.subtitle}>Create. Share. Connect.</Text>
          </View>

          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Ionicons name="images-outline" size={32} color="#fff" />
              <Text style={styles.featureText}>Share your creativity</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="cart-outline" size={32} color="#fff" />
              <Text style={styles.featureText}>Sell your products</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="chatbubbles-outline" size={32} color="#fff" />
              <Text style={styles.featureText}>Connect with creators</Text>
            </View>
          </View>

          <View style={styles.authButtonsContainer}>
            <TouchableOpacity
              style={[styles.loginButton, styles.signUpButton, loggingIn && styles.loginButtonDisabled]}
              onPress={handleGoogleSignUp}
              disabled={loggingIn}
            >
              {loggingIn ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add" size={24} color="#fff" />
                  <Text style={styles.signUpButtonText}>Sign up with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loggingIn && styles.loginButtonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loggingIn}
            >
              {loggingIn ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={24} color={Colors.primary} />
                  <Text style={styles.loginButtonText}>Sign in with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.infoText}>
            New to Grover? Sign up creates your account automatically
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.9,
    marginTop: 8,
  },
  featuresContainer: {
    width: '100%',
    gap: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  authButtonsContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 16,
  },
  signUpButton: {
    backgroundColor: Colors.primary,
  },
  signUpButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  infoText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 8,
  },
});