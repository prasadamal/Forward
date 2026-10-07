import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useVault } from '../store/vault';
import { biometricLabel, BiometricKind, getBiometricSupport } from '../security/biometrics';
import { radius, space, useTheme } from '../theme';
import { Button, Screen, TextField, Txt } from '../ui/primitives';
import { PIN_LENGTH, PinDots, PinPad } from '../ui/PinPad';

function useCountdown(until: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

export default function LockScreen() {
  const { c } = useTheme();
  const keyringState = useVault(s => s.keyringState);
  const pending = useVault(s => s.pendingShares.length);
  const unlockWithPasscode = useVault(s => s.unlockWithPasscode);
  const unlockWithBiometrics = useVault(s => s.unlockWithBiometrics);
  const eraseVault = useVault(s => s.eraseVault);

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioKind, setBioKind] = useState<BiometricKind>('none');
  const autoPrompted = useRef(false);

  const isPin = keyringState?.passcodeKind !== 'password';
  const bioEnabled = !!keyringState?.biometrics;
  const lockedFor = useCountdown(keyringState?.lockedUntil ?? 0);

  useEffect(() => {
    getBiometricSupport().then(s => setBioKind(s.kind));
  }, []);

  const tryBiometrics = useCallback(async () => {
    if (!bioEnabled || busy) return;
    setBusy(true);
    const result = await unlockWithBiometrics();
    setBusy(false);
    if (!result.ok && result.reason === 'invalidated') {
      setError(`${biometricLabel(bioKind)} changed on this device, so it was turned off. Use your passcode, then turn it back on in Settings.`);
    }
  }, [bioEnabled, busy, unlockWithBiometrics, bioKind]);

  useEffect(() => {
    if (bioEnabled && !autoPrompted.current && lockedFor === 0) {
      autoPrompted.current = true;
      void tryBiometrics();
    }
  }, [bioEnabled, lockedFor, tryBiometrics]);

  const submit = async (passcode: string) => {
    if (!passcode || busy) return;
    setBusy(true);
    const result = await unlockWithPasscode(passcode);
    setBusy(false);
    if (result.ok) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    setValue('');
    if (result.reason === 'wrong') {
      setError(
        result.attemptsBeforeLockout > 0
          ? `Wrong passcode. ${result.attemptsBeforeLockout} more ${result.attemptsBeforeLockout === 1 ? 'try' : 'tries'} before a short wait.`
          : 'Wrong passcode.',
      );
    } else if (result.reason === 'locked') {
      setError('Too many attempts.');
    } else {
      setError('This vault can’t be opened on this device.');
    }
  };

  const onPin = (v: string) => {
    setError(null);
    setValue(v);
    if (v.length === PIN_LENGTH) void submit(v);
  };

  const forgot = () => {
    Alert.alert(
      'Forgot your passcode?',
      `Your vault is encrypted with your passcode and never leaves this phone, so it can’t be reset by email.${
        bioEnabled ? `\n\nUnlock with ${biometricLabel(bioKind)}, then set a new passcode in Settings.` : ''
      }\n\nOtherwise you can erase this vault and start over (and restore an encrypted backup if you made one).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase vault…',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Erase everything?', 'All items, cards and passwords on this phone will be permanently deleted.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Erase', style: 'destructive', onPress: () => void eraseVault() },
            ]),
        },
      ],
    );
  };

  const bioKey = bioEnabled
    ? { icon: (bioKind === 'face' ? 'happy-outline' : 'finger-print') as 'happy-outline' | 'finger-print', label: `Unlock with ${biometricLabel(bioKind)}`, onPress: () => void tryBiometrics() }
    : undefined;

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.top}>
        <View style={[styles.lock, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="lock-closed" size={28} color={c.accent} />
        </View>
        <Txt variant="title" style={{ marginTop: space.lg }}>
          Forward is locked
        </Txt>
        {pending > 0 ? (
          <View style={[styles.pending, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="download-outline" size={16} color={c.accent} />
            <Txt variant="caption" color={c.accent}>
              {pending} {pending === 1 ? 'item is' : 'items are'} waiting — unlock to save
            </Txt>
          </View>
        ) : (
          <Txt variant="caption" color={c.textSecondary} style={{ marginTop: space.xs }}>
            {isPin ? 'Enter your PIN' : 'Enter your password'}
          </Txt>
        )}
      </View>

      {lockedFor > 0 ? (
        <Txt variant="bodyStrong" color={c.warning} style={styles.message}>
          Too many attempts. Try again in {lockedFor}s.
        </Txt>
      ) : error ? (
        <Txt variant="caption" color={c.danger} style={styles.message}>
          {error}
        </Txt>
      ) : null}

      {isPin ? (
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: space.lg }}>
          <PinDots length={PIN_LENGTH} filled={value.length} error={!!error} />
          <PinPad value={value} onChange={onPin} extraKey={bioKey} disabled={busy || lockedFor > 0} />
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: space.xl, paddingTop: space.xl }}>
          <TextField
            label="Password"
            secure
            autoFocus={!bioEnabled}
            value={value}
            onChangeText={v => {
              setError(null);
              setValue(v);
            }}
            onSubmitEditing={() => void submit(value)}
            autoCapitalize="none"
            autoCorrect={false}
            editable={lockedFor === 0}
            returnKeyType="go"
          />
          <Button title="Unlock" onPress={() => void submit(value)} loading={busy} disabled={!value || lockedFor > 0} />
          {bioKey ? (
            <Button title={bioKey.label} variant="ghost" icon={bioKey.icon} onPress={bioKey.onPress} style={{ marginTop: space.sm }} />
          ) : null}
        </View>
      )}

      <Pressable onPress={forgot} style={styles.forgot} accessibilityRole="button" hitSlop={8}>
        <Txt variant="caption" color={c.textMuted}>
          Forgot passcode?
        </Txt>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', paddingTop: space.xxl, paddingHorizontal: space.xl },
  lock: { width: 64, height: 64, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  message: { textAlign: 'center', marginTop: space.lg, paddingHorizontal: space.xl },
  forgot: { alignSelf: 'center', padding: space.md, marginBottom: space.sm },
});
