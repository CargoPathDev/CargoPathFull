import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useVehicle } from '../../contexts/VehicleContext';
import { RoadAlert, RoadRestriction } from '../../types';
import { alertsApi, restrictionsApi } from '../../services/api';
import { mapsService, DirectionsResult } from '../../services/maps';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [restrictions, setRestrictions] = useState<RoadRestriction[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [destination, setDestination] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
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

      // Center map on user location
      if (mapRef.current && currentLocation) {
        mapRef.current.animateToRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
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

  const handleSearch = async () => {
    if (!searchQuery.trim() || !location) return;

    Keyboard.dismiss();
    setIsLoadingLocation(true);

    try {
      const results = await mapsService.searchPlaces(searchQuery, {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });

      if (results && results.length > 0) {
        const place = results[0];
        const destLocation = {
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
        };

        setDestination(destLocation);
        setShowSearch(false);
        await startNavigation(destLocation);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const startNavigation = async (dest: { latitude: number; longitude: number }) => {
    if (!location) return;

    setIsNavigating(true);

    try {
      const origin = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      
      const destination = {
        lat: dest.latitude,
        lng: dest.longitude,
      };

      let directionsResult: DirectionsResult;

      // Use optimized route if vehicle is active
      if (activeVehicle) {
        directionsResult = await mapsService.getOptimizedRoute(origin, destination, {
          height_meters: activeVehicle.height_meters,
          width_meters: activeVehicle.width_meters,
          weight_kg: activeVehicle.weight_kg,
        });
      } else {
        directionsResult = await mapsService.getDirections(origin, destination);
      }

      if (directionsResult.routes && directionsResult.routes.length > 0) {
        const route = directionsResult.routes[0];
        const points = mapsService.decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);

        // Get route info
        if (route.legs && route.legs.length > 0) {
          const leg = route.legs[0];
          setRouteInfo({
            distance: leg.distance.text,
            duration: leg.duration.text,
          });
        }

        // Fit map to route
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(points, {
            edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
            animated: true,
          });
        }
      }
    } catch (error) {
      console.error('Navigation failed:', error);
    } finally {
      setIsNavigating(false);
    }
  };

  const clearNavigation = () => {
    setRouteCoordinates([]);
    setDestination(null);
    setRouteInfo(null);
    setSearchQuery('');
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'speed_camera': return 'camera';
      case 'roadwork': return 'construct';
      case 'hazard': return 'warning';
      case 'school_zone': return 'school';
      case 'bump': return 'trending-up';
      case 'traffic_light': return 'ellipse';
      default: return 'alert-circle';
    }
  };

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'speed_camera': return '#FFD700';
      case 'roadwork': return '#FF6B6B';
      case 'hazard': return '#FF4500';
      case 'school_zone': return '#4A90E2';
      default: return '#888';
    }
  };

  const checkVehicleRestrictions = () => {
    if (!activeVehicle) return [];
    return restrictions.filter((r) => {
      if (r.restriction_type === 'height' && activeVehicle.height_meters > r.limit_value) return true;
      if (r.restriction_type === 'weight' && activeVehicle.weight_kg > r.limit_value) return true;
      if (r.restriction_type === 'width' && activeVehicle.width_meters > r.limit_value) return true;
      return false;
    });
  };

  const blockedRestrictions = checkVehicleRestrictions();

  if (isLoadingLocation && !location) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg || !location) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={60} color="#666" />
          <Text style={styles.errorText}>{errorMsg || 'Location unavailable'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={requestLocationPermission}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.vehicleInfo}>
          {activeVehicle ? (
            <>
              <Ionicons name="car-sport" size={20} color="#4A90E2" />
              <Text style={styles.vehicleName}>{activeVehicle.name}</Text>
            </>
          ) : (
            <Text style={styles.noVehicle}>No vehicle selected</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search destination..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            autoFocus
          />
          <TouchableOpacity style={styles.searchSubmitButton} onPress={handleSearch}>
            <Ionicons name="arrow-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Vehicle Restrictions Warning */}
      {blockedRestrictions.length > 0 && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#FFD700" />
          <Text style={styles.warningText}>
            {blockedRestrictions.length} restriction(s) affect your vehicle
          </Text>
        </View>
      )}

      {/* Route Info */}
      {routeInfo && (
        <View style={styles.routeInfo}>
          <Ionicons name="navigate" size={20} color="#4A90E2" />
          <Text style={styles.routeText}>
            {routeInfo.distance} • {routeInfo.duration}
          </Text>
          <TouchableOpacity onPress={clearNavigation}>
            <Ionicons name="close-circle" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      )}

      {/* Google Maps */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsTraffic
      >
        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#4A90E2"
            strokeWidth={4}
          />
        )}

        {/* Destination Marker */}
        {destination && (
          <Marker coordinate={destination} title="Destination">
            <View style={styles.destinationMarker}>
              <Ionicons name="flag" size={30} color="#27AE60" />
            </View>
          </Marker>
        )}

        {/* Alert Markers */}
        {alerts.map((alert) => (
          <Marker
            key={alert.id}
            coordinate={{
              latitude: alert.latitude,
              longitude: alert.longitude,
            }}
            title={alert.alert_type}
            description={alert.description}
          >
            <View style={[styles.markerContainer, { backgroundColor: getMarkerColor(alert.alert_type) }]}>
              <Ionicons name={getAlertIcon(alert.alert_type) as any} size={20} color="#fff" />
            </View>
          </Marker>
        ))}

        {/* Restriction Markers */}
        {restrictions.map((restriction) => (
          <Marker
            key={restriction.id}
            coordinate={{
              latitude: restriction.latitude,
              longitude: restriction.longitude,
            }}
            title={`${restriction.restriction_type} restriction`}
            description={`Limit: ${restriction.limit_value}${restriction.restriction_type === 'weight' ? 'kg' : 'm'}`}
          >
            <View
              style={[
                styles.restrictionMarker,
                blockedRestrictions.includes(restriction) && styles.blockedMarker,
              ]}
            >
              <Ionicons name="ban" size={20} color="#fff" />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (mapRef.current && location) {
              mapRef.current.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              });
            }
          }}
        >
          <Ionicons name="locate" size={28} color="#4A90E2" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={loadAlertsAndRestrictions}>
          <Ionicons name="refresh" size={28} color="#4A90E2" />
        </TouchableOpacity>
      </View>
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
    zIndex: 10,
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
  noVehicle: {
    color: '#888',
    fontSize: 14,
  },
  searchButton: {
    padding: 8,
  },
  searchBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    gap: 8,
    zIndex: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#252525',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  searchSubmitButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    zIndex: 10,
  },
  warningText: {
    color: '#FFD700',
    fontSize: 14,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    zIndex: 10,
  },
  routeText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  map: {
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
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  restrictionMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  blockedMarker: {
    backgroundColor: '#FF4500',
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  destinationMarker: {
    width: 40,
    height: 40,
  },
  quickActions: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#1a1a1a',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
