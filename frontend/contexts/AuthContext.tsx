import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  upgradeFromGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // First check if user is a guest
      const guestMode = await AsyncStorage.getItem('guest_mode');
      if (guestMode === 'true') {
        setIsGuest(true);
        setIsLoading(false);
        return;
      }

      // Check for logged in user
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        const userData = await authApi.getMe();
        setUser(userData);
      }
    } catch (error) {
      console.log('Not authenticated');
      await AsyncStorage.removeItem('access_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const userData = await authApi.login(email, password);
    // Clear guest mode when logging in
    await AsyncStorage.removeItem('guest_mode');
    setIsGuest(false);
    setUser({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      subscription_tier: userData.subscription_tier,
    });
  };

  const register = async (email: string, password: string, name: string) => {
    const userData = await authApi.register(email, password, name);
    // Clear guest mode when registering
    await AsyncStorage.removeItem('guest_mode');
    setIsGuest(false);
    setUser({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      subscription_tier: userData.subscription_tier,
    });
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // Ignore logout errors
    }
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('guest_mode');
    setUser(null);
    setIsGuest(false);
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user');
    }
  };

  const continueAsGuest = async () => {
    await AsyncStorage.setItem('guest_mode', 'true');
    setIsGuest(true);
  };

  const upgradeFromGuest = () => {
    // This will trigger navigation to login/register
    setIsGuest(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      isGuest,
      login, 
      register, 
      logout, 
      refreshUser,
      continueAsGuest,
      upgradeFromGuest
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
