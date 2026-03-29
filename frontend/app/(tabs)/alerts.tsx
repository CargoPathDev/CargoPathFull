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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RoadAlert } from '../../types';
import { alertsApi, confirmAlert, pointsApi } from '../../services/api';
import * as Location from 'expo-location';

const alertTypes = [
  { type: 'speed_camera', label: 'Speed Camera', icon: 'camera', color: '#FF6B6B' },
  { type: 'roadwork', label: 'Road Work', icon: 'construct', color: '#FFD700' },
  { type: 'hazard', label: 'Hazard', icon: 'warning', color: '#FF9500' },
  { type: 'school_zone', label: 'School Zone', icon: 'school', color: '#4A90E2' },
  { type: 'bump', label: 'Speed Bump', icon: 'trending-up', color: '#9B59B6' },
  { type: 'traffic_light', label: 'Temp Traffic Light', icon: 'ellipse', color: '#2ECC71' },
  { type: 'police_visible', label: 'Police Visible', icon: 'shield', color: '#3498DB' },
  { type: 'police_hidden', label: 'Police Hidden', icon: 'eye-off', color: '#E74C3C' },
  { type: 'police_trap', label: 'Police Trap', icon: 'alert-circle', color: '#C0392B' },
  { type: 'police_checkpoint', label: 'Checkpoint', icon: 'checkbox', color: '#1ABC9C' },
];

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // Form state
  const [alertType, setAlertType] = useState('speed_camera');
  const [description, setDescription] = useState('');
  const [speedLimit, setSpeedLimit] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');

  useEffect(() => {
    loadAlerts();
    getLocation();
  }, []);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await alertsApi.getAll();
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  const handleAddAlert = async () => {
    if (!location) {
      Alert.alert('Location Required', 'Please enable location to report an alert');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await alertsApi.create({
        alert_type: alertType as any,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        description: description || undefined,
        speed_limit: speedLimit ? parseInt(speedLimit) : undefined,
        time_restriction_start: timeStart || undefined,
        time_restriction_end: timeEnd || undefined,
      });
      setShowAddModal(false);
      resetForm();
      loadAlerts();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to add alert';
      setError(typeof errorMessage === 'string' ? errorMessage : 'Failed to add alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAlertType('speed_camera');
    setDescription('');
    setSpeedLimit('');
    setTimeStart('');
    setTimeEnd('');
    setError('');
  };

  const handleUpvote = async (alertId: string) => {
    try {
      const result = await confirmAlert(alertId);
      Alert.alert('Alert Confirmed', `You earned ${result.points_earned} points!`);
      loadAlerts();
    } catch (error: any) {
      if (error.response?.data?.detail === 'Already confirmed this alert') {
        Alert.alert('Already Confirmed', 'You have already confirmed this alert');
      } else {
        console.error('Failed to confirm:', error);
      }
    }
  };

  const getAlertInfo = (type: string) => {
    return alertTypes.find((a) => a.type === type) || alertTypes[0];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Road Alerts</Text>
        <Text style={styles.subtitle}>Community reported alerts</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Alert Type Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}
          >
            {alertTypes.map((at) => (
              <TouchableOpacity key={at.type} style={styles.filterChip}>
                <Ionicons name={at.icon as any} size={16} color={at.color} />
                <Text style={styles.filterText}>{at.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Alerts List */}
          {alerts.map((alert) => {
            const alertInfo = getAlertInfo(alert.alert_type);
            return (
              <View key={alert.id} style={styles.alertCard}>
                <View style={[styles.alertIcon, { backgroundColor: `${alertInfo.color}20` }]}>
                  <Ionicons name={alertInfo.icon as any} size={24} color={alertInfo.color} />
                </View>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertType}>{alertInfo.label}</Text>
                  {alert.description && (
                    <Text style={styles.alertDescription}>{alert.description}</Text>
                  )}
                  <View style={styles.alertMeta}>
                    {alert.speed_limit && (
                      <View style={styles.metaItem}>
                        <Ionicons name="speedometer" size={12} color="#666" />
                        <Text style={styles.metaText}>{alert.speed_limit} mph</Text>
                      </View>
                    )}
                    {alert.time_restriction_start && (
                      <View style={styles.metaItem}>
                        <Ionicons name="time" size={12} color="#666" />
                        <Text style={styles.metaText}>
                          {alert.time_restriction_start} - {alert.time_restriction_end}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.alertDate}>{formatDate(alert.created_at)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.upvoteButton}
                  onPress={() => handleUpvote(alert.id)}
                >
                  <Ionicons name="arrow-up" size={20} color="#4A90E2" />
                  <Text style={styles.upvoteCount}>{alert.upvotes}</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {alerts.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="radio-outline" size={80} color="#333" />
              <Text style={styles.emptyTitle}>No alerts yet</Text>
              <Text style={styles.emptyText}>
                Be the first to report road conditions in your area!
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Alert Button */}
      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Report Alert</Text>
      </TouchableOpacity>

      {/* Add Alert Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Alert</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>Alert Type *</Text>
              <View style={styles.typeSelector}>
                {alertTypes.map((at) => (
                  <TouchableOpacity
                    key={at.type}
                    style={[
                      styles.typeOption,
                      alertType === at.type && styles.typeOptionActive,
                      { borderColor: alertType === at.type ? at.color : '#333' },
                    ]}
                    onPress={() => setAlertType(at.type)}
                  >
                    <Ionicons
                      name={at.icon as any}
                      size={24}
                      color={alertType === at.type ? at.color : '#666'}
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        alertType === at.type && { color: at.color },
                      ]}
                    >
                      {at.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add details about the alert..."
                placeholderTextColor="#666"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              {(alertType === 'speed_camera' || alertType === 'school_zone') && (
                <>
                  <Text style={styles.inputLabel}>Speed Limit (mph)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="30"
                    placeholderTextColor="#666"
                    value={speedLimit}
                    onChangeText={setSpeedLimit}
                    keyboardType="number-pad"
                  />
                </>
              )}

              {alertType === 'school_zone' && (
                <>
                  <View style={styles.dimensionsRow}>
                    <View style={styles.dimensionInput}>
                      <Text style={styles.inputLabel}>Time Start</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="08:00"
                        placeholderTextColor="#666"
                        value={timeStart}
                        onChangeText={setTimeStart}
                      />
                    </View>
                    <View style={styles.dimensionInput}>
                      <Text style={styles.inputLabel}>Time End</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="09:00"
                        placeholderTextColor="#666"
                        value={timeEnd}
                        onChangeText={setTimeEnd}
                      />
                    </View>
                  </View>
                </>
              )}

              {location && (
                <View style={styles.locationPreview}>
                  <Ionicons name="location" size={16} color="#4A90E2" />
                  <Text style={styles.locationText}>
                    Using your current location
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleAddAlert}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Report Alert</Text>
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
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginRight: 8,
  },
  filterText: {
    color: '#888',
    fontSize: 12,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertInfo: {
    flex: 1,
  },
  alertType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  alertDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
  },
  alertMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#666',
    fontSize: 12,
  },
  alertDate: {
    color: '#555',
    fontSize: 11,
  },
  upvoteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  upvoteCount: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    maxHeight: '90%',
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF6B6B',
    marginLeft: 8,
    flex: 1,
  },
  inputLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#252525',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    width: '31%',
  },
  typeOptionActive: {
    backgroundColor: '#1a2a3a',
  },
  typeLabel: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  dimensionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dimensionInput: {
    flex: 1,
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  locationText: {
    color: '#4A90E2',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
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
