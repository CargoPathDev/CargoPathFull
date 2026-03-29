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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { CorporateAccount, Employee, Vehicle } from '../types';
import { corporateApi, vehiclesApi } from '../services/api';

export default function CorporateScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [company, setCompany] = useState<CorporateAccount | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');

  useEffect(() => {
    if (!user?.corporate_id) {
      Alert.alert('Access Denied', 'Corporate account required');
      router.back();
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [companyData, employeesData, vehiclesData] = await Promise.all([
        corporateApi.getMyCompany(),
        corporateApi.getEmployees(),
        vehiclesApi.getAll(),
      ]);
      setCompany(companyData);
      setEmployees(employeesData);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('Failed to load corporate data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployeeEmail) {
      Alert.alert('Error', 'Please enter employee email');
      return;
    }

    setIsSubmitting(true);
    try {
      await corporateApi.addEmployee(newEmployeeEmail, selectedVehicle || undefined);
      setShowAddModal(false);
      setNewEmployeeEmail('');
      setSelectedVehicle('');
      await loadData();
      Alert.alert('Success', 'Employee added successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveEmployee = (email: string, name: string) => {
    Alert.alert(
      'Remove Employee',
      `Remove ${name} from the company account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await corporateApi.removeEmployee(email);
              await loadData();
              Alert.alert('Success', 'Employee removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove employee');
            }
          },
        },
      ]
    );
  };

  const handleToggleSafetyMode = async (enabled: boolean) => {
    try {
      await corporateApi.toggleSafetyMode(enabled);
      if (company) {
        setCompany({ ...company, safety_mode_enabled: enabled });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update safety mode');
    }
  };

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
        <View style={styles.headerText}>
          <Text style={styles.title}>{company?.company_name || 'Corporate'}</Text>
          <Text style={styles.subtitle}>Fleet Management</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={28} color="#4A90E2" />
            <Text style={styles.statNumber}>{company?.employee_count || 0}</Text>
            <Text style={styles.statLabel}>Employees</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="car-sport" size={28} color="#27AE60" />
            <Text style={styles.statNumber}>{company?.vehicle_count || 0}</Text>
            <Text style={styles.statLabel}>Vehicles</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="apps" size={28} color="#E67E22" />
            <Text style={styles.statNumber}>{company?.max_vehicles || 100}</Text>
            <Text style={styles.statLabel}>Max Vehicles</Text>
          </View>
        </View>

        {/* Safety Mode */}
        {user?.is_corporate_admin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Safety Controls</Text>
            <View style={styles.safetyCard}>
              <View style={styles.safetyInfo}>
                <Ionicons name="shield-checkmark" size={32} color="#27AE60" />
                <View style={styles.safetyText}>
                  <Text style={styles.safetyTitle}>Safety Mode</Text>
                  <Text style={styles.safetyDesc}>
                    When enabled, employees cannot type destinations while the vehicle is in motion
                  </Text>
                </View>
              </View>
              <Switch
                value={company?.safety_mode_enabled}
                onValueChange={handleToggleSafetyMode}
                trackColor={{ false: '#333', true: '#27AE60' }}
                thumbColor="#fff"
              />
            </View>
          </View>
        )}

        {/* Employees */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Employees</Text>
            {user?.is_corporate_admin && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddModal(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {employees.map((emp) => (
            <View key={emp.id} style={styles.employeeCard}>
              <View style={styles.employeeAvatar}>
                <Text style={styles.avatarText}>
                  {emp.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{emp.name}</Text>
                <Text style={styles.employeeEmail}>{emp.email}</Text>
                {emp.assigned_vehicle_id && (
                  <View style={styles.vehicleBadge}>
                    <Ionicons name="car-sport" size={12} color="#4A90E2" />
                    <Text style={styles.vehicleText}>Vehicle assigned</Text>
                  </View>
                )}
              </View>
              {user?.is_corporate_admin && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveEmployee(emp.email, emp.name)}
                >
                  <Ionicons name="close-circle" size={24} color="#E74C3C" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {employees.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={60} color="#333" />
              <Text style={styles.emptyText}>No employees added yet</Text>
            </View>
          )}
        </View>

        {/* Fleet Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fleet Vehicles</Text>
          {vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.vehicleCard}>
              <Ionicons
                name={vehicle.vehicle_type === 'lorry' ? 'bus' : 'car-sport'}
                size={24}
                color="#4A90E2"
              />
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleName}>{vehicle.name}</Text>
                <Text style={styles.vehicleSpecs}>
                  {vehicle.height_meters}m × {vehicle.width_meters}m × {vehicle.weight_kg}kg
                </Text>
              </View>
              {vehicle.license_plate && (
                <Text style={styles.licensePlate}>{vehicle.license_plate}</Text>
              )}
            </View>
          ))}

          {vehicles.length === 0 && (
            <TouchableOpacity
              style={styles.addVehicleCard}
              onPress={() => router.push('/(tabs)/vehicles')}
            >
              <Ionicons name="add-circle" size={40} color="#4A90E2" />
              <Text style={styles.addVehicleText}>Add Fleet Vehicle</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Add Employee Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Employee</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>Employee Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="employee@company.com"
                placeholderTextColor="#666"
                value={newEmployeeEmail}
                onChangeText={setNewEmployeeEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Assign Vehicle (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleSelector}>
                <TouchableOpacity
                  style={[
                    styles.vehicleOption,
                    !selectedVehicle && styles.vehicleOptionActive,
                  ]}
                  onPress={() => setSelectedVehicle('')}
                >
                  <Text style={styles.vehicleOptionText}>None</Text>
                </TouchableOpacity>
                {vehicles.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.vehicleOption,
                      selectedVehicle === v.id && styles.vehicleOptionActive,
                    ]}
                    onPress={() => setSelectedVehicle(v.id)}
                  >
                    <Text style={styles.vehicleOptionText}>{v.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={16} color="#888" />
                <Text style={styles.infoText}>
                  If the employee already has an account, they will be upgraded to corporate access.
                  Otherwise, an invitation will be sent.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleAddEmployee}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Employee</Text>
                )}
              </TouchableOpacity>
            </View>
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
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  safetyCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  safetyInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  safetyText: {
    flex: 1,
  },
  safetyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  safetyDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  employeeEmail: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  vehicleText: {
    color: '#4A90E2',
    fontSize: 11,
  },
  removeButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#888',
    marginTop: 12,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  vehicleSpecs: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  licensePlate: {
    color: '#4A90E2',
    fontWeight: '600',
    fontSize: 12,
  },
  addVehicleCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  addVehicleText: {
    color: '#4A90E2',
    marginTop: 8,
    fontWeight: '500',
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
  vehicleSelector: {
    marginBottom: 16,
  },
  vehicleOption: {
    backgroundColor: '#252525',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  vehicleOptionActive: {
    backgroundColor: '#4A90E2',
  },
  vehicleOptionText: {
    color: '#fff',
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    color: '#888',
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
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
