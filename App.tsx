import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useNoteStore } from './src/store/noteStore';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const loadData = useNoteStore(state => state.loadData);
  const settings = useNoteStore(state => state.settings);
  const systemScheme = useColorScheme();

  useEffect(() => {
    loadData();
  }, []);

  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && systemScheme !== 'light');

  return (
    <NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}
