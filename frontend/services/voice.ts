import { Audio } from 'expo-av';
import api from './api';

export type VoiceName = 'adam' | 'rachel' | 'brian' | 'default';

class VoiceService {
  private sound: Audio.Sound | null = null;
  private currentVoice: VoiceName = 'default';

  async initialize() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  setVoice(voice: VoiceName) {
    this.currentVoice = voice;
  }

  async speak(text: string, voice?: VoiceName): Promise<void> {
    try {
      // Unload previous sound
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      const voiceToUse = voice || this.currentVoice;

      // Get audio from backend
      const response = await api.post(
        '/api/voice/synthesize',
        { text, voice: voiceToUse },
        { responseType: 'arraybuffer' }
      );

      // Convert to base64
      const base64Audio = btoa(
        new Uint8Array(response.data).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      // Create and play sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${base64Audio}` },
        { shouldPlay: true }
      );

      this.sound = sound;

      // Wait for playback to finish
      return new Promise((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Failed to speak:', error);
      throw error;
    }
  }

  async previewVoice(voiceName: VoiceName): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      const response = await api.get(`/api/voice/preview/${voiceName}`, {
        responseType: 'arraybuffer',
      });

      const base64Audio = btoa(
        new Uint8Array(response.data).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${base64Audio}` },
        { shouldPlay: true }
      );

      this.sound = sound;
    } catch (error) {
      console.error('Failed to preview voice:', error);
      throw error;
    }
  }

  async stop() {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
    }
  }

  // Navigation-specific announcements
  async announceAlert(alertType: string, description: string) {
    const messages = {
      speed_camera: `Attention! Speed camera ahead. ${description}`,
      roadwork: `Caution! Roadwork ahead. ${description}`,
      hazard: `Warning! Hazard on the road. ${description}`,
      school_zone: `Attention! Entering school zone. Reduce speed.`,
      bump: `Caution! Speed bump ahead.`,
      traffic_light: `Traffic light ahead.`,
    };

    const message = messages[alertType as keyof typeof messages] || description;
    await this.speak(message);
  }

  async announceRestriction(restrictionType: string, limit: number) {
    const unit = restrictionType === 'weight' ? 'kilograms' : 'meters';
    const message = `Warning! ${restrictionType} restriction ahead. Limit is ${limit} ${unit}. Your vehicle may not be compatible.`;
    await this.speak(message);
  }

  async announceNavigation(instruction: string, distance: string) {
    const message = `In ${distance}, ${instruction}`;
    await this.speak(message);
  }

  async announceArrival() {
    await this.speak('You have arrived at your destination.');
  }
}

export const voiceService = new VoiceService();
