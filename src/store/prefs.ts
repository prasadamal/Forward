import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemePreference } from '../types';

/**
 * Non-sensitive preferences needed before the vault is unlocked (the lock
 * screen has to know the theme). Nothing personal is stored here.
 */
const PREFS_KEY = 'forward.prefs.v2';

interface Prefs {
  theme: ThemePreference;
}

interface PrefsStore extends Prefs {
  loaded: boolean;
  load: () => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
}

function normalizeTheme(v: unknown): ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export const usePrefs = create<PrefsStore>((set, get) => ({
  theme: 'system',
  loaded: false,
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
      set({ theme: normalizeTheme(parsed.theme), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  setTheme: async theme => {
    set({ theme });
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ theme: get().theme }));
    } catch {
      // Preference is cosmetic; ignore storage failures.
    }
  },
}));
