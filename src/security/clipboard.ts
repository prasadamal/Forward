import * as Clipboard from 'expo-clipboard';

/**
 * Copies a secret and wipes the clipboard after a delay. JavaScript timers
 * pause while the app is in the background, so `flushClipboard()` also runs
 * whenever the app returns to the foreground.
 *
 * The clipboard is cleared unconditionally once the deadline passes: reading
 * it back first would trigger the iOS paste prompt if another app had changed it.
 */

let deadline: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function clearNow(): Promise<void> {
  deadline = null;
  if (timer) clearTimeout(timer);
  timer = null;
  try {
    await Clipboard.setStringAsync('');
  } catch {
    // ignore
  }
}

export async function copyText(value: string): Promise<void> {
  await Clipboard.setStringAsync(value);
}

export async function copySecret(value: string, clearAfterSeconds: number): Promise<void> {
  await Clipboard.setStringAsync(value);
  if (timer) clearTimeout(timer);
  timer = null;
  if (clearAfterSeconds <= 0) {
    deadline = null;
    return;
  }
  deadline = Date.now() + clearAfterSeconds * 1000;
  timer = setTimeout(() => void clearNow(), clearAfterSeconds * 1000);
}

/** Clears the clipboard if a copied secret has outlived its deadline. */
export async function flushClipboard(): Promise<void> {
  if (deadline !== null && Date.now() >= deadline) await clearNow();
}

/** Clears a pending secret immediately (used when the vault locks). */
export async function clearPendingSecret(): Promise<void> {
  if (deadline !== null) await clearNow();
}
