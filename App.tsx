import React, { useEffect } from 'react';
import { useColorScheme, Linking, View, ActivityIndicator, Alert } from 'react-native';
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
  } catch (error) {
    console.error('[App] Failed to process deep link', error);
  }
}

export default function App() {
  const loadData = useNoteStore(state => state.loadData);
  const isLoading = useNoteStore(state => state.isLoading);
  const settings = useNoteStore(state => state.settings);
  const storageError = useNoteStore(state => state.storageError);
  const dismissStorageError = useNoteStore(state => state.dismissStorageError);
  const systemScheme = useColorScheme();

  useEffect(() => {
    loadData();
  }, []);

  // Handle deep links while app is already in foreground/background
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('forward://share')) {
        navigateToShare(url);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!storageError) return;
    Alert.alert('Storage Issue', storageError, [
      { text: 'OK', onPress: dismissStorageError },
    ]);
  }, [storageError, dismissStorageError]);

  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && systemScheme !== 'light');

  // Show a minimal loading screen while data is being read from AsyncStorage.
  // This prevents a flash of empty content before the store is hydrated.
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? '#0A0A0A' : '#F5F5F5',
        }}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color="#7C6FE0" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        // Process the URL that originally opened this app (e.g. share intent).
        // Using onReady guarantees the navigator is fully mounted before we try
        // to navigate, so navigationRef.isReady() will always be true here.
        Linking.getInitialURL().then(url => {
          if (url && url.startsWith('forward://share')) {
            navigateToShare(url);
          }
        });
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}
