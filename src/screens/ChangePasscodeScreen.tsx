import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useVault } from '../store/vault';
import { PasscodeKind, validatePasscode } from '../security/keyring';
import { biometricLabel, confirmDeviceOwner, getBiometricSupport } from '../security/biometrics';
import { space, useTheme } from '../theme';
import { Button, Header, Screen, TextField, Txt } from '../ui/primitives';
import { PIN_LENGTH, PinDots, PinPad } from '../ui/PinPad';
import { toast } from '../ui/Toast';

type Step = 'verify' | 'create' | 'confirm';

export default function ChangePasscodeScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const currentKind = useVault(s => s.keyringState?.passcodeKind ?? 'pin');
  const biometrics = useVault(s => !!s.keyringState?.biometrics);
  const verifyPasscode = useVault(s => s.verifyPasscode);
  const changePasscode = useVault(s => s.changePasscode);
  const [step, setStep] = useState<Step>('verify');
  const [kind, setKind] = useState<PasscodeKind>(currentKind);
  const [value, setValue] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioName, setBioName] = useState('Face ID');

  React.useEffect(() => {
    getBiometricSupport().then(s => setBioName(biometricLabel(s.kind)));
  }, []);

  const activeKind = step === 'verify' ? currentKind : kind;

  const submit = async (v: string) => {
    setError(null);
    if (step === 'verify') {
      setBusy(true);
      const ok = await verifyPasscode(v);
      setBusy(false);
      setValue('');
      if (ok) setStep('create');
      else setError('That’s not your current passcode.');
      return;
    }
    if (step === 'create') {
      const problem = validatePasscode(v, kind);
      setValue('');
      if (problem) {
        setError(problem);
        return;
      }
      setFirst(v);
      setStep('confirm');
      return;
    }
    if (v !== first) {
      setValue('');
      setFirst('');
      setError('They didn’t match. Start again.');
      setStep('create');
      return;
    }
    setBusy(true);
    try {
      await changePasscode(v, kind);
      toast('Passcode changed');
      nav.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const verifyWithDevice = async () => {
    const r = await confirmDeviceOwner('Change your Forward passcode');
    if (r === 'ok') setStep('create');
  };

  const title =
    step === 'verify' ? 'Enter your current passcode' : step === 'create' ? (kind === 'pin' ? 'New 6-digit PIN' : 'New password') : 'Confirm it';

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <Header onBack={() => nav.goBack()} title={title} />
      <View style={{ flex: 1, paddingHorizontal: space.lg }}>
        {step === 'create' ? (
          <Txt variant="caption" color={c.textSecondary}>
            Your vault key stays the same — only the lock around it changes.
          </Txt>
        ) : null}
        {activeKind === 'pin' ? (
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: space.lg }}>
            <PinDots length={PIN_LENGTH} filled={value.length} error={!!error} />
            {error ? (
              <Txt variant="caption" color={c.danger} style={{ textAlign: 'center', marginBottom: space.md }}>
                {error}
              </Txt>
            ) : null}
            <PinPad
              value={value}
              disabled={busy}
              onChange={v => {
                setError(null);
                setValue(v);
                if (v.length === PIN_LENGTH) void submit(v);
              }}
            />
          </View>
        ) : (
          <View style={{ marginTop: space.xl }}>
            <TextField
              label={step === 'verify' ? 'Current password' : 'Password'}
              secure
              autoFocus
              value={value}
              onChangeText={v => {
                setError(null);
                setValue(v);
              }}
              onSubmitEditing={() => void submit(value)}
              autoCapitalize="none"
              autoCorrect={false}
              error={error}
            />
            <Button title="Continue" onPress={() => void submit(value)} loading={busy} disabled={!value} />
          </View>
        )}
        {step === 'verify' && biometrics ? (
          <Button title={`Use ${bioName} instead`} variant="ghost" onPress={() => void verifyWithDevice()} />
        ) : null}
        {step === 'create' ? (
          <Pressable
            onPress={() => {
              setKind(k => (k === 'pin' ? 'password' : 'pin'));
              setValue('');
              setError(null);
            }}
            style={{ alignSelf: 'center', padding: space.lg }}
            accessibilityRole="button"
          >
            <Txt variant="bodyStrong" color={c.accent}>
              {kind === 'pin' ? 'Use a password instead' : 'Use a 6-digit PIN instead'}
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
