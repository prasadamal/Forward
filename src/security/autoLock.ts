import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Locks the vault after the app has been in the background for the
 * configured time. System sheets we open ourselves (photo picker, share
 * sheet, document picker, device-passcode prompt) briefly background the app
 * on Android, so those calls suspend auto-lock while they run.
 */

let suspended = 0;

/**
 * A picker or share sheet can only hold the lock off this long. Leaving the app
 * with one open (or the sheet never resolving) still locks the vault.
 */
export const MAX_SUSPENDED_MS = 2 * 60 * 1000;

export function suspendAutoLock(): void {
  suspended++;
}

export function resumeAutoLock(): void {
  suspended = Math.max(0, suspended - 1);
}

export async function withAutoLockSuspended<T>(task: () => Promise<T>): Promise<T> {
  suspendAutoLock();
  try {
    return await task();
  } finally {
    resumeAutoLock();
  }
}

export function isAutoLockSuspended(): boolean {
  return suspended > 0;
}

export interface AutoLockOptions {
  enabled: boolean;
  /** 0 = lock as soon as the app is backgrounded. */
  seconds: number;
  lock: () => void;
  /** Called every time the app returns to the foreground (e.g. to flush the clipboard). */
  onForeground?: () => void;
}

export function useAutoLock({ enabled, seconds, lock, onForeground }: AutoLockOptions): void {
  const backgroundAt = useRef<number | null>(null);
  const latest = useRef({ enabled, seconds, lock, onForeground });
  latest.current = { enabled, seconds, lock, onForeground };

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      const { enabled: on, seconds: delay, lock: doLock, onForeground: fg } = latest.current;
      if (state === 'background') {
        if (!on) {
          backgroundAt.current = null;
          return;
        }
        backgroundAt.current = Date.now();
        if (delay === 0 && !isAutoLockSuspended()) doLock();
      } else if (state === 'active') {
        const since = backgroundAt.current;
        backgroundAt.current = null;
        if (on && since !== null) {
          const away = Date.now() - since;
          const heldOff = isAutoLockSuspended() && away < MAX_SUSPENDED_MS;
          if (!heldOff && away >= delay * 1000) doLock();
        }
        fg?.();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);
}
