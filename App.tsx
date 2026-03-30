import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useNoteStore } from './src/store/noteStore';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const loadData = useNoteStore(state => state.loadData);
  const theme = useNoteStore(state => state.settings.theme);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <NavigationContainer>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <AppNavigator />
    </NavigationContainer>
  );
}
