import React, { createContext, useContext, useState, useEffect } from 'react';
import { voiceService, VoiceName } from '../services/voice';
import { settingsApi } from '../services/api';
import { useAuth } from './AuthContext';

interface VoiceContextType {
  currentVoice: VoiceName;
  setVoice: (voice: VoiceName) => void;
  speak: (text: string) => Promise<void>;
  previewVoice: (voice: VoiceName) => Promise<void>;
  isVoiceEnabled: boolean;
  toggleVoice: () => void;
  announceAlert: (alertType: string, description: string) => Promise<void>;
  announceRestriction: (restrictionType: string, limit: number) => Promise<void>;
}

const VoiceContext = createContext<VoiceContextType>({
  currentVoice: 'default',
  setVoice: () => {},
  speak: async () => {},
  previewVoice: async () => {},
  isVoiceEnabled: true,
  toggleVoice: () => {},
  announceAlert: async () => {},
  announceRestriction: async () => {},
});

export const useVoice = () => useContext(VoiceContext);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isGuest } = useAuth();
  const [currentVoice, setCurrentVoice] = useState<VoiceName>('default');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  useEffect(() => {
    // Initialize audio
    voiceService.initialize();

    // Load user's voice preference
    if (!isGuest && user) {
      loadVoicePreference();
    }
  }, [user, isGuest]);

  const loadVoicePreference = async () => {
    try {
      const settings = await settingsApi.get();
      if (settings.voice_id) {
        setCurrentVoice(settings.voice_id as VoiceName);
        voiceService.setVoice(settings.voice_id as VoiceName);
      }
      if (settings.voice_enabled !== undefined) {
        setIsVoiceEnabled(settings.voice_enabled);
      }
    } catch (error) {
      console.error('Failed to load voice preference:', error);
    }
  };

  const setVoice = async (voice: VoiceName) => {
    setCurrentVoice(voice);
    voiceService.setVoice(voice);

    // Save to backend
    if (!isGuest) {
      try {
        await settingsApi.update({ voice_id: voice });
      } catch (error) {
        console.error('Failed to save voice preference:', error);
      }
    }
  };

  const toggleVoice = async () => {
    const newState = !isVoiceEnabled;
    setIsVoiceEnabled(newState);

    // Save to backend
    if (!isGuest) {
      try {
        await settingsApi.update({ voice_enabled: newState });
      } catch (error) {
        console.error('Failed to save voice toggle:', error);
      }
    }
  };

  const speak = async (text: string) => {
    if (!isVoiceEnabled) return;
    try {
      await voiceService.speak(text);
    } catch (error) {
      console.error('Failed to speak:', error);
    }
  };

  const previewVoice = async (voice: VoiceName) => {
    try {
      await voiceService.previewVoice(voice);
    } catch (error) {
      console.error('Failed to preview voice:', error);
    }
  };

  const announceAlert = async (alertType: string, description: string) => {
    if (!isVoiceEnabled) return;
    try {
      await voiceService.announceAlert(alertType, description);
    } catch (error) {
      console.error('Failed to announce alert:', error);
    }
  };

  const announceRestriction = async (restrictionType: string, limit: number) => {
    if (!isVoiceEnabled) return;
    try {
      await voiceService.announceRestriction(restrictionType, limit);
    } catch (error) {
      console.error('Failed to announce restriction:', error);
    }
  };

  return (
    <VoiceContext.Provider
      value={{
        currentVoice,
        setVoice,
        speak,
        previewVoice,
        isVoiceEnabled,
        toggleVoice,
        announceAlert,
        announceRestriction,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};
