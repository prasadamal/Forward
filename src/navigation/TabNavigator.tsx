import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { TabParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import FoldersScreen from '../screens/FoldersScreen';
import WalletScreen from '../screens/WalletScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { IconName } from '../ui/primitives';

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, [IconName, IconName]> = {
  Home: ['paper-plane', 'paper-plane-outline'],
  Folders: ['folder', 'folder-outline'],
  Wallet: ['wallet', 'wallet-outline'],
  Settings: ['settings', 'settings-outline'],
};

export default function TabNavigator() {
  const { c } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.tabBar, borderTopColor: c.border },
        // flexShrink: 0 is the native default; without it react-native-web squeezes the
        // label and clips descenders ("Settings").
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', flexShrink: 0 },
        tabBarIcon: ({ focused, color }) => {
          const [on, off] = ICONS[route.name];
          return <Ionicons name={focused ? on : off} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Forward' }} />
      <Tab.Screen name="Folders" component={FoldersScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
