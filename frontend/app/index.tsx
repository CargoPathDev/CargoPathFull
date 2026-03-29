import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function Index() {
  const { user, isLoading, isGuest, continueAsGuest } = useAuth();
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);
  const [checkingFirstLaunch, setCheckingFirstLaunch] = useState(true);

  useEffect(() => {
    checkFirstLaunch();
  }, []);

  useEffect(() => {
    if (!isLoading && !checkingFirstLaunch) {
      if (user) {
        // Logged in user - go to map
        router.replace('/(tabs)/map');
      } else if (isGuest) {
        // Guest user - go to map
        router.replace('/(tabs)/map');
      } else if (!showWelcome) {
        // First time or logged out - check if should show welcome
        // For now, show welcome screen
      }
    }
  }, [user, isLoading, isGuest, checkingFirstLaunch]);

  const checkFirstLaunch = async () => {
    try {
      const hasLaunched = await AsyncStorage.getItem('has_launched');
      const guestMode = await AsyncStorage.getItem('guest_mode');
      
      if (hasLaunched && guestMode === 'true') {
        // Returning guest user - go straight to map
        setCheckingFirstLaunch(false);
        return;
      }
      
      if (!hasLaunched) {
        // First launch - show welcome
        setShowWelcome(true);
        await AsyncStorage.setItem('has_launched', 'true');
      }
    } catch (e) {
      console.log('Error checking first launch');
    }
    setCheckingFirstLaunch(false);
  };

  const handleStartNavigating = async () => {
    await continueAsGuest();
    router.replace('/(tabs)/map');
  };

  const handleSignIn = () => {
    router.push('/(auth)/login');
  };

  if (isLoading || checkingFirstLaunch) {
    return (
      <View style={styles.container}>
        <Ionicons name="navigate" size={60} color="#4A90E2" />
        <Text style={styles.logo}>CargoPaths</Text>
        <ActivityIndicator size="large" color="#4A90E2" style={styles.loader} />
      </View>
    );
  }

  // Welcome/Onboarding screen for first-time users
  if (showWelcome || (!user && !isGuest)) {
    return (
      <View style={styles.container}>
        <View style={styles.heroSection}>
          <Ionicons name="navigate" size={80} color="#4A90E2" />
          <Text style={styles.logo}>CargoPaths</Text>
          <Text style={styles.tagline}>Smart Navigation for Every Vehicle</Text>
        </View>

        <View style={styles.featuresSection}>
          <View style={styles.featureItem}>
            <Ionicons name="car-sport" size={28} color="#27AE60" />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Vehicle-Aware Routing</Text>
              <Text style={styles.featureDesc}>Routes based on your vehicle's height, width & weight</Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="warning" size={28} color="#F39C12" />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Real-Time Alerts</Text>
              <Text style={styles.featureDesc}>Speed cameras, police, roadworks & more</Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="people" size={28} color="#9B59B6" />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Community Powered</Text>
              <Text style={styles.featureDesc}>Drivers helping drivers stay informed</Text>
            </View>
          </View>
        </View>

        <View style={styles.ctaSection}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleStartNavigating}>
            <Ionicons name="navigate" size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>Start Navigating</Text>
          </TouchableOpacity>
          
          <Text style={styles.noAccountText}>No account needed to start</Text>
          
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSignIn}>
            <Text style={styles.secondaryButtonText}>Sign in for more features</Text>
            <Ionicons name="arrow-forward" size={18} color="#4A90E2" />
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Works with Apple CarPlay & Android Auto
        </Text>
      </View>
    );
  }

  // Fallback loading
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90E2" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginTop: 16,
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
  },
  loader: {
    marginTop: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  featuresSection: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  featureDesc: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  ctaSection: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    gap: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  noAccountText: {
    color: '#666',
    fontSize: 13,
    marginTop: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 6,
  },
  secondaryButtonText: {
    color: '#4A90E2',
    fontSize: 15,
  },
  disclaimer: {
    position: 'absolute',
    bottom: 40,
    color: '#444',
    fontSize: 12,
  },
});
