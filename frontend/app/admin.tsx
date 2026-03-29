import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../services/api';

interface AdminStats {
  total_users: number;
  subscriptions: {
    free: number;
    basic: number;
    premium: number;
  };
  trial_users: number;
  gifted_users: number;
  total_vehicles: number;
  total_alerts: number;
  total_roadworks: number;
}

interface Pricing {
  basic_monthly: number;
  basic_yearly: number;
  premium_monthly: number;
  premium_yearly: number;
  yearly_discount_percent: number;
  trial_days: number;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  subscription_tier: string;
  is_trial: boolean;
  is_gifted: boolean;
  gifted_by?: string;
  gift_reason?: string;
  trial_days_remaining?: number;
  role: string;
}

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pricing' | 'users'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  
  // Modal states
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form states
  const [editPricing, setEditPricing] = useState<Pricing | null>(null);
  const [giftEmail, setGiftEmail] = useState('');
  const [giftTier, setGiftTier] = useState<'basic' | 'premium'>('premium');
  const [giftDuration, setGiftDuration] = useState('12');
  const [giftReason, setGiftReason] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      Alert.alert('Access Denied', 'Admin access required');
      router.back();
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsData, pricingData, usersData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getPricing(),
        adminApi.getUsers(0, 50),
      ]);
      setStats(statsData);
      setPricing(pricingData);
      setUsers(usersData.users);
      setTotalUsers(usersData.total);
    } catch (error) {
      console.error('Failed to load admin data:', error);
      Alert.alert('Error', 'Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUpdatePricing = async () => {
    if (!editPricing) return;
    
    setIsSubmitting(true);
    try {
      await adminApi.updatePricing(editPricing);
      setPricing(editPricing);
      setShowPricingModal(false);
      Alert.alert('Success', 'Pricing updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update pricing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGiftSubscription = async () => {
    if (!giftEmail) {
      Alert.alert('Error', 'Please enter user email');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await adminApi.giftSubscription(
        giftEmail,
        giftTier,
        parseInt(giftDuration),
        giftReason || undefined
      );
      setShowGiftModal(false);
      setGiftEmail('');
      setGiftReason('');
      await loadData();
      Alert.alert('Success', `${giftTier} subscription gifted to ${giftEmail}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to gift subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeSubscription = (userId: string, userName: string) => {
    Alert.alert(
      'Revoke Subscription',
      `Remove subscription from ${userName}? They will be set to free tier.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.revokeSubscription(userId);
              await loadData();
              Alert.alert('Success', 'Subscription revoked');
            } catch (error) {
              Alert.alert('Error', 'Failed to revoke subscription');
            }
          },
        },
      ]
    );
  };

  const renderDashboard = () => (
    <View style={styles.dashboardContainer}>
      <Text style={styles.sectionTitle}>Overview</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="people" size={32} color="#4A90E2" />
          <Text style={styles.statNumber}>{stats?.total_users || 0}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="car-sport" size={32} color="#27AE60" />
          <Text style={styles.statNumber}>{stats?.total_vehicles || 0}</Text>
          <Text style={styles.statLabel}>Vehicles</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="warning" size={32} color="#F39C12" />
          <Text style={styles.statNumber}>{stats?.total_alerts || 0}</Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="construct" size={32} color="#E67E22" />
          <Text style={styles.statNumber}>{stats?.total_roadworks || 0}</Text>
          <Text style={styles.statLabel}>Roadworks</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Subscriptions</Text>
      <View style={styles.subscriptionStats}>
        <View style={styles.subStatRow}>
          <View style={[styles.subStatDot, { backgroundColor: '#888' }]} />
          <Text style={styles.subStatLabel}>Free</Text>
          <Text style={styles.subStatValue}>{stats?.subscriptions.free || 0}</Text>
        </View>
        <View style={styles.subStatRow}>
          <View style={[styles.subStatDot, { backgroundColor: '#4A90E2' }]} />
          <Text style={styles.subStatLabel}>Basic</Text>
          <Text style={styles.subStatValue}>{stats?.subscriptions.basic || 0}</Text>
        </View>
        <View style={styles.subStatRow}>
          <View style={[styles.subStatDot, { backgroundColor: '#FFD700' }]} />
          <Text style={styles.subStatLabel}>Premium</Text>
          <Text style={styles.subStatValue}>{stats?.subscriptions.premium || 0}</Text>
        </View>
        <View style={styles.subStatRow}>
          <Ionicons name="time" size={16} color="#9B59B6" />
          <Text style={styles.subStatLabel}>On Trial</Text>
          <Text style={styles.subStatValue}>{stats?.trial_users || 0}</Text>
        </View>
        <View style={styles.subStatRow}>
          <Ionicons name="gift" size={16} color="#E74C3C" />
          <Text style={styles.subStatLabel}>Gifted</Text>
          <Text style={styles.subStatValue}>{stats?.gifted_users || 0}</Text>
        </View>
      </View>
    </View>
  );

  const renderPricing = () => (
    <View style={styles.pricingContainer}>
      <View style={styles.pricingHeader}>
        <Text style={styles.sectionTitle}>Pricing Settings</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            setEditPricing(pricing);
            setShowPricingModal(true);
          }}
        >
          <Ionicons name="pencil" size={18} color="#fff" />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {pricing && (
        <>
          <View style={styles.pricingCard}>
            <Text style={styles.pricingTier}>Basic Plan</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Monthly:</Text>
              <Text style={styles.priceValue}>£{pricing.basic_monthly.toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Yearly:</Text>
              <Text style={styles.priceValue}>£{pricing.basic_yearly.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.pricingCard}>
            <Text style={styles.pricingTier}>Premium Plan</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Monthly:</Text>
              <Text style={styles.priceValue}>£{pricing.premium_monthly.toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Yearly:</Text>
              <Text style={styles.priceValue}>£{pricing.premium_yearly.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.pricingCard}>
            <Text style={styles.pricingTier}>Other Settings</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Yearly Discount:</Text>
              <Text style={styles.priceValue}>{pricing.yearly_discount_percent}%</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Free Trial:</Text>
              <Text style={styles.priceValue}>{pricing.trial_days} days</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );

  const renderUsers = () => (
    <View style={styles.usersContainer}>
      <View style={styles.usersHeader}>
        <Text style={styles.sectionTitle}>Users ({totalUsers})</Text>
        <TouchableOpacity
          style={styles.giftButton}
          onPress={() => setShowGiftModal(true)}
        >
          <Ionicons name="gift" size={18} color="#fff" />
          <Text style={styles.giftButtonText}>Gift Sub</Text>
        </TouchableOpacity>
      </View>

      {users.map((u) => (
        <View key={u.id} style={styles.userCard}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{u.name}</Text>
            <Text style={styles.userEmail}>{u.email}</Text>
            <View style={styles.userBadges}>
              <View style={[
                styles.tierBadge,
                { backgroundColor: u.subscription_tier === 'premium' ? '#FFD700' : 
                                  u.subscription_tier === 'basic' ? '#4A90E2' : '#666' }
              ]}>
                <Text style={styles.tierText}>{u.subscription_tier.toUpperCase()}</Text>
              </View>
              {u.is_trial && (
                <View style={styles.trialBadge}>
                  <Text style={styles.trialText}>TRIAL ({u.trial_days_remaining}d)</Text>
                </View>
              )}
              {u.is_gifted && (
                <View style={styles.giftedBadge}>
                  <Ionicons name="gift" size={10} color="#fff" />
                  <Text style={styles.giftedText}>GIFT</Text>
                </View>
              )}
              {u.role === 'admin' && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminText}>ADMIN</Text>
                </View>
              )}
            </View>
            {u.is_gifted && u.gift_reason && (
              <Text style={styles.giftReason}>Reason: {u.gift_reason}</Text>
            )}
          </View>
          {u.subscription_tier !== 'free' && u.role !== 'admin' && (
            <TouchableOpacity
              style={styles.revokeButton}
              onPress={() => handleRevokeSubscription(u.id, u.name)}
            >
              <Ionicons name="close-circle" size={24} color="#E74C3C" />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Panel</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Ionicons name="stats-chart" size={20} color={activeTab === 'dashboard' ? '#4A90E2' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pricing' && styles.activeTab]}
          onPress={() => setActiveTab('pricing')}
        >
          <Ionicons name="pricetag" size={20} color={activeTab === 'pricing' ? '#4A90E2' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'pricing' && styles.activeTabText]}>Pricing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Ionicons name="people" size={20} color={activeTab === 'users' ? '#4A90E2' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Users</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A90E2" />}
      >
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'pricing' && renderPricing()}
        {activeTab === 'users' && renderUsers()}
      </ScrollView>

      {/* Edit Pricing Modal */}
      <Modal visible={showPricingModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Pricing</Text>
              <TouchableOpacity onPress={() => setShowPricingModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>Basic Monthly (£)</Text>
              <TextInput
                style={styles.input}
                value={editPricing?.basic_monthly.toString()}
                onChangeText={(t) => setEditPricing(p => p ? {...p, basic_monthly: parseFloat(t) || 0} : null)}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputLabel}>Basic Yearly (£)</Text>
              <TextInput
                style={styles.input}
                value={editPricing?.basic_yearly.toString()}
                onChangeText={(t) => setEditPricing(p => p ? {...p, basic_yearly: parseFloat(t) || 0} : null)}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputLabel}>Premium Monthly (£)</Text>
              <TextInput
                style={styles.input}
                value={editPricing?.premium_monthly.toString()}
                onChangeText={(t) => setEditPricing(p => p ? {...p, premium_monthly: parseFloat(t) || 0} : null)}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputLabel}>Premium Yearly (£)</Text>
              <TextInput
                style={styles.input}
                value={editPricing?.premium_yearly.toString()}
                onChangeText={(t) => setEditPricing(p => p ? {...p, premium_yearly: parseFloat(t) || 0} : null)}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputLabel}>Yearly Discount (%)</Text>
              <TextInput
                style={styles.input}
                value={editPricing?.yearly_discount_percent.toString()}
                onChangeText={(t) => setEditPricing(p => p ? {...p, yearly_discount_percent: parseInt(t) || 0} : null)}
                keyboardType="number-pad"
              />
              <Text style={styles.inputLabel}>Free Trial Days</Text>
              <TextInput
                style={styles.input}
                value={editPricing?.trial_days.toString()}
                onChangeText={(t) => setEditPricing(p => p ? {...p, trial_days: parseInt(t) || 30} : null)}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleUpdatePricing}
                disabled={isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Gift Subscription Modal */}
      <Modal visible={showGiftModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gift Subscription</Text>
              <TouchableOpacity onPress={() => setShowGiftModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>User Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="user@example.com"
                placeholderTextColor="#666"
                value={giftEmail}
                onChangeText={setGiftEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.inputLabel}>Subscription Tier</Text>
              <View style={styles.tierSelector}>
                <TouchableOpacity
                  style={[styles.tierOption, giftTier === 'basic' && styles.tierOptionActive]}
                  onPress={() => setGiftTier('basic')}
                >
                  <Text style={[styles.tierOptionText, giftTier === 'basic' && styles.tierOptionTextActive]}>Basic</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tierOption, giftTier === 'premium' && styles.tierOptionActive]}
                  onPress={() => setGiftTier('premium')}
                >
                  <Text style={[styles.tierOptionText, giftTier === 'premium' && styles.tierOptionTextActive]}>Premium</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>Duration (months)</Text>
              <TextInput
                style={styles.input}
                placeholder="12"
                placeholderTextColor="#666"
                value={giftDuration}
                onChangeText={setGiftDuration}
                keyboardType="number-pad"
              />
              <Text style={styles.inputLabel}>Reason (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Family member, Friend, Contest winner"
                placeholderTextColor="#666"
                value={giftReason}
                onChangeText={setGiftReason}
              />
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: '#E74C3C' }, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleGiftSubscription}
                disabled={isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="gift" size={18} color="#fff" />
                    <Text style={styles.submitButtonText}> Gift Subscription</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4A90E2',
  },
  tabText: {
    color: '#888',
    fontSize: 13,
  },
  activeTabText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  dashboardContainer: {},
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  subscriptionStats: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
  },
  subStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  subStatDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  subStatLabel: {
    flex: 1,
    color: '#ccc',
    fontSize: 14,
    marginLeft: 4,
  },
  subStatValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pricingContainer: {},
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  pricingCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  pricingTier: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  priceLabel: {
    color: '#888',
    fontSize: 14,
  },
  priceValue: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
  usersContainer: {},
  usersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  giftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  giftButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  userEmail: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  userBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tierText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  trialBadge: {
    backgroundColor: '#9B59B6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  trialText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  giftedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  giftedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  adminBadge: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adminText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  giftReason: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  revokeButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalForm: {
    padding: 20,
  },
  inputLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  tierSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  tierOption: {
    flex: 1,
    padding: 14,
    backgroundColor: '#252525',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  tierOptionActive: {
    borderColor: '#4A90E2',
    backgroundColor: '#1a2a3a',
  },
  tierOptionText: {
    color: '#888',
    fontWeight: '600',
  },
  tierOptionTextActive: {
    color: '#4A90E2',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
