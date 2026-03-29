import axios from 'axios';
import { User, Vehicle, RoadAlert, RoadRestriction, Subscription, RoadWork, UserPoints, Reward, UserSettings, CorporateAccount, Employee } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  register: async (email: string, password: string, name: string) => {
    const response = await api.post('/api/auth/register', { email, password, name });
    if (response.data.access_token) {
      await AsyncStorage.setItem('access_token', response.data.access_token);
    }
    return response.data;
  },
  
  login: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });
    if (response.data.access_token) {
      await AsyncStorage.setItem('access_token', response.data.access_token);
    }
    return response.data;
  },
  
  logout: async () => {
    await api.post('/api/auth/logout');
    await AsyncStorage.removeItem('access_token');
  },
  
  getMe: async (): Promise<User> => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

// Vehicles API
export const vehiclesApi = {
  getAll: async (): Promise<Vehicle[]> => {
    const response = await api.get('/api/vehicles');
    return response.data;
  },
  
  create: async (vehicle: Omit<Vehicle, 'id' | 'user_id' | 'is_active' | 'created_at'>) => {
    const response = await api.post('/api/vehicles', vehicle);
    return response.data;
  },
  
  activate: async (vehicleId: string) => {
    const response = await api.put(`/api/vehicles/${vehicleId}/activate`);
    return response.data;
  },
  
  delete: async (vehicleId: string) => {
    const response = await api.delete(`/api/vehicles/${vehicleId}`);
    return response.data;
  },
  
  getActive: async (): Promise<Vehicle | null> => {
    const response = await api.get('/api/vehicles/active');
    return response.data;
  },
};

// Alerts API
export const alertsApi = {
  getAll: async (lat?: number, lng?: number, radius_km?: number): Promise<RoadAlert[]> => {
    const params = new URLSearchParams();
    if (lat !== undefined) params.append('lat', lat.toString());
    if (lng !== undefined) params.append('lng', lng.toString());
    if (radius_km !== undefined) params.append('radius_km', radius_km.toString());
    const response = await api.get(`/api/alerts?${params.toString()}`);
    return response.data;
  },
  
  create: async (alert: Omit<RoadAlert, 'id' | 'created_by' | 'created_at' | 'upvotes' | 'is_active'>) => {
    const response = await api.post('/api/alerts', alert);
    return response.data;
  },
  
  upvote: async (alertId: string) => {
    const response = await api.post(`/api/alerts/${alertId}/upvote`);
    return response.data;
  },
};

// Restrictions API
export const restrictionsApi = {
  getAll: async (lat?: number, lng?: number, radius_km?: number): Promise<RoadRestriction[]> => {
    const params = new URLSearchParams();
    if (lat !== undefined) params.append('lat', lat.toString());
    if (lng !== undefined) params.append('lng', lng.toString());
    if (radius_km !== undefined) params.append('radius_km', radius_km.toString());
    const response = await api.get(`/api/restrictions?${params.toString()}`);
    return response.data;
  },
  
  create: async (restriction: Omit<RoadRestriction, 'id' | 'is_active'>) => {
    const response = await api.post('/api/restrictions', restriction);
    return response.data;
  },
};

// Subscription API
export const subscriptionApi = {
  get: async (): Promise<Subscription> => {
    const response = await api.get('/api/subscription');
    return response.data;
  },
  
  upgrade: async (tier: 'free' | 'basic' | 'premium') => {
    const response = await api.post('/api/subscription/upgrade', { tier });
    return response.data;
  },
  
  createPaymentIntent: async (tier: 'basic' | 'premium') => {
    const response = await api.post('/api/create-payment-intent', { tier });
    return response.data;
  },
  
  confirmPayment: async (tier: string, paymentIntentId: string) => {
    const response = await api.post('/api/subscription/confirm-payment', {
      tier,
      payment_intent_id: paymentIntentId,
    });
    return response.data;
  },
};

// Road Works API (Road Worker Portal)
export const roadworksApi = {
  getAll: async (status?: string): Promise<RoadWork[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const response = await api.get(`/api/roadworks?${params.toString()}`);
    return response.data;
  },
  
  create: async (roadwork: Omit<RoadWork, 'id' | 'status' | 'created_by' | 'created_at' | 'verified'>) => {
    const response = await api.post('/api/roadworks', roadwork);
    return response.data;
  },
  
  approve: async (roadworkId: string) => {
    const response = await api.put(`/api/roadworks/${roadworkId}/approve`);
    return response.data;
  },
  
  updateStatus: async (roadworkId: string, status: string) => {
    const response = await api.put(`/api/roadworks/${roadworkId}/status?status=${status}`);
    return response.data;
  },
  
  delete: async (roadworkId: string) => {
    const response = await api.delete(`/api/roadworks/${roadworkId}`);
    return response.data;
  },
};

