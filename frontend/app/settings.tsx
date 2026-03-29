import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { UserSettings } from '../types';
import { settingsApi } from '../services/api';

const voiceOptions = [
  { id: 'default', name: 'Default Voice', icon: 'mic' },
  { id: 'adam', name: 'Adam', icon: 'mic', premium: true },
  { id: 'rachel', name: 'Rachel', icon: 'mic', premium: true },
  { id: 'brian', name: 'Brian', icon: 'mic', premium: true },
  { id: 'off', name: 'No Voice', icon: 'mic-off' },
];

const soundModes = [
  { id: 'full', name: 'Full Navigation', icon: 'volume-high', desc: 'Voice + alerts' },
  { id: 'alerts', name: 'Alerts Only', icon: 'notifications', desc: 'Speed cameras, police' },
  { id: 'off', name: 'Sound Off', icon: 'volume-mute', desc: 'Silent mode' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await settingsApi.get();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key: keyof UserSettings, value: any) => {
    if (!settings) return;
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    try {
      await settingsApi.update({ [key]: value });
    } catch (error) {
      Alert.alert('Error', 'Failed to save setting');
      setSettings(settings); // Revert
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
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Display & Theme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon" size={22} color="#888" />
              <Text style={styles.settingLabel}>Theme</Text>
            </View>
            <View style={styles.themeSelector}>
              {['light', 'dark', 'auto'].map((theme) => (
                <TouchableOpacity
                  key={theme}
                  style={[
                    styles.themeOption,
                    settings?.theme === theme && styles.themeOptionActive,
                  ]}
                  onPress={() => updateSetting('theme', theme)}
                >
                  <Text style={[
                    styles.themeText,
                    settings?.theme === theme && styles.themeTextActive,
                  ]}>
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {settings?.theme === 'auto' && (
            <View style={styles.autoTimeInfo}>
              <Ionicons name="sunny" size={16} color="#F39C12" />
              <Text style={styles.autoTimeText}>
                Light: {settings.dark_mode_end} - {settings.dark_mode_start}
              </Text>
              <Ionicons name="moon" size={16} color="#9B59B6" />
              <Text style={styles.autoTimeText}>
                Dark: {settings.dark_mode_start} - {settings.dark_mode_end}
              </Text>
            </View>
          )}
        </View>

        {/* Sound & Voice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sound & Voice</Text>
          
          <Text style={styles.subLabel}>Sound Mode</Text>
          {soundModes.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.optionCard,
                settings?.sound_mode === mode.id && styles.optionCardActive,
              ]}
              onPress={() => updateSetting('sound_mode', mode.id)}
            >
              <Ionicons
                name={mode.icon as any}
                size={24}
                color={settings?.sound_mode === mode.id ? '#4A90E2' : '#888'}
              />
              <View style={styles.optionInfo}>
                <Text style={[
                  styles.optionName,
                  settings?.sound_mode === mode.id && styles.optionNameActive,
                ]}>
                  {mode.name}
                </Text>
                <Text style={styles.optionDesc}>{mode.desc}</Text>
              </View>
              {settings?.sound_mode === mode.id && (
                <Ionicons name="checkmark-circle" size={24} color="#4A90E2" />
              )}
            </TouchableOpacity>
          ))}

          <Text style={[styles.subLabel, { marginTop: 16 }]}>Navigation Voice</Text>
          {voiceOptions.map((voice) => (
            <TouchableOpacity
              key={voice.id}
              style={[
                styles.optionCard,
                settings?.voice_id === voice.id && styles.optionCardActive,
              ]}
              onPress={() => updateSetting('voice_id', voice.id)}
            >
              <Ionicons
                name={voice.icon as any}
                size={24}
                color={settings?.voice_id === voice.id ? '#4A90E2' : '#888'}
              />
              <View style={styles.optionInfo}>
                <Text style={[
                  styles.optionName,
                  settings?.voice_id === voice.id && styles.optionNameActive,
                ]}>
                  {voice.name}
                </Text>
                {voice.premium && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="star" size={10} color="#FFD700" />
                    <Text style={styles.premiumText}>Premium</Text>
                  </View>
                )}
              </View>
              {settings?.voice_id === voice.id && (
                <Ionicons name="checkmark-circle" size={24} color="#4A90E2" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Units */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Units</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="speedometer" size={22} color="#888" />
              <Text style={styles.settingLabel}>Speed</Text>
            </View>
            <View style={styles.unitSelector}>
              {['mph', 'kmh'].map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.unitOption,
                    settings?.speed_unit === unit && styles.unitOptionActive,
                  ]}
                  onPress={() => updateSetting('speed_unit', unit)}
                >
                  <Text style={[
                    styles.unitText,
                    settings?.speed_unit === unit && styles.unitTextActive,
                  ]}>
                    {unit.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="navigate" size={22} color="#888" />
              <Text style={styles.settingLabel}>Distance</Text>
            </View>
            <View style={styles.unitSelector}>
              {['miles', 'km'].map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.unitOption,
                    settings?.distance_unit === unit && styles.unitOptionActive,
                  ]}
                  onPress={() => updateSetting('distance_unit', unit)}
                >
                  <Text style={[
                    styles.unitText,
                    settings?.distance_unit === unit && styles.unitTextActive,
                  ]}>
                    {unit.charAt(0).toUpperCase() + unit.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Safety */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="shield-checkmark" size={22} color="#27AE60" />
              <View>
                <Text style={styles.settingLabel}>Safety Reminders</Text>
                <Text style={styles.settingDesc}>Remind not to text while driving</Text>
              </View>
            </View>
            <Switch
              value={settings?.safety_reminder_enabled}
              onValueChange={(value) => updateSetting('safety_reminder_enabled', value)}
              trackColor={{ false: '#333', true: '#27AE60' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Saved Places */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Places</Text>
          
          <TouchableOpacity style={styles.placeCard}>
            <Ionicons name="home" size={24} color="#4A90E2" />
            <View style={styles.placeInfo}>
              <Text style={styles.placeLabel}>Home</Text>
              <Text style={styles.placeAddress}>
                {settings?.home_address?.address || 'Not set'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.placeCard}>
            <Ionicons name="briefcase" size={24} color="#E67E22" />
            <View style={styles.placeInfo}>
              <Text style={styles.placeLabel}>Work</Text>
              <Text style={styles.placeAddress}>
                {settings?.work_address?.address || 'Not set'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
        </View>

        {/* More Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/rewards')}>
            <Ionicons name="gift" size={22} color="#E74C3C" />
            <Text style={styles.menuText}>Rewards Shop</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="language" size={22} color="#888" />
            <Text style={styles.menuText}>Language</Text>
            <Text style={styles.menuValue}>English</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle" size={22} color="#888" />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="document-text" size={22} color="#888" />
            <Text style={styles.menuText}>Terms & Privacy</Text>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>CargoPaths v1.0.0</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
  },
  settingDesc: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  themeSelector: {
    flexDirection: 'row',
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 4,
  },
  themeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  themeOptionActive: {
    backgroundColor: '#4A90E2',
  },
  themeText: {
    color: '#888',
    fontSize: 13,
  },
  themeTextActive: {
    color: '#fff',
  },
  autoTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  autoTimeText: {
    color: '#888',
    fontSize: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  optionCardActive: {
    borderColor: '#4A90E2',
    backgroundColor: '#1a2a3a',
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    color: '#ccc',
    fontSize: 15,
  },
  optionNameActive: {
    color: '#fff',
  },
  optionDesc: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  premiumText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '600',
  },
  unitSelector: {
    flexDirection: 'row',
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 4,
  },
  unitOption: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unitOptionActive: {
    backgroundColor: '#4A90E2',
  },
  unitText: {
    color: '#888',
    fontSize: 13,
  },
  unitTextActive: {
    color: '#fff',
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  placeAddress: {
    color: '#666',
    fontSize: 13,
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  menuText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  menuValue: {
    color: '#888',
    fontSize: 14,
  },
  version: {
    textAlign: 'center',
    color: '#444',
    fontSize: 12,
    marginTop: 24,
  },
});
