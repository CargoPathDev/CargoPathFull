import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Vehicle } from '../types';
import { vehiclesApi } from '../services/api';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VehicleContextType {
  vehicles: Vehicle[];
  activeVehicle: Vehicle | null;
  isLoading: boolean;
  refreshVehicles: () => Promise<void>;
  setActiveVehicle: (vehicleId: string) => Promise<void>;
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'user_id' | 'is_active' | 'created_at'>) => Promise<void>;
  deleteVehicle: (vehicleId: string) => Promise<void>;
  isGuestMode: boolean;
}

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

const GUEST_VEHICLE_KEY = 'guest_vehicle';

export function VehicleProvider({ children }: { children: ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicle, setActiveVehicleState] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isGuest } = useAuth();

  useEffect(() => {
    if (user) {
      // Logged in user - fetch from API
      refreshVehicles();
    } else if (isGuest) {
      // Guest user - load from local storage
      loadGuestVehicle();
    } else {
      setVehicles([]);
      setActiveVehicleState(null);
    }
  }, [user, isGuest]);

  const loadGuestVehicle = async () => {
    try {
      const stored = await AsyncStorage.getItem(GUEST_VEHICLE_KEY);
      if (stored) {
        const guestVehicle = JSON.parse(stored) as Vehicle;
        setVehicles([guestVehicle]);
        setActiveVehicleState(guestVehicle);
      }
    } catch (error) {
      console.error('Failed to load guest vehicle:', error);
    }
  };

  const saveGuestVehicle = async (vehicle: Vehicle) => {
    try {
      await AsyncStorage.setItem(GUEST_VEHICLE_KEY, JSON.stringify(vehicle));
    } catch (error) {
      console.error('Failed to save guest vehicle:', error);
    }
  };

  const refreshVehicles = async () => {
    if (isGuest) {
      await loadGuestVehicle();
      return;
    }
    
    if (!user) return;
    
    setIsLoading(true);
    try {
      const vehicleList = await vehiclesApi.getAll();
      setVehicles(vehicleList);
      const active = vehicleList.find(v => v.is_active) || null;
      setActiveVehicleState(active);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveVehicle = async (vehicleId: string) => {
    if (isGuest) {
      // Guest mode - just set locally
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        setActiveVehicleState(vehicle);
      }
      return;
    }
    
    try {
      await vehiclesApi.activate(vehicleId);
      await refreshVehicles();
    } catch (error) {
      console.error('Failed to activate vehicle:', error);
      throw error;
    }
  };

  const addVehicle = async (vehicle: Omit<Vehicle, 'id' | 'user_id' | 'is_active' | 'created_at'>) => {
    if (isGuest) {
      // Guest mode - store locally (only 1 vehicle allowed)
      const guestVehicle: Vehicle = {
        id: 'guest-vehicle-1',
        user_id: 'guest',
        ...vehicle,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setVehicles([guestVehicle]);
      setActiveVehicleState(guestVehicle);
      await saveGuestVehicle(guestVehicle);
      return;
    }
    
    try {
      await vehiclesApi.create(vehicle);
      await refreshVehicles();
    } catch (error) {
      console.error('Failed to add vehicle:', error);
      throw error;
    }
  };

  const deleteVehicle = async (vehicleId: string) => {
    if (isGuest) {
      // Guest mode - delete locally
      await AsyncStorage.removeItem(GUEST_VEHICLE_KEY);
      setVehicles([]);
      setActiveVehicleState(null);
      return;
    }
    
    try {
      await vehiclesApi.delete(vehicleId);
      await refreshVehicles();
    } catch (error) {
      console.error('Failed to delete vehicle:', error);
      throw error;
    }
  };

  return (
    <VehicleContext.Provider
      value={{
        vehicles,
        activeVehicle,
        isLoading,
        refreshVehicles,
        setActiveVehicle,
        addVehicle,
        deleteVehicle,
        isGuestMode: isGuest,
      }}
    >
      {children}
    </VehicleContext.Provider>
  );
}

export function useVehicle() {
  const context = useContext(VehicleContext);
  if (context === undefined) {
    throw new Error('useVehicle must be used within a VehicleProvider');
  }
  return context;
}
