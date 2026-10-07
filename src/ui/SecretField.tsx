import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, useTheme } from '../theme';
import { Txt } from './primitives';

/** A labelled value that stays masked until revealed, with a copy button. */
export function SecretField({
  label,
  value,
  revealed,
  onReveal,
  onCopy,
  mask = '••••••••',
  mono,
}: {
  label: string;
  value: string;
  revealed: boolean;
  onReveal?: () => void;
  onCopy?: () => void;
  mask?: string;
  mono?: boolean;
}) {
  const { c } = useTheme();
  if (!value) return null;
  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={{ flex: 1 }}>
        <Txt variant="label" color={c.textMuted}>
          {label}
        </Txt>
        <Txt
          variant="bodyStrong"
          selectable={revealed}
          style={[{ marginTop: 4 }, mono && { fontVariant: ['tabular-nums'], letterSpacing: 1 }]}
        >
          {revealed ? value : mask}
        </Txt>
      </View>
      {onReveal ? (
        <Pressable onPress={onReveal} hitSlop={8} style={styles.action} accessibilityRole="button" accessibilityLabel={revealed ? `Hide ${label}` : `Show ${label}`}>
          <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.accent} />
        </Pressable>
      ) : null}
      {onCopy ? (
        <Pressable onPress={onCopy} hitSlop={8} style={styles.action} accessibilityRole="button" accessibilityLabel={`Copy ${label}`}>
          <Ionicons name="copy-outline" size={20} color={c.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: space.sm,
    gap: space.xs,
  },
  action: { padding: space.sm },
});
