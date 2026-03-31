import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import TabNavigator from './TabNavigator';
import NoteDetailScreen from '../screens/NoteDetailScreen';
import FolderDetailScreen from '../screens/FolderDetailScreen';
import AddNoteScreen from '../screens/AddNoteScreen';
import EditNoteScreen from '../screens/EditNoteScreen';
import ShareReceivedScreen from '../screens/ShareReceivedScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="NoteDetail" component={NoteDetailScreen} />
      <Stack.Screen name="FolderDetail" component={FolderDetailScreen} />
      <Stack.Screen name="AddNote" component={AddNoteScreen} />
      <Stack.Screen name="EditNote" component={EditNoteScreen} />
      <Stack.Screen
        name="ShareReceived"
        component={ShareReceivedScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
