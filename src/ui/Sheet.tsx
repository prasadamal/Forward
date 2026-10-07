import React, { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../theme';
import { Txt } from './primitives';

/** Bottom sheet built on Modal. Tapping the backdrop closes it. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  fullHeight,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  fullHeight?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: c.bg,
              paddingBottom: Math.max(insets.bottom, space.lg),
              maxHeight: fullHeight ? '92%' : '85%',
              minHeight: fullHeight ? '70%' : undefined,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: c.borderStrong }]} />
          {title ? (
            <View style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
              <Txt variant="h2">{title}</Txt>
              {subtitle ? (
                <Txt variant="caption" color={c.textSecondary} style={{ marginTop: 2 }}>
                  {subtitle}
                </Txt>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: space.md },
});
