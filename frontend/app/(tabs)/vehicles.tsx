import React, { useState } from 'react';
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
import { useVehicle } from '../../contexts/VehicleContext';
import { useAuth } from '../../contexts/AuthContext';
import { VehicleType } from '../../types';

const vehicleTypes: { type: VehicleType; label: string; icon: string }[] = [
  { type: 'car', label: 'Car', icon: 'car-sport' },
  { type: 'van', label: 'Van', icon: 'car' },
  { type: 'lorry', label: 'Lorry', icon: 'bus' },
  { type: 'bus', label: 'Bus', icon: 'bus' },
  { type: 'motorcycle', label: 'Motorcycle', icon: 'bicycle' },
  { type: 'other', label: 'Other', icon: 'help-circle' },
];

export default function VehiclesScreen() {
  const { vehicles, activeVehicle, isLoading, setActiveVehicle, addVehicle, deleteVehicle } =
    useVehicle();
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [height, setHeight] = useState('');
  const [width, setWidth] = useState('');
  const [weight, setWeight] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  const vehicleLimit = user?.subscription_tier === 'premium' ? 10 : user?.subscription_tier === 'basic' ? 5 : 2;

  const handleAddVehicle = async () => {
    if (!name || !height || !width || !weight) {
      setError('Please fill in all required fields');
      return;
    }

    const heightNum = parseFloat(height);
    const widthNum = parseFloat(width);
    const weightNum = parseFloat(weight);

    if (isNaN(heightNum) || isNaN(widthNum) || isNaN(weightNum)) {
      setError('Please enter valid numbers for dimensions');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await addVehicle({
        name,
        vehicle_type: vehicleType,
        height_meters: heightNum,
        width_meters: widthNum,
        weight_kg: weightNum,
        license_plate: licensePlate || undefined,
      });
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to add vehicle';
      setError(typeof errorMessage === 'string' ? errorMessage : 'Failed to add vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setVehicleType('car');
    setHeight('');
    setWidth('');
    setWeight('');
    setLicensePlate('');
    setError('');
  };

  const handleDeleteVehicle = (vehicleId: string, vehicleName: string) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to delete "${vehicleName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVehicle(vehicleId);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete vehicle');
            }
          },
        },
      ]
    );
  };

  const handleActivateVehicle = async (vehicleId: string) => {
    try {
      await setActiveVehicle(vehicleId);
    } catch (error) {
      Alert.alert('Error', 'Failed to activate vehicle');
    }
  };

  const getVehicleIcon = (type: string) => {
    return vehicleTypes.find((v) => v.type === type)?.icon || 'car';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Vehicles</Text>
        <Text style={styles.subtitle}>
          {vehicles.length}/{vehicleLimit} vehicles
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {vehicles.map((vehicle) => (
            <TouchableOpacity
              key={vehicle.id}
              style={[
                styles.vehicleCard,
                vehicle.is_active && styles.activeVehicleCard,
              ]}
              onPress={() => handleActivateVehicle(vehicle.id)}
              activeOpacity={0.7}
            >
              <View style={styles.vehicleIcon}>
                <Ionicons
                  name={getVehicleIcon(vehicle.vehicle_type) as any}
                  size={32}
                  color={vehicle.is_active ? '#4A90E2' : '#666'}
                />
              </View>
              <View style={styles.vehicleInfo}>
                <View style={styles.vehicleHeader}>
                  <Text style={styles.vehicleName}>{vehicle.name}</Text>
                  {vehicle.is_active && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.vehicleType}>{vehicle.vehicle_type}</Text>
                <View style={styles.vehicleSpecs}>
                  <Text style={styles.specText}>H: {vehicle.height_meters}m</Text>
                  <Text style={styles.specText}>W: {vehicle.width_meters}m</Text>
                  <Text style={styles.specText}>{vehicle.weight_kg}kg</Text>
                </View>
                {vehicle.license_plate && (
                  <Text style={styles.licensePlate}>{vehicle.license_plate}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteVehicle(vehicle.id, vehicle.name)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {vehicles.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="car-sport-outline" size={80} color="#333" />
              <Text style={styles.emptyTitle}>No vehicles yet</Text>
              <Text style={styles.emptyText}>
                Add your first vehicle to get personalized navigation based on your
                vehicle's dimensions.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Vehicle Button */}
      <TouchableOpacity
        style={[
          styles.addButton,
          vehicles.length >= vehicleLimit && styles.addButtonDisabled,
        ]}
        onPress={() => {
          if (vehicles.length >= vehicleLimit) {
            Alert.alert(
              'Upgrade Required',
              `You've reached the ${vehicleLimit} vehicle limit for your ${user?.subscription_tier} plan. Upgrade to add more vehicles.`
            );
          } else {
            setShowAddModal(true);
          }
        }}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Add Vehicle</Text>
      </TouchableOpacity>

      {/* Add Vehicle Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Vehicle</Text>
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

              <Text style={styles.inputLabel}>Vehicle Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., My Work Lorry"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>Vehicle Type *</Text>
              <View style={styles.typeSelector}>
                {vehicleTypes.map((vt) => (
                  <TouchableOpacity
                    key={vt.type}
                    style={[
                      styles.typeOption,
                      vehicleType === vt.type && styles.typeOptionActive,
                    ]}
                    onPress={() => setVehicleType(vt.type)}
                  >
                    <Ionicons
                      name={vt.icon as any}
                      size={24}
                      color={vehicleType === vt.type ? '#4A90E2' : '#666'}
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        vehicleType === vt.type && styles.typeLabelActive,
                      ]}
                    >
                      {vt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.dimensionsRow}>
                <View style={styles.dimensionInput}>
                  <Text style={styles.inputLabel}>Height (m) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2.5"
                    placeholderTextColor="#666"
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.dimensionInput}>
                  <Text style={styles.inputLabel}>Width (m) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2.0"
                    placeholderTextColor="#666"
                    value={width}
                    onChangeText={setWidth}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Weight (kg) *</Text>
              <TextInput
                style={styles.input}
                placeholder="3500"
                placeholderTextColor="#666"
                value={weight}
                onChangeText={setWeight}
                keyboardType="number-pad"
              />

              <Text style={styles.inputLabel}>License Plate (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="AB12 CDE"
                placeholderTextColor="#666"
                value={licensePlate}
                onChangeText={setLicensePlate}
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleAddVehicle}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Vehicle</Text>
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
  vehicleCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  activeVehicleCard: {
    borderColor: '#4A90E2',
    backgroundColor: '#1a2a3a',
  },
  vehicleIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  activeBadge: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  vehicleType: {
    fontSize: 14,
    color: '#888',
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  vehicleSpecs: {
    flexDirection: 'row',
    gap: 12,
  },
  specText: {
    color: '#666',
    fontSize: 12,
  },
  licensePlate: {
    color: '#4A90E2',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
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
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#333',
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
    borderColor: '#4A90E2',
    backgroundColor: '#1a2a3a',
  },
  typeLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  typeLabelActive: {
    color: '#4A90E2',
  },
  dimensionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dimensionInput: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
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
