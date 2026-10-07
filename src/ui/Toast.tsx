import React, { useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { create } from 'zustand';
import { radius, space, useTheme } from '../theme';
import { IconName, Txt } from './primitives';

interface ToastState {
  message: string | null;
  icon: IconName;
  seq: number;
  show: (message: string, icon?: IconName) => void;
  hide: () => void;
}

export const useToast = create<ToastState>(set => ({
  message: null,
  icon: 'checkmark-circle',
  seq: 0,
  show: (message, icon = 'checkmark-circle') => set(s => ({ message, icon, seq: s.seq + 1 })),
  hide: () => set({ message: null }),
}));

export function toast(message: string, icon?: IconName): void {
  useToast.getState().show(message, icon);
}

export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { message, icon, seq, hide } = useToast();
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => hide());
    }, 2600);
    return () => clearTimeout(t);
  }, [seq, message, hide, opacity]);

  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        { bottom: insets.bottom + 84, backgroundColor: c.text, opacity },
      ]}
    >
      <Ionicons name={icon} size={18} color={c.bg} />
      <Txt variant="caption" color={c.bg} style={{ flexShrink: 1 }}>
        {message}
      </Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
