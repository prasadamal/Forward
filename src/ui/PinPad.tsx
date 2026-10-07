import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../theme';
import { IconName, Txt } from './primitives';

export const PIN_LENGTH = 6;

export function PinDots({ length, filled, error }: { length: number; filled: number; error?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={styles.dots} accessibilityLabel={`${filled} of ${length} digits entered`}>
      {Array.from({ length }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              borderColor: error ? c.danger : c.borderStrong,
              backgroundColor: i < filled ? (error ? c.danger : c.accent) : 'transparent',
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Numeric keypad. `extraKey` (bottom-left) is typically Face ID / fingerprint. */
export function PinPad({
  value,
  onChange,
  maxLength = PIN_LENGTH,
  extraKey,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  extraKey?: { icon: IconName; label: string; onPress: () => void };
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const press = (d: string) => {
    if (disabled || value.length >= maxLength) return;
    Haptics.selectionAsync().catch(() => undefined);
    onChange(value + d);
  };
  const back = () => {
    if (disabled || !value) return;
    onChange(value.slice(0, -1));
  };
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];
  const Key = ({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.key, { backgroundColor: pressed ? c.borderStrong : c.keypad, opacity: disabled ? 0.5 : 1 }]}
    >
      {children}
    </Pressable>
  );
  return (
    <View style={styles.pad}>
      {rows.map(row => (
        <View key={row.join('')} style={styles.padRow}>
          {row.map(d => (
            <Key key={d} onPress={() => press(d)} label={d}>
              <Txt variant="title" style={{ fontWeight: '500' }}>
                {d}
              </Txt>
            </Key>
          ))}
        </View>
      ))}
      <View style={styles.padRow}>
        {extraKey ? (
          <Pressable
            onPress={extraKey.onPress}
            accessibilityRole="button"
            accessibilityLabel={extraKey.label}
            style={styles.keyBare}
          >
            <Ionicons name={extraKey.icon} size={30} color={c.accent} />
          </Pressable>
        ) : (
          <View style={styles.keyBare} />
        )}
        <Key onPress={() => press('0')} label="0">
          <Txt variant="title" style={{ fontWeight: '500' }}>
            0
          </Txt>
        </Key>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Delete" style={styles.keyBare}>
          <Ionicons name="backspace-outline" size={28} color={c.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const KEY = 74;
const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginVertical: space.xl },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  pad: { alignSelf: 'center', gap: 14 },
  padRow: { flexDirection: 'row', gap: 22, justifyContent: 'center' },
  key: { width: KEY, height: KEY, borderRadius: KEY / 2, alignItems: 'center', justifyContent: 'center' },
  keyBare: { width: KEY, height: KEY, alignItems: 'center', justifyContent: 'center' },
});
