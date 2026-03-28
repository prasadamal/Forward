import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { Colors } from '../constants/colors';
import { RootTabParamList } from '../types';
import { useNoteStore } from '../store/noteStore';
import HomeScreen from '../screens/HomeScreen';
import FoldersScreen from '../screens/FoldersScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Home: { active: '✉️', inactive: '✉' },
  Folders: { active: '📁', inactive: '📂' },
  Search: { active: '🔍', inactive: '🔎' },
  Settings: { active: '⚙️', inactive: '⚙' },
};

export default function TabNavigator() {
  const settings = useNoteStore(state => state.settings);
  const colors = Colors[settings.theme === 'light' ? 'light' : 'dark'];

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <Text style={{ fontSize: 20 }}>
              {focused ? icons.active : icons.inactive}
            </Text>
          );
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Forward' }} />
      <Tab.Screen name="Folders" component={FoldersScreen} options={{ tabBarLabel: 'Folders' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarLabel: 'Search' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}
