import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

const GLOBAL_KEY = 'forward-global';

/**
 * Blocks screenshots and screen recording (and, on Android, shows a blank
 * card in Recents). Wallet screens call `usePreventScreenCapture` on top of
 * this so they stay protected even when the global setting is off.
 */
export async function applyScreenCapturePolicy(block: boolean): Promise<void> {
  try {
    if (block) await ScreenCapture.preventScreenCaptureAsync(GLOBAL_KEY);
    else await ScreenCapture.allowScreenCaptureAsync(GLOBAL_KEY);
  } catch {
    // Not available (e.g. simulator/web): nothing to do.
  }
}

/** Blurs the iOS app-switcher snapshot so vault content never appears there. */
export async function enableAppSwitcherPrivacy(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await ScreenCapture.enableAppSwitcherProtectionAsync(0.8);
  } catch {
    // ignore
  }
}

export { usePreventScreenCapture } from 'expo-screen-capture';
