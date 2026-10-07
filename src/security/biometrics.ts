import * as LocalAuthentication from 'expo-local-authentication';
import { withAutoLockSuspended } from './autoLock';

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'none';

export interface BiometricSupport {
  /** Hardware present and at least one biometric enrolled. */
  available: boolean;
  kind: BiometricKind;
  /** Device has a screen lock (PIN/pattern/passcode) at all. */
  deviceSecure: boolean;
}

export async function getBiometricSupport(): Promise<BiometricSupport> {
  try {
    const [hardware, enrolled, types, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    const kind: BiometricKind = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
      ? 'face'
      : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ? 'fingerprint'
        : types.includes(LocalAuthentication.AuthenticationType.IRIS)
          ? 'iris'
          : 'none';
    return {
      available: hardware && enrolled && kind !== 'none',
      kind,
      deviceSecure: level !== LocalAuthentication.SecurityLevel.NONE,
    };
  } catch {
    return { available: false, kind: 'none', deviceSecure: false };
  }
}

export function biometricLabel(kind: BiometricKind): string {
  switch (kind) {
    case 'face':
      return 'Face ID';
    case 'fingerprint':
      return 'Fingerprint';
    case 'iris':
      return 'Iris';
    default:
      return 'Biometrics';
  }
}

export type ConfirmResult = 'ok' | 'cancelled' | 'unavailable';

/**
 * Asks the OS to confirm it's the device owner (biometrics with the device
 * passcode as fallback). Used before revealing card numbers and passwords.
 */
export async function confirmDeviceOwner(reason: string): Promise<ConfirmResult> {
  const support = await getBiometricSupport();
  if (!support.available && !support.deviceSecure) return 'unavailable';
  const result = await withAutoLockSuspended(() =>
    LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    }),
  );
  if (result.success) return 'ok';
  if (result.error === 'not_enrolled' || result.error === 'not_available' || result.error === 'passcode_not_set') {
    return 'unavailable';
  }
  return 'cancelled';
}
