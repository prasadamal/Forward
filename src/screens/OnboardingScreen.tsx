import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useVault } from '../store/vault';
import { PasscodeKind, validatePasscode } from '../security/keyring';
import { biometricLabel, BiometricSupport, getBiometricSupport } from '../security/biometrics';
import { radius, space, useTheme } from '../theme';
import { Button, IconName, Screen, Scroll, TextField, Txt } from '../ui/primitives';
import { PIN_LENGTH, PinDots, PinPad } from '../ui/PinPad';

type Step = 'welcome' | 'create' | 'confirm' | 'working' | 'biometrics' | 'done';

function Feature({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.feature}>
      <View style={[styles.featureIcon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={22} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="h3">{title}</Txt>
        <Txt variant="caption" color={c.textSecondary} style={{ marginTop: 2, lineHeight: 19 }}>
          {body}
        </Txt>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const { c } = useTheme();
  const setupVault = useVault(s => s.setupVault);
  const setBiometrics = useVault(s => s.setBiometrics);
  const setOnboarding = useVault(s => s.setOnboarding);
  const [step, setStep] = useState<Step>('welcome');
  const [kind, setKind] = useState<PasscodeKind>('pin');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBiometricSupport().then(setSupport);
  }, []);

  const finishCreate = (value: string) => {
    const problem = validatePasscode(value, kind);
    if (problem) {
      setError(problem);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setFirst('');
      return;
    }
    setError(null);
    setStep('confirm');
  };

  const finishConfirm = async (value: string) => {
    if (value !== first) {
      setError('Passcodes didn’t match. Try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setFirst('');
      setSecond('');
      setStep('create');
      return;
    }
    setOnboarding(true);
    setStep('working');
    try {
      await setupVault(value, kind);
      setFirst('');
      setSecond('');
      setStep(support?.available ? 'biometrics' : 'done');
    } catch (e) {
      setOnboarding(false);
      setError(e instanceof Error ? e.message : 'Could not create the vault.');
      setFirst('');
      setSecond('');
      setStep('create');
    }
  };

  const onPin = (target: 'first' | 'second') => (v: string) => {
    setError(null);
    if (target === 'first') {
      setFirst(v);
      if (v.length === PIN_LENGTH) finishCreate(v);
    } else {
      setSecond(v);
      if (v.length === PIN_LENGTH) void finishConfirm(v);
    }
  };

  const enableBio = async () => {
    setBusy(true);
    const ok = await setBiometrics(true);
    setBusy(false);
    if (!ok) setError(`${biometricLabel(support?.kind ?? 'none')} couldn’t be turned on. You can try again in Settings.`);
    setStep('done');
  };

  if (step === 'welcome') {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <Scroll contentStyle={{ paddingTop: space.xxl, flexGrow: 1 }}>
          <View style={[styles.logo, { backgroundColor: c.accent }]}>
            <Ionicons name="paper-plane" size={34} color={c.onAccent} />
          </View>
          <Txt variant="largeTitle" style={{ marginTop: space.xl }}>
            Forward
          </Txt>
          <Txt variant="h3" color={c.textSecondary} style={{ marginTop: space.sm, fontWeight: '500' }}>
            Forward anything. Find it sorted. Keep it safe.
          </Txt>
          <View style={{ marginTop: space.xxl, gap: space.xl }}>
            <Feature
              icon="share-outline"
              title="Share from any app"
              body="YouTube, Instagram, X, WhatsApp, Photos, Files… tap Share, then Forward."
            />
            <Feature
              icon="folder-open-outline"
              title="Sorted for you"
              body="A Bangalore food vlog, a spot from Instagram and an app from X all land in Bangalore — no matter which app they came from."
            />
            <Feature
              icon="wallet-outline"
              title="A wallet for the important stuff"
              body="Cards, passwords and secret notes sit next to your memes, all encrypted."
            />
            <Feature
              icon="lock-closed-outline"
              title="Private by design"
              body="Everything stays encrypted on this phone. No account, no cloud, no tracking."
            />
          </View>
          <View style={{ flex: 1, minHeight: space.xxl }} />
          <Button title="Set up my vault" icon="arrow-forward" onPress={() => setStep('create')} />
        </Scroll>
      </Screen>
    );
  }

  if (step === 'working') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Txt variant="h3" style={{ marginTop: space.lg }}>
            Creating your encrypted vault…
          </Txt>
        </View>
      </Screen>
    );
  }

  if (step === 'biometrics') {
    const label = biometricLabel(support?.kind ?? 'none');
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View style={[styles.center, { paddingHorizontal: space.xl }]}>
          <View style={[styles.logo, { backgroundColor: c.accentSoft }]}>
            <Ionicons name={support?.kind === 'face' ? 'happy-outline' : 'finger-print'} size={36} color={c.accent} />
          </View>
          <Txt variant="title" style={{ marginTop: space.xl, textAlign: 'center' }}>
            Unlock with {label}?
          </Txt>
          <Txt variant="body" color={c.textSecondary} style={{ marginTop: space.sm, textAlign: 'center' }}>
            Quicker than typing your passcode. Your passcode still works, and is needed if {label} changes.
          </Txt>
          <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.xxl }}>
            <Button title={`Use ${label}`} onPress={enableBio} loading={busy} />
            <Button title="Not now" variant="ghost" onPress={() => setStep('done')} />
          </View>
        </View>
      </Screen>
    );
  }

  if (step === 'done') {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <Scroll contentStyle={{ paddingTop: space.xxl, flexGrow: 1 }}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Txt variant="title" style={{ marginTop: space.md }}>
            You’re all set
          </Txt>
          <Txt variant="body" color={c.textSecondary} style={{ marginTop: space.sm }}>
            Here’s how to forward something:
          </Txt>
          {error ? (
            <Txt variant="caption" color={c.warning} style={{ marginTop: space.md }}>
              {error}
            </Txt>
          ) : null}
          <View style={{ gap: space.lg, marginTop: space.xl }}>
            <Feature icon="play-circle-outline" title="1. Find something you like" body="A video, reel, post, photo, meme or PDF — in any app." />
            <Feature icon="share-social-outline" title="2. Tap Share" body="Then pick Forward. (On iPhone, tap More the first time to add it to your favourites.)" />
            <Feature icon="sparkles-outline" title="3. That’s it" body="Forward saves it, sorts it into folders and keeps it encrypted." />
          </View>
          <View style={{ flex: 1, minHeight: space.xxl }} />
          <Button title="Open Forward" onPress={() => setOnboarding(false)} />
        </Scroll>
      </Screen>
    );
  }

  // create / confirm
  const confirming = step === 'confirm';
  const value = confirming ? second : first;
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ flex: 1, paddingHorizontal: space.xl, paddingTop: space.xl }}>
        {confirming ? (
          <Pressable onPress={() => { setStep('create'); setFirst(''); setSecond(''); }} accessibilityRole="button" hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={c.accent} />
          </Pressable>
        ) : (
          <Pressable onPress={() => setStep('welcome')} accessibilityRole="button" hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={c.accent} />
          </Pressable>
        )}
        <Txt variant="title" style={{ marginTop: space.lg }}>
          {confirming ? 'Confirm your passcode' : kind === 'pin' ? 'Create a 6-digit PIN' : 'Create a password'}
        </Txt>
        <Txt variant="body" color={c.textSecondary} style={{ marginTop: space.sm }}>
          {confirming
            ? 'Enter it once more.'
            : 'It encrypts your vault. There’s no “forgot password” email — no one but you can open it, not even us.'}
        </Txt>

        {kind === 'pin' ? (
          <>
            <PinDots length={PIN_LENGTH} filled={value.length} error={!!error} />
            {error ? (
              <Txt variant="caption" color={c.danger} style={{ textAlign: 'center', marginTop: -space.sm, marginBottom: space.md }}>
                {error}
              </Txt>
            ) : null}
            <View style={{ flex: 1 }} />
            <PinPad value={value} onChange={onPin(confirming ? 'second' : 'first')} />
          </>
        ) : (
          <View style={{ marginTop: space.xl }}>
            <TextField
              label={confirming ? 'Confirm password' : 'Password'}
              secure
              autoFocus
              value={value}
              onChangeText={v => {
                setError(null);
                if (confirming) setSecond(v);
                else setFirst(v);
              }}
              onSubmitEditing={() => (confirming ? void finishConfirm(second) : finishCreate(first))}
              returnKeyType="next"
              autoCapitalize="none"
              autoCorrect={false}
              error={error}
              hint={confirming ? undefined : 'At least 8 characters. A short sentence works well.'}
            />
            <Button
              title={confirming ? 'Create vault' : 'Continue'}
              onPress={() => (confirming ? void finishConfirm(second) : finishCreate(first))}
              disabled={!value}
            />
          </View>
        )}

        {!confirming ? (
          <Pressable
            onPress={() => {
              setKind(k => (k === 'pin' ? 'password' : 'pin'));
              setFirst('');
              setError(null);
            }}
            style={{ alignSelf: 'center', padding: space.lg }}
            accessibilityRole="button"
          >
            <Txt variant="bodyStrong" color={c.accent}>
              {kind === 'pin' ? 'Use a password instead' : 'Use a 6-digit PIN instead'}
            </Txt>
          </Pressable>
        ) : (
          <View style={{ height: space.xxl }} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 72, height: 72, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  feature: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  featureIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
