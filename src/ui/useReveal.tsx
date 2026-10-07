import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useVault } from '../store/vault';
import { confirmDeviceOwner } from '../security/biometrics';
import { space, useTheme } from '../theme';
import { Button, TextField, Txt } from './primitives';
import { PIN_LENGTH, PinDots, PinPad } from './PinPad';
import { Sheet } from './Sheet';

/**
 * Gate for showing secrets (card numbers, passwords). Uses Face ID /
 * fingerprint / device passcode; on phones without a screen lock it asks for
 * the Forward passcode instead. A successful check is remembered for a minute.
 */
export function useReveal(reason: string) {
  const revealNeedsAuth = useVault(s => s.settings.revealNeedsAuth);
  const revealUntil = useVault(s => s.revealUntil);
  const markRevealed = useVault(s => s.markRevealed);
  const [promptOpen, setPromptOpen] = useState(false);
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(null);

  const ensure = useCallback(async (): Promise<boolean> => {
    if (!revealNeedsAuth || Date.now() < revealUntil) return true;
    const result = await confirmDeviceOwner(reason);
    if (result === 'ok') {
      markRevealed();
      return true;
    }
    if (result === 'cancelled') return false;
    return new Promise<boolean>(resolve => {
      setResolver(() => resolve);
      setPromptOpen(true);
    });
  }, [revealNeedsAuth, revealUntil, reason, markRevealed]);

  const prompt = (
    <PasscodePromptSheet
      visible={promptOpen}
      onDone={ok => {
        setPromptOpen(false);
        if (ok) markRevealed();
        resolver?.(ok);
        setResolver(null);
      }}
    />
  );
  return { ensure, prompt };
}

function PasscodePromptSheet({ visible, onDone }: { visible: boolean; onDone: (ok: boolean) => void }) {
  const { c } = useTheme();
  const kind = useVault(s => s.keyringState?.passcodeKind ?? 'pin');
  const verifyPasscode = useVault(s => s.verifyPasscode);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (v: string) => {
    setBusy(true);
    const ok = await verifyPasscode(v);
    setBusy(false);
    setValue('');
    if (ok) {
      setError(null);
      onDone(true);
    } else {
      setError('Wrong passcode');
    }
  };

  return (
    <Sheet visible={visible} onClose={() => onDone(false)} title="Enter your Forward passcode" subtitle="Needed to show card numbers and passwords.">
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
        {kind === 'pin' ? (
          <>
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
          </>
        ) : (
          <>
            <TextField label="Password" secure autoFocus value={value} onChangeText={setValue} error={error} autoCapitalize="none" />
            <Button title="Continue" onPress={() => void submit(value)} loading={busy} disabled={!value} />
          </>
        )}
      </View>
    </Sheet>
  );
}
