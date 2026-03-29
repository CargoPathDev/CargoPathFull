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
import { useRouter } from 'expo-router';
import { RoadWork } from '../types';
import { roadworksApi } from '../services/api';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';

const workTypes = [
  { type: 'road_closure', label: 'Road Closure', icon: 'close-circle', color: '#E74C3C' },
  { type: 'lane_closure', label: 'Lane Closure', icon: 'remove-circle', color: '#E67E22' },
  { type: 'temp_traffic_lights', label: 'Temp Traffic Lights', icon: 'ellipse', color: '#F1C40F' },
  { type: 'resurfacing', label: 'Resurfacing', icon: 'layers', color: '#3498DB' },
  { type: 'utilities', label: 'Utilities Work', icon: 'construct', color: '#9B59B6' },
  { type: 'construction', label: 'Construction', icon: 'hammer', color: '#1ABC9C' },
];

export default function RoadWorkerScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [roadworks, setRoadworks] = useState<RoadWork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Form state
  const [workType, setWorkType] = useState('road_closure');
  const [description, setDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [diversionRoute, setDiversionRoute] = useState('');
  const [affectedLanes, setAffectedLanes] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  useEffect(() => {
    loadRoadworks();
    getLocation();
  }, [filterStatus]);

  const loadRoadworks = async () => {
    setIsLoading(true);
    try {
      const data = await roadworksApi.getAll(filterStatus || undefined);
      setRoadworks(data);
    } catch (error) {
      console.error('Failed to load roadworks:', error);
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

  const handleAddRoadwork = async () => {
    if (!location) {
      Alert.alert('Location Required', 'Please enable location to report roadworks');
      return;
    }

    if (!description || !companyName || !startDate || !endDate) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await roadworksApi.create({
        work_type: workType as any,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        description,
        company_name: companyName,
        start_date: startDate,
        estimated_end_date: endDate,
        diversion_route: diversionRoute || undefined,
        affected_lanes: affectedLanes || undefined,
        working_hours: workingHours || undefined,
        contact_phone: contactPhone || undefined,
      });
      setShowAddModal(false);
      resetForm();
      loadRoadworks();
      Alert.alert('Success', 'Roadwork submitted for approval');
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to submit roadwork';
      setError(typeof errorMessage === 'string' ? errorMessage : 'Failed to submit roadwork');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setWorkType('road_closure');
    setDescription('');
    setCompanyName('');
    setStartDate('');
    setEndDate('');
    setDiversionRoute('');
    setAffectedLanes('');
    setWorkingHours('');
    setContactPhone('');
    setError('');
  };

  const handleApprove = async (roadworkId: string) => {
    try {
      await roadworksApi.approve(roadworkId);
      loadRoadworks();
      Alert.alert('Success', 'Roadwork approved');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleUpdateStatus = async (roadworkId: string, newStatus: string) => {
    try {
      await roadworksApi.updateStatus(roadworkId, newStatus);
      loadRoadworks();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleDelete = async (roadworkId: string) => {
    Alert.alert('Delete Roadwork', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await roadworksApi.delete(roadworkId);
            loadRoadworks();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  const getWorkTypeInfo = (type: string) => {
    return workTypes.find((w) => w.type === type) || workTypes[0];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F39C12';
      case 'approved':
        return '#27AE60';
      case 'active':
        return '#3498DB';
      case 'completed':
        return '#95A5A6';
      default:
        return '#888';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Road Worker Portal</Text>
          <Text style={styles.subtitle}>Official roadwork management</Text>
        </View>
      </View>

      {/* Status Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterStatus === '' && styles.filterChipActive]}
          onPress={() => setFilterStatus('')}
        >
          <Text style={[styles.filterText, filterStatus === '' && styles.filterTextActive]}>
            All Active
          </Text>
        </TouchableOpacity>
        {['pending', 'approved', 'active', 'completed'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterChip, filterStatus === status && styles.filterChipActive]}
            onPress={() => setFilterStatus(status)}
          >
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
            <Text
              style={[styles.filterText, filterStatus === status && styles.filterTextActive]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {roadworks.map((roadwork) => {
            const workInfo = getWorkTypeInfo(roadwork.work_type);
            return (
              <View key={roadwork.id} style={styles.roadworkCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.workIcon, { backgroundColor: `${workInfo.color}20` }]}>
                    <Ionicons name={workInfo.icon as any} size={24} color={workInfo.color} />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.workType}>{workInfo.label}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(roadwork.status) }]}>
                      <Text style={styles.statusText}>{roadwork.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  {roadwork.verified && (
                    <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                  )}
                </View>

                <Text style={styles.description}>{roadwork.description}</Text>
                <Text style={styles.company}>{roadwork.company_name}</Text>

                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar" size={14} color="#888" />
                    <Text style={styles.detailText}>
                      {roadwork.start_date} - {roadwork.estimated_end_date}
                    </Text>
                  </View>
                  {roadwork.working_hours && (
                    <View style={styles.detailItem}>
                      <Ionicons name="time" size={14} color="#888" />
                      <Text style={styles.detailText}>{roadwork.working_hours}</Text>
                    </View>
                  )}
                  {roadwork.affected_lanes && (
                    <View style={styles.detailItem}>
                      <Ionicons name="git-branch" size={14} color="#888" />
                      <Text style={styles.detailText}>{roadwork.affected_lanes}</Text>
                    </View>
                  )}
                </View>

                {roadwork.diversion_route && (
                  <View style={styles.diversionBox}>
                    <Ionicons name="navigate" size={16} color="#4A90E2" />
                    <Text style={styles.diversionText}>Diversion: {roadwork.diversion_route}</Text>
                  </View>
                )}

                {/* Admin Actions */}
                {user?.role === 'admin' && roadwork.status === 'pending' && (
                  <View style={styles.adminActions}>
                    <TouchableOpacity
                      style={styles.approveButton}
                      onPress={() => handleApprove(roadwork.id)}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.actionText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => handleDelete(roadwork.id)}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                      <Text style={styles.actionText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Status Update Actions */}
                {roadwork.status === 'approved' && (
                  <TouchableOpacity
                    style={styles.startButton}
                    onPress={() => handleUpdateStatus(roadwork.id, 'active')}
                  >
                    <Ionicons name="play" size={16} color="#fff" />
                    <Text style={styles.actionText}>Start Work</Text>
                  </TouchableOpacity>
                )}

                {roadwork.status === 'active' && (
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={() => handleUpdateStatus(roadwork.id, 'completed')}
                  >
                    <Ionicons name="checkmark-done" size={16} color="#fff" />
                    <Text style={styles.actionText}>Mark Complete</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {roadworks.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="construct-outline" size={80} color="#333" />
              <Text style={styles.emptyTitle}>No roadworks found</Text>
              <Text style={styles.emptyText}>
                {filterStatus ? `No ${filterStatus} roadworks` : 'No active roadworks in your area'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Roadwork Button */}
      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Submit Roadwork</Text>
      </TouchableOpacity>

      {/* Add Roadwork Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Roadwork</Text>
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

              <Text style={styles.inputLabel}>Work Type *</Text>
              <View style={styles.typeSelector}>
                {workTypes.map((wt) => (
                  <TouchableOpacity
                    key={wt.type}
                    style={[
                      styles.typeOption,
                      workType === wt.type && styles.typeOptionActive,
                      { borderColor: workType === wt.type ? wt.color : '#333' },
                    ]}
                    onPress={() => setWorkType(wt.type)}
                  >
                    <Ionicons
                      name={wt.icon as any}
                      size={20}
                      color={workType === wt.type ? wt.color : '#666'}
                    />
                    <Text
                      style={[styles.typeLabel, workType === wt.type && { color: wt.color }]}
                    >
                      {wt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the roadwork..."
                placeholderTextColor="#666"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Company Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Your company name"
                placeholderTextColor="#666"
                value={companyName}
                onChangeText={setCompanyName}
              />

              <View style={styles.dimensionsRow}>
                <View style={styles.dimensionInput}>
                  <Text style={styles.inputLabel}>Start Date *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#666"
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                </View>
                <View style={styles.dimensionInput}>
                  <Text style={styles.inputLabel}>End Date *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#666"
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Diversion Route (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Via A40 and M25"
                placeholderTextColor="#666"
                value={diversionRoute}
                onChangeText={setDiversionRoute}
              />

              <Text style={styles.inputLabel}>Affected Lanes (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Lane 1 and 2 closed"
                placeholderTextColor="#666"
                value={affectedLanes}
                onChangeText={setAffectedLanes}
              />

              <Text style={styles.inputLabel}>Working Hours (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 08:00-18:00"
                placeholderTextColor="#666"
                value={workingHours}
                onChangeText={setWorkingHours}
              />

              <Text style={styles.inputLabel}>Contact Phone (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="+44 XXX XXX XXXX"
                placeholderTextColor="#666"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />

              {location && (
                <View style={styles.locationPreview}>
                  <Ionicons name="location" size={16} color="#4A90E2" />
                  <Text style={styles.locationText}>Using your current location</Text>
                </View>
              )}

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={16} color="#888" />
                <Text style={styles.infoText}>
                  Submitted roadworks require admin approval before appearing to drivers.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleAddRoadwork}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit for Approval</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  filterScroll: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#4A90E2',
  },
  filterText: {
    color: '#888',
    fontSize: 13,
  },
  filterTextActive: {
    color: '#fff',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  roadworkCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  workIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  workType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  description: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  company: {
    color: '#4A90E2',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#888',
    fontSize: 12,
  },
  diversionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  diversionText: {
    color: '#4A90E2',
    fontSize: 13,
    flex: 1,
  },
  adminActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27AE60',
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27AE60',
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
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
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#E67E22',
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
    maxHeight: '95%',
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
    padding: 10,
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
    fontSize: 9,
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
    marginBottom: 12,
  },
  locationText: {
    color: '#4A90E2',
    fontSize: 14,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  infoText: {
    color: '#888',
    fontSize: 12,
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#E67E22',
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
