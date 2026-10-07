import React, { useCallback, useEffect } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useVault } from './src/store/vault';
import { usePrefs } from './src/store/prefs';
import { useShareIntake } from './src/share/useShareIntake';
import { useAutoLock } from './src/security/autoLock';
import { applyScreenCapturePolicy, enableAppSwitcherPrivacy } from './src/security/privacy';
import { flushClipboard } from './src/security/clipboard';
import { navigationRef } from './src/navigation/navigationRef';
import AppNavigator from './src/navigation/AppNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LockScreen from './src/screens/LockScreen';
import { BootScreen, FailedScreen, OrphanedScreen } from './src/screens/GateScreens';
import { ToastHost } from './src/ui/Toast';
import { useTheme } from './src/theme';
import { IncomingShare } from './src/types';

/** Opens the "Forwarded" sheet for the next queued share once the vault is open. */
function useShowPendingShares(ready: boolean, navTick: number) {
  const pending = useVault(s => s.pendingShares);
  useEffect(() => {
    if (!ready || !pending.length || !navigationRef.isReady()) return;
    const current = navigationRef.getCurrentRoute();
    if (current?.name === 'Forwarded') return;
    navigationRef.navigate('Forwarded', { shareId: pending[0].id });
  }, [ready, pending, navTick]);
}

function Shell() {
  const { c, dark } = useTheme();
  const status = useVault(s => s.status);
  const onboarding = useVault(s => s.onboarding);
  const settings = useVault(s => s.settings);
  const boot = useVault(s => s.boot);
  const lock = useVault(s => s.lock);
  const enqueueShare = useVault(s => s.enqueueShare);
  const loadPrefs = usePrefs(s => s.load);
  const [navReady, setNavReady] = React.useState(false);
  const [navTick, setNavTick] = React.useState(0);

  useEffect(() => {
    void loadPrefs();
    void boot();
    void enableAppSwitcherPrivacy();
  }, [boot, loadPrefs]);

  // Screenshots are blocked until the vault says otherwise (lock screen included).
  useEffect(() => {
    void applyScreenCapturePolicy(status !== 'unlocked' || settings.blockScreenshots);
  }, [status, settings.blockScreenshots]);

  useShareIntake(useCallback((share: IncomingShare) => enqueueShare(share), [enqueueShare]));

  useAutoLock({
    enabled: status === 'unlocked',
    seconds: settings.autoLockSeconds,
    lock: () => void lock(),
    onForeground: () => void flushClipboard(),
  });

  const unlocked = status === 'unlocked' && !onboarding;
  useShowPendingShares(unlocked && navReady, navTick);
  useEffect(() => {
    if (!unlocked) setNavReady(false);
  }, [unlocked]);

  let content: React.ReactNode;
  if (status === 'booting') content = <BootScreen />;
  else if (status === 'setup' || onboarding) content = <OnboardingScreen />;
  else if (status === 'locked') content = <LockScreen />;
  else if (status === 'orphaned') content = <OrphanedScreen />;
  else if (status === 'failed') content = <FailedScreen />;
  else {
    const base = dark ? DarkTheme : DefaultTheme;
    content = (
      <NavigationContainer
        ref={navigationRef}
        onReady={() => setNavReady(true)}
        onStateChange={() => setNavTick(t => t + 1)}
        theme={{ ...base, colors: { ...base.colors, background: c.bg, card: c.surface, text: c.text, border: c.border, primary: c.accent } }}
      >
        <AppNavigator />
      </NavigationContainer>
    );
  }

  return (
    <>
      {content}
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}
