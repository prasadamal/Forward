import { useColorScheme } from 'react-native';
import { useNoteStore } from '../store/noteStore';
import { Colors } from '../constants/colors';

export function useTheme() {
  const settings = useNoteStore(state => state.settings);
  const systemScheme = useColorScheme();

  let theme: 'light' | 'dark';
  if (settings.theme === 'system') {
    theme = systemScheme === 'light' ? 'light' : 'dark';
  } else {
    theme = settings.theme;
  }

  return { colors: Colors[theme], theme };
}
