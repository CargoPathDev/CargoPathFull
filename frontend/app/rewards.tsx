import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { UserPoints, Reward } from '../types';
import { pointsApi, rewardsApi } from '../services/api';

export default function RewardsScreen() {
  const router = useRouter();
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [ownedRewards, setOwnedRewards] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'avatars' | 'badges' | 'voices'>('avatars');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pointsData, rewardsData, ownedData] = await Promise.all([
        pointsApi.getPoints(),
        rewardsApi.getAll(),
        rewardsApi.getOwned(),
      ]);
      setPoints(pointsData);
      setRewards(rewardsData);
      setOwnedRewards(ownedData);
    } catch (error) {
      console.error('Failed to load rewards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (reward: Reward) => {
    if (!points) return;
    
    if (points.total_points < reward.cost) {
      Alert.alert(
        'Not Enough Points',
        `You need ${reward.cost - points.total_points} more points to purchase this item.`
      );
      return;
    }

    Alert.alert(
      'Purchase Reward',
      `Spend ${reward.cost} points on "${reward.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            setIsPurchasing(reward.id);
            try {
              await rewardsApi.purchase(reward.id);
              await loadData();
              Alert.alert('Success', `You now own "${reward.name}"!`);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to purchase');
            } finally {
              setIsPurchasing(null);
            }
          },
        },
      ]
    );
  };

  const filteredRewards = rewards.filter((r) => {
    if (activeTab === 'avatars') return r.type === 'avatar';
    if (activeTab === 'badges') return r.type === 'badge';
    if (activeTab === 'voices') return r.type === 'voice';
    return false;
  });

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
        <Text style={styles.title}>Rewards Shop</Text>
      </View>

      {/* Points Display */}
      <View style={styles.pointsCard}>
        <View style={styles.pointsMain}>
          <Ionicons name="star" size={32} color="#FFD700" />
          <Text style={styles.pointsValue}>{points?.total_points || 0}</Text>
          <Text style={styles.pointsLabel}>Points</Text>
        </View>
        <View style={styles.pointsDivider} />
        <View style={styles.levelInfo}>
          <Text style={styles.levelLabel}>Level</Text>
          <Text style={styles.levelValue}>{points?.level || 1}</Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((points?.lifetime_points || 0) % 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {(points?.lifetime_points || 0) % 100}/100 to next level
          </Text>
        </View>
      </View>

      {/* How to Earn Points */}
      <View style={styles.earnSection}>
        <Text style={styles.earnTitle}>Earn Points</Text>
        <View style={styles.earnGrid}>
          <View style={styles.earnItem}>
            <Ionicons name="add-circle" size={20} color="#4A90E2" />
            <Text style={styles.earnPoints}>+10</Text>
            <Text style={styles.earnAction}>Report Alert</Text>
          </View>
          <View style={styles.earnItem}>
            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
            <Text style={styles.earnPoints}>+3</Text>
            <Text style={styles.earnAction}>Confirm Alert</Text>
          </View>
          <View style={styles.earnItem}>
            <Ionicons name="thumbs-up" size={20} color="#9B59B6" />
            <Text style={styles.earnPoints}>+5</Text>
            <Text style={styles.earnAction}>Report Verified</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['avatars', 'badges', 'voices'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons
              name={tab === 'avatars' ? 'car-sport' : tab === 'badges' ? 'shield' : 'mic'}
              size={18}
              color={activeTab === tab ? '#4A90E2' : '#888'}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Rewards Grid */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.rewardsGrid}>
          {filteredRewards.map((reward) => {
            const isOwned = ownedRewards.includes(reward.id);
            const canAfford = (points?.total_points || 0) >= reward.cost;
            
            return (
              <View key={reward.id} style={styles.rewardCard}>
                <View
                  style={[
                    styles.rewardIcon,
                    { backgroundColor: `${reward.color || '#4A90E2'}20` },
                  ]}
                >
                  <Ionicons
                    name={reward.icon as any || 'star'}
                    size={36}
                    color={reward.color || '#4A90E2'}
                  />
                </View>
                <Text style={styles.rewardName}>{reward.name}</Text>
                <View style={styles.rewardCost}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.rewardCostText}>{reward.cost}</Text>
                </View>
                
                {isOwned ? (
                  <View style={styles.ownedBadge}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={styles.ownedText}>Owned</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.buyButton,
                      !canAfford && styles.buyButtonDisabled,
                    ]}
                    onPress={() => handlePurchase(reward)}
                    disabled={!canAfford || isPurchasing === reward.id}
                  >
                    {isPurchasing === reward.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.buyButtonText}>
                        {canAfford ? 'Buy' : 'Need more'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {filteredRewards.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="gift-outline" size={60} color="#333" />
            <Text style={styles.emptyText}>No rewards in this category yet</Text>
          </View>
        )}
      </ScrollView>
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
  pointsCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  pointsMain: {
    alignItems: 'center',
    flex: 1,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 8,
  },
  pointsLabel: {
    color: '#888',
    fontSize: 14,
  },
  pointsDivider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 20,
  },
  levelInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelLabel: {
    color: '#888',
    fontSize: 12,
  },
  levelValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 3,
  },
  progressText: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
  },
  earnSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  earnTitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  earnGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  earnItem: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  earnPoints: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 4,
  },
  earnAction: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#1a2a3a',
    borderWidth: 1,
    borderColor: '#4A90E2',
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
  },
  rewardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  rewardCard: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  rewardIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  rewardName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  rewardCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  rewardCostText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  ownedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27AE60',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  ownedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  buyButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyButtonDisabled: {
    backgroundColor: '#333',
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#888',
    marginTop: 16,
  },
});
