import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useVehicle } from '../../contexts/VehicleContext';
import { RoadAlert, RoadRestriction } from '../../types';
import { alertsApi, restrictionsApi } from '../../services/api';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [restrictions, setRestrictions] = useState<RoadRestriction[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const { activeVehicle } = useVehicle();

  useEffect(() => {
    requestLocationPermission();
    loadAlertsAndRestrictions();
  }, []);

  const requestLocationPermission = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied');
        setIsLoadingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(currentLocation);
    } catch (error) {
      setErrorMsg('Failed to get location');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const loadAlertsAndRestrictions = async () => {
    try {
      const [alertsData, restrictionsData] = await Promise.all([
        alertsApi.getAll(),
        restrictionsApi.getAll(),
      ]);
      setAlerts(alertsData);
      setRestrictions(restrictionsData);
    } catch (error) {
      console.error('Failed to load alerts and restrictions:', error);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'speed_camera':
        return 'camera';
      case 'roadwork':
        return 'construct';
      case 'hazard':
        return 'warning';
      case 'school_zone':
        return 'school';
      case 'bump':
        return 'trending-up';
      case 'traffic_light':
        return 'ellipse';
      default:
        return 'alert-circle';
    }
  };

  const getRestrictionIcon = (type: string) => {
    switch (type) {
      case 'height':
        return 'resize-outline';
      case 'weight':
        return 'barbell';
      case 'width':
        return 'swap-horizontal';
      default:
        return 'ban';
    }
  };

  const checkVehicleRestrictions = () => {
    if (!activeVehicle) return [];
    return restrictions.filter((r) => {
      if (r.restriction_type === 'height' && activeVehicle.height_meters > r.limit_value) {
        return true;
      }
      if (r.restriction_type === 'weight' && activeVehicle.weight_kg > r.limit_value) {
        return true;
      }
      if (r.restriction_type === 'width' && activeVehicle.width_meters > r.limit_value) {
        return true;
      }
      return false;
    });
  };

  const blockedRestrictions = checkVehicleRestrictions();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.vehicleInfo}>
          {activeVehicle ? (
            <>
              <Ionicons name="car-sport" size={20} color="#4A90E2" />
              <Text style={styles.vehicleName}>{activeVehicle.name}</Text>
              <View style={styles.vehicleBadge}>
                <Text style={styles.vehicleBadgeText}>{activeVehicle.vehicle_type}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.noVehicle}>No vehicle selected</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Vehicle Restrictions Warning */}
      {blockedRestrictions.length > 0 && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#FFD700" />
          <Text style={styles.warningText}>
            {blockedRestrictions.length} restriction(s) affect your vehicle
          </Text>
        </View>
      )}

      {/* Map Area */}
      <View style={styles.mapContainer}>
        {isLoadingLocation ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.loadingText}>Getting your location...</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorContainer}>
            <Ionicons name="location-outline" size={60} color="#666" />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={requestLocationPermission}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={80} color="#4A90E2" />
            <Text style={styles.mapPlaceholderText}>Map View</Text>
            {location && (
              <View style={styles.locationInfo}>
                <Text style={styles.locationText}>
                  Lat: {location.coords.latitude.toFixed(4)}
                </Text>
                <Text style={styles.locationText}>
                  Lng: {location.coords.longitude.toFixed(4)}
                </Text>
              </View>
            )}
            
            {/* Mock map with alerts display */}
            <View style={styles.alertsPreview}>
              <Text style={styles.alertsTitle}>Nearby Alerts ({alerts.length})</Text>
              {alerts.slice(0, 3).map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <Ionicons
                    name={getAlertIcon(alert.alert_type) as any}
                    size={16}
                    color="#FFD700"
                  />
                  <Text style={styles.alertItemText}>{alert.description}</Text>
                </View>
              ))}
            </View>

            {/* Restrictions preview */}
            <View style={styles.restrictionsPreview}>
              <Text style={styles.alertsTitle}>Road Restrictions ({restrictions.length})</Text>
              {restrictions.slice(0, 3).map((restriction) => (
                <View
                  key={restriction.id}
                  style={[
                    styles.restrictionItem,
                    blockedRestrictions.includes(restriction) && styles.blockedRestriction,
                  ]}
                >
                  <Ionicons
                    name={getRestrictionIcon(restriction.restriction_type) as any}
                    size={16}
                    color={blockedRestrictions.includes(restriction) ? '#FF6B6B' : '#4A90E2'}
                  />
                  <Text style={styles.restrictionItemText}>
                    {restriction.restriction_type}: {restriction.limit_value}
                    {restriction.restriction_type === 'weight' ? 'kg' : 'm'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="search" size={24} color="#fff" />
          <Text style={styles.actionText}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={requestLocationPermission}>
          <Ionicons name="locate" size={24} color="#fff" />
          <Text style={styles.actionText}>My Location</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={loadAlertsAndRestrictions}>
          <Ionicons name="refresh" size={24} color="#fff" />
          <Text style={styles.actionText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Vehicle Stats (when vehicle is active) */}
      {activeVehicle && (
        <View style={styles.vehicleStats}>
          <View style={styles.statItem}>
            <Ionicons name="resize-outline" size={16} color="#4A90E2" />
            <Text style={styles.statText}>H: {activeVehicle.height_meters}m</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="swap-horizontal" size={16} color="#4A90E2" />
            <Text style={styles.statText}>W: {activeVehicle.width_meters}m</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="barbell" size={16} color="#4A90E2" />
            <Text style={styles.statText}>{activeVehicle.weight_kg}kg</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  vehicleBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  vehicleBadgeText: {
    color: '#888',
    fontSize: 12,
  },
  noVehicle: {
    color: '#888',
    fontSize: 14,
  },
  filterButton: {
    padding: 8,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  warningText: {
    color: '#FFD700',
    fontSize: 14,
  },
  mapContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#888',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholderText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  locationInfo: {
    marginTop: 16,
    alignItems: 'center',
  },
  locationText: {
    color: '#888',
    fontSize: 14,
  },
  alertsPreview: {
    width: '100%',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
  },
  alertsTitle: {
    color: '#fff',
    fontWeight: '600',
    marginBottom: 8,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  alertItemText: {
    color: '#ccc',
    fontSize: 13,
    flex: 1,
  },
  restrictionsPreview: {
    width: '100%',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  restrictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  blockedRestriction: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  restrictionItemText: {
    color: '#ccc',
    fontSize: 13,
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    alignItems: 'center',
    padding: 8,
  },
  actionText: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  vehicleStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#888',
    fontSize: 12,
  },
});
