import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVault } from '../store/vault';
import { radius, space, useTheme } from '../theme';
import { Button, Screen, Txt } from '../ui/primitives';

export function BootScreen() {
  const { c } = useTheme();
  return (
    <Screen>
      <View style={styles.center}>
        <View style={[styles.logo, { backgroundColor: c.accent }]}>
          <Ionicons name="paper-plane" size={30} color={c.onAccent} />
        </View>
        <ActivityIndicator color={c.accent} style={{ marginTop: space.xl }} />
      </View>
    </Screen>
  );
}

function confirmErase(erase: () => Promise<void>) {
  Alert.alert('Start fresh?', 'The unreadable vault on this phone will be deleted. You can restore a Forward backup file afterwards.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Start fresh', style: 'destructive', onPress: () => void erase() },
  ]);
}

/** Vault files exist but this phone's secret key is missing (e.g. restored from a device backup). */
export function OrphanedScreen() {
  const { c } = useTheme();
  const eraseVault = useVault(s => s.eraseVault);
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.center, { paddingHorizontal: space.xl }]}>
        <View style={[styles.logo, { backgroundColor: c.warningSoft }]}>
          <Ionicons name="phone-portrait-outline" size={30} color={c.warning} />
        </View>
        <Txt variant="title" style={styles.title}>
          This vault belongs to another phone
        </Txt>
        <Txt variant="body" color={c.textSecondary} style={styles.body}>
          Forward’s encryption key never leaves the phone it was created on, so a vault copied by a phone backup can’t be
          opened here. To move your things, make an encrypted backup in Settings on the old phone and restore it on this one.
        </Txt>
        <Button title="Start fresh" onPress={() => confirmErase(eraseVault)} style={{ alignSelf: 'stretch', marginTop: space.xxl }} />
      </View>
    </Screen>
  );
}

export function FailedScreen() {
  const { c } = useTheme();
  const failure = useVault(s => s.failure);
  const boot = useVault(s => s.boot);
  const eraseVault = useVault(s => s.eraseVault);
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.center, { paddingHorizontal: space.xl }]}>
        <View style={[styles.logo, { backgroundColor: c.dangerSoft }]}>
          <Ionicons name="alert-circle-outline" size={30} color={c.danger} />
        </View>
        <Txt variant="title" style={styles.title}>
          Forward couldn’t open your vault
        </Txt>
        <Txt variant="body" color={c.textSecondary} style={styles.body}>
          {failure ?? 'Something went wrong.'}
        </Txt>
        <Button title="Try again" onPress={() => void boot()} style={{ alignSelf: 'stretch', marginTop: space.xxl }} />
        <Button title="Erase and start fresh" variant="ghost" onPress={() => confirmErase(eraseVault)} style={{ alignSelf: 'stretch' }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 68, height: 68, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: space.xl, textAlign: 'center' },
  body: { marginTop: space.sm, textAlign: 'center' },
});
