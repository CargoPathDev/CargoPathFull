import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { subscriptionApi } from '../../services/api';
import { Subscription } from '../../types';
import { useStripe } from '@stripe/stripe-react-native';

const plans = [
  {
    tier: 'free',
    name: 'Free',
    price: '£0',
    period: '/month',
    features: [
      '2 vehicles',
      'Basic navigation',
      'Community alerts',
      'Speed camera warnings',
    ],
    color: '#666',
  },
  {
    tier: 'basic',
    name: 'Basic',
    price: '£4.99',
    period: '/month',
    features: [
      '5 vehicles',
      'Advanced navigation',
      'Priority alerts',
      'Route optimization',
      'Fuel-efficient routes',
    ],
    color: '#4A90E2',
    popular: true,
  },
  {
    tier: 'premium',
    name: 'Premium',
    price: '£9.99',
    period: '/month',
    features: [
      '10 vehicles',
      'All Basic features',
      'Road worker portal',
      'Priority support',
      'Offline maps',
      'Fleet management',
    ],
    color: '#FFD700',
  },
];

export default function ProfileScreen() {
  const { user, logout, refreshUser, isGuest } = useAuth();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    if (!isGuest && user) {
      loadSubscription();
    } else {
      setIsLoading(false);
    }
  }, [user, isGuest]);

  const loadSubscription = async () => {
    setIsLoading(true);
    try {
      const data = await subscriptionApi.get();
      setSubscription(data);
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (tier: 'free' | 'basic' | 'premium') => {
    if (isGuest) {
      router.push('/(auth)/register');
      return;
    }
    
    if (tier === user?.subscription_tier) {
      return;
    }

    // Handle free tier (downgrade)
    if (tier === 'free') {
      Alert.alert(
        'Downgrade Plan',
        `Are you sure you want to switch to the Free plan?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              setIsUpgrading(true);
              try {
                await subscriptionApi.upgrade(tier);
                await refreshUser();
                await loadSubscription();
                Alert.alert('Success', 'Your plan has been updated to Free');
              } catch (error) {
                Alert.alert('Error', 'Failed to update subscription');
              } finally {
                setIsUpgrading(false);
              }
            },
          },
        ]
      );
      return;
    }

    // Handle paid tiers (Basic/Premium) with Stripe Payment Sheet
    Alert.alert(
      'Upgrade Plan',
      `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)} for ${tier === 'basic' ? '£4.99' : '£9.99'}/month?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            setIsUpgrading(true);
            try {
              // Create payment intent
              const { clientSecret } = await subscriptionApi.createPaymentIntent(tier);
              
              // Initialize Payment Sheet
              const { error: initError } = await initPaymentSheet({
                paymentIntentClientSecret: clientSecret,
                merchantDisplayName: 'CargoPaths',
                returnURL: 'cargopaths://payment-success',
                appearance: {
                  colors: {
                    primary: '#4A90E2',
                    background: '#1a1a1a',
                    componentBackground: '#252525',
                    componentText: '#ffffff',
                    primaryText: '#ffffff',
                    secondaryText: '#888888',
                  },
                },
              });

              if (initError) {
                Alert.alert('Error', initError.message);
                setIsUpgrading(false);
                return;
              }

              // Present Payment Sheet
              const { error: presentError } = await presentPaymentSheet();

              if (presentError) {
                Alert.alert('Payment Cancelled', presentError.message);
                setIsUpgrading(false);
                return;
              }

              // Payment successful - confirm on backend
              await refreshUser();
              await loadSubscription();
              Alert.alert(
                'Success! 🎉',
                `You're now on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan!`
              );
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to process payment');
            } finally {
              setIsUpgrading(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(isGuest ? 'Exit Guest Mode' : 'Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isGuest ? 'Exit' : 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  // Guest Mode Profile
  if (isGuest) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Guest Header */}
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: '#666' }]}>
              <Ionicons name="person" size={32} color="#fff" />
            </View>
            <Text style={styles.userName}>Guest User</Text>
            <Text style={styles.userEmail}>Using without account</Text>
            <View style={[styles.tierBadge, { backgroundColor: '#333' }]}>
              <Text style={[styles.tierText, { color: '#888' }]}>GUEST MODE</Text>
            </View>
          </View>

          {/* Upgrade Prompt */}
          <View style={styles.upgradePrompt}>
            <Ionicons name="sparkles" size={40} color="#FFD700" />
            <Text style={styles.upgradeTitle}>Unlock All Features</Text>
            <Text style={styles.upgradeDesc}>
              Create a free account to get 30 days of Premium features, save multiple vehicles, earn points, and more!
            </Text>
            <TouchableOpacity
              style={styles.createAccountButton}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={styles.createAccountText}>Create Free Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signInLink}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.signInLinkText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>

          {/* Guest Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What you can do as Guest</Text>
            <View style={styles.guestFeatureList}>
              <View style={styles.guestFeatureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                <Text style={styles.guestFeatureText}>Navigate with 1 vehicle</Text>
              </View>
              <View style={styles.guestFeatureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                <Text style={styles.guestFeatureText}>View road alerts</Text>
              </View>
              <View style={styles.guestFeatureItem}>
                <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                <Text style={styles.guestFeatureText}>Set vehicle dimensions</Text>
              </View>
              <View style={styles.guestFeatureItem}>
                <Ionicons name="close-circle" size={20} color="#E74C3C" />
                <Text style={[styles.guestFeatureText, { color: '#888' }]}>Report alerts (account needed)</Text>
              </View>
              <View style={styles.guestFeatureItem}>
                <Ionicons name="close-circle" size={20} color="#E74C3C" />
                <Text style={[styles.guestFeatureText, { color: '#888' }]}>Earn points & rewards</Text>
              </View>
              <View style={styles.guestFeatureItem}>
                <Ionicons name="close-circle" size={20} color="#E74C3C" />
                <Text style={[styles.guestFeatureText, { color: '#888' }]}>Multiple vehicles</Text>
              </View>
            </View>
          </View>

          {/* Settings for Guest */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={22} color="#4A90E2" />
              <Text style={styles.menuText}>App Settings</Text>
              <Ionicons name="chevron-forward" size={20} color="#444" />
            </TouchableOpacity>
          </View>

          {/* Exit Guest Mode */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="exit-outline" size={22} color="#FF6B6B" />
            <Text style={styles.logoutText}>Exit Guest Mode</Text>
          </TouchableOpacity>

          <Text style={styles.version}>CargoPaths v1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>
              {user?.subscription_tier?.toUpperCase() || 'FREE'} PLAN
            </Text>
          </View>
        </View>

        {/* Subscription Stats */}
        {subscription && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {subscription.vehicle_count}/{subscription.vehicle_limit}
              </Text>
              <Text style={styles.statLabel}>Vehicles</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{subscription.features.length}</Text>
              <Text style={styles.statLabel}>Features</Text>
            </View>
          </View>
        )}

        {/* Subscription Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Plans</Text>
          <Text style={styles.sectionSubtitle}>Choose the plan that suits your needs</Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#4A90E2" style={styles.loader} />
          ) : (
            plans.map((plan) => (
              <TouchableOpacity
                key={plan.tier}
                style={[
                  styles.planCard,
                  user?.subscription_tier === plan.tier && styles.activePlanCard,
                  { borderColor: plan.color },
                ]}
                onPress={() => handleUpgrade(plan.tier as any)}
                disabled={isUpgrading}
              >
                {plan.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>POPULAR</Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.priceContainer}>
                    <Text style={[styles.planPrice, { color: plan.color }]}>
                      {plan.price}
                    </Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                  </View>
                </View>
                <View style={styles.planFeatures}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
                {user?.subscription_tier === plan.tier ? (
                  <View style={[styles.planButton, styles.currentPlanButton]}>
                    <Text style={styles.currentPlanText}>Current Plan</Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.planButton,
                      { backgroundColor: plan.color },
                    ]}
                  >
                    <Text style={styles.planButtonText}>
                      {user?.subscription_tier === 'premium' || 
                       (user?.subscription_tier === 'basic' && plan.tier === 'free')
                        ? 'Downgrade'
                        : 'Upgrade'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          {/* Admin Panel - Only visible for admins */}
          {user?.role === 'admin' && (
            <TouchableOpacity 
              style={[styles.menuItem, { borderColor: '#27AE60', borderWidth: 1 }]}
              onPress={() => router.push('/admin')}
            >
              <Ionicons name="shield-checkmark" size={22} color="#27AE60" />
              <Text style={[styles.menuText, { color: '#27AE60' }]}>Admin Panel</Text>
              <Ionicons name="chevron-forward" size={20} color="#27AE60" />
            </TouchableOpacity>
          )}

          {/* Corporate Dashboard - For corporate users */}
          {user?.corporate_id && (
            <TouchableOpacity 
              style={[styles.menuItem, { borderColor: '#9B59B6', borderWidth: 1 }]}
              onPress={() => router.push('/corporate')}
            >
              <Ionicons name="business" size={22} color="#9B59B6" />
              <Text style={[styles.menuText, { color: '#9B59B6' }]}>Corporate Dashboard</Text>
              <Ionicons name="chevron-forward" size={20} color="#9B59B6" />
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/rewards')}
          >
            <Ionicons name="gift" size={22} color="#E74C3C" />
            <Text style={styles.menuText}>Rewards Shop</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={22} color="#4A90E2" />
            <Text style={styles.menuText}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/roadworker')}
          >
            <Ionicons name="construct-outline" size={22} color="#E67E22" />
            <Text style={styles.menuText}>Road Worker Portal</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={22} color="#888" />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={22} color="#888" />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#FF6B6B" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>CargoPaths v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  tierBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
  },
  tierText: {
    color: '#4A90E2',
    fontSize: 12,
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  loader: {
    marginVertical: 40,
  },
  planCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  activePlanCard: {
    backgroundColor: '#1a2a3a',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#4A90E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  planPeriod: {
    fontSize: 12,
    color: '#888',
  },
  planFeatures: {
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  featureText: {
    color: '#ccc',
    fontSize: 14,
  },
  planButton: {
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  currentPlanButton: {
    backgroundColor: '#333',
  },
  currentPlanText: {
    color: '#888',
    fontWeight: '600',
  },
  planButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  logoutText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#444',
    fontSize: 12,
    marginTop: 24,
  },
  // Guest mode styles
  upgradePrompt: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  upgradeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  upgradeDesc: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
  },
  createAccountButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  createAccountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  signInLink: {
    marginTop: 16,
  },
  signInLinkText: {
    color: '#888',
    fontSize: 14,
  },
  guestFeatureList: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  guestFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  guestFeatureText: {
    color: '#fff',
    fontSize: 14,
  },
});
