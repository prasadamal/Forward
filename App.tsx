import React, { useEffect } from 'react';
import { useColorScheme, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useNoteStore } from './src/store/noteStore';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';

function navigateToShare(url: string) {
  // Parse forward://share?text=…&mode=…
  try {
    const withoutScheme = url.replace('forward://share', '');
    const params = new URLSearchParams(withoutScheme.replace(/^\?/, ''));
    const text = decodeURIComponent(params.get('text') || '');
    const mode = (params.get('mode') === 'auto' ? 'auto' : 'picker') as 'auto' | 'picker';
    if (text && navigationRef.isReady()) {
      navigationRef.navigate('ShareReceived', { sharedText: text, mode });
    }
  } catch {
    // ignore malformed deep links
  }
}

export default function App() {
  const loadData = useNoteStore(state => state.loadData);
  const settings = useNoteStore(state => state.settings);
  const systemScheme = useColorScheme();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Handle deep link that launched the app
    Linking.getInitialURL().then(url => {
      if (url && url.startsWith('forward://share')) {
        navigateToShare(url);
      }
    });

    // Handle deep links while app is already in foreground/background
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('forward://share')) {
        navigateToShare(url);
      }
    });

    return () => sub.remove();
  }, []);

  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && systemScheme !== 'light');

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}
