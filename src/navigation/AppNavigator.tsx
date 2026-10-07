import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import TabNavigator from './TabNavigator';
import FolderScreen from '../screens/FolderScreen';
import ItemScreen from '../screens/ItemScreen';
import EditItemScreen from '../screens/EditItemScreen';
import ForwardedScreen from '../screens/ForwardedScreen';
import SearchScreen from '../screens/SearchScreen';
import FolderEditScreen from '../screens/FolderEditScreen';
import BackupScreen from '../screens/BackupScreen';
import ChangePasscodeScreen from '../screens/ChangePasscodeScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import { ImageViewerScreen, VideoPlayerScreen } from '../screens/MediaViewers';
import { useTheme } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { c } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Folder" component={FolderScreen} />
      <Stack.Screen name="Item" component={ItemScreen} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Backup" component={BackupScreen} />
      <Stack.Screen name="ChangePasscode" component={ChangePasscodeScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="EditItem" component={EditItemScreen} />
        <Stack.Screen name="FolderEdit" component={FolderEditScreen} />
        <Stack.Screen name="Forwarded" component={ForwardedScreen} options={{ gestureEnabled: false }} />
      </Stack.Group>
      <Stack.Group screenOptions={{ presentation: 'fullScreenModal', animation: 'fade' }}>
        <Stack.Screen name="ImageViewer" component={ImageViewerScreen} />
        <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
      </Stack.Group>
    </Stack.Navigator>
  );
}