// Admin API
export const adminApi = {
  // Get dashboard stats
  getStats: async () => {
    const response = await api.get('/api/admin/stats');
    return response.data;
  },
  
  // Get all users
  getUsers: async (skip = 0, limit = 50) => {
    const response = await api.get(`/api/admin/users?skip=${skip}&limit=${limit}`);
    return response.data;
  },
  
  // Get pricing settings
  getPricing: async () => {
    const response = await api.get('/api/admin/pricing');
    return response.data;
  },
  
  // Update pricing
  updatePricing: async (pricing: {
    basic_monthly: number;
    basic_yearly: number;
    premium_monthly: number;
    premium_yearly: number;
    yearly_discount_percent: number;
    trial_days: number;
  }) => {
    const response = await api.put('/api/admin/pricing', pricing);
    return response.data;
  },
  
  // Gift subscription
  giftSubscription: async (userEmail: string, tier: string, durationMonths: number, reason?: string) => {
    const response = await api.post('/api/admin/gift-subscription', {
      user_email: userEmail,
      tier,
      duration_months: durationMonths,
      reason,
    });
    return response.data;
  },
  
  // Revoke subscription
  revokeSubscription: async (userId: string) => {
    const response = await api.post(`/api/admin/revoke-subscription/${userId}`);
    return response.data;
  },
};

// Get public pricing
export const getPricing = async () => {
  const response = await api.get('/api/pricing');
  return response.data;
};

// Points & Rewards API
export const pointsApi = {
  getPoints: async (): Promise<UserPoints> => {
    const response = await api.get('/api/points');
    return response.data;
  },
  
  earnPoints: async (action: string, points: number, description?: string) => {
    const response = await api.post('/api/points/earn', { action, points, description });
    return response.data;
  },
  
  getHistory: async (limit = 20) => {
    const response = await api.get(`/api/points/history?limit=${limit}`);
    return response.data;
  },
};

export const rewardsApi = {
  getAll: async (): Promise<Reward[]> => {
    const response = await api.get('/api/rewards');
    return response.data;
  },
  
  getOwned: async (): Promise<string[]> => {
    const response = await api.get('/api/rewards/owned');
    return response.data;
  },
  
  purchase: async (rewardId: string) => {
    const response = await api.post('/api/rewards/purchase', { reward_id: rewardId });
    return response.data;
  },
};

// Settings API
export const settingsApi = {
  get: async (): Promise<UserSettings> => {
    const response = await api.get('/api/settings');
    return response.data;
  },
  
  update: async (settings: Partial<UserSettings>) => {
    const response = await api.put('/api/settings', settings);
    return response.data;
  },
  
  updateAddress: async (type: 'home' | 'work', address: string, lat: number, lng: number) => {
    const response = await api.put(`/api/settings/address?address_type=${type}&address=${encodeURIComponent(address)}&lat=${lat}&lng=${lng}`);
    return response.data;
  },
};

// Corporate API
export const corporateApi = {
  getMyCompany: async (): Promise<CorporateAccount> => {
    const response = await api.get('/api/corporate/my-company');
    return response.data;
  },
  
  getEmployees: async (): Promise<Employee[]> => {
    const response = await api.get('/api/corporate/employees');
    return response.data;
  },
  
  addEmployee: async (email: string, vehicleId?: string) => {
    const response = await api.post('/api/corporate/add-employee', {
      employee_email: email,
      vehicle_id: vehicleId,
    });
    return response.data;
  },
  
  removeEmployee: async (email: string) => {
    const response = await api.delete(`/api/corporate/remove-employee/${email}`);
    return response.data;
  },
  
  toggleSafetyMode: async (enabled: boolean) => {
    const response = await api.put(`/api/corporate/safety-mode?enabled=${enabled}`);
    return response.data;
  },
};

// Alert confirmation (for points)
export const confirmAlert = async (alertId: string) => {
  const response = await api.post(`/api/alerts/${alertId}/confirm`);
  return response.data;
};

export default api;
