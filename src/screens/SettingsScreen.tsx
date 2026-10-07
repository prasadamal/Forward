import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVault } from '../store/vault';
import { usePrefs } from '../store/prefs';
import { getSession } from '../store/session';
import { biometricLabel, BiometricSupport, getBiometricSupport } from '../security/biometrics';
import { applyScreenCapturePolicy } from '../security/privacy';
import { formatBytes } from '../utils/encoding';
import { ThemePreference } from '../types';
import { space, useTheme } from '../theme';
import { Header, ListRow, Screen, Scroll, Section, Txt } from '../ui/primitives';
import { ChoiceSheet } from '../ui/ChoiceSheet';
import { toast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const AUTO_LOCK = [
  { value: 0, label: 'Immediately' },
  { value: 30, label: 'After 30 seconds' },
  { value: 60, label: 'After 1 minute' },
  { value: 300, label: 'After 5 minutes' },
  { value: 900, label: 'After 15 minutes' },
];
const CLIPBOARD = [
  { value: 30, label: 'After 30 seconds' },
  { value: 45, label: 'After 45 seconds' },
  { value: 90, label: 'After 90 seconds' },
  { value: 0, label: 'Never' },
];
const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Match phone' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export default function SettingsScreen() {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const settings = useVault(s => s.settings);
  const keyringState = useVault(s => s.keyringState);
  const items = useVault(s => s.items);
  const folders = useVault(s => s.folders);
  const updateSettings = useVault(s => s.updateSettings);
  const setBiometrics = useVault(s => s.setBiometrics);
  const lock = useVault(s => s.lock);
  const eraseVault = useVault(s => s.eraseVault);
  const emptyTrash = useVault(s => s.emptyTrash);
  const theme = usePrefs(s => s.theme);
  const setTheme = usePrefs(s => s.setTheme);
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [sheet, setSheet] = useState<'lock' | 'clipboard' | 'theme' | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);

  useEffect(() => {
    getBiometricSupport().then(setSupport);
    getSession()
      .repo.stats()
      .then(s => setBytes(s.bytes))
      .catch(() => undefined);
  }, [items.length]);

  const bioName = biometricLabel(support?.kind ?? 'none');
  const trashed = items.filter(i => i.trashedAt).length;

  const toggleBio = async (on: boolean) => {
    const ok = await setBiometrics(on);
    if (on && !ok) Alert.alert(`Couldn’t turn on ${bioName}`, `Check that ${bioName} is set up in your phone’s settings.`);
    else toast(on ? `${bioName} unlock on` : `${bioName} unlock off`);
  };

  const erase = () =>
    Alert.alert('Erase everything?', 'All items, folders, cards and passwords on this phone will be permanently deleted. Make a backup first if you might need them.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Are you sure?', 'This can’t be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Erase vault', style: 'destructive', onPress: () => void eraseVault() },
          ]),
      },
    ]);

  return (
    <Screen>
      <Scroll contentStyle={{ paddingHorizontal: 0 }}>
        <Header title="Settings" large />
        <View style={{ paddingHorizontal: space.lg }}>
          <Section title="Security">
            {support?.available ? (
              <ListRow
                title={`Unlock with ${bioName}`}
                icon={support.kind === 'face' ? 'happy-outline' : 'finger-print'}
                switchValue={!!keyringState?.biometrics}
                onSwitch={v => void toggleBio(v)}
              />
            ) : null}
            <ListRow
              title="Auto-lock"
              icon="timer-outline"
              value={AUTO_LOCK.find(o => o.value === settings.autoLockSeconds)?.label ?? `${settings.autoLockSeconds}s`}
              chevron
              onPress={() => setSheet('lock')}
            />
            <ListRow
              title="Confirm before showing secrets"
              subtitle="Card numbers, CVVs and passwords"
              icon="eye-off-outline"
              switchValue={settings.revealNeedsAuth}
              onSwitch={v => void updateSettings({ revealNeedsAuth: v })}
            />
            <ListRow
              title="Block screenshots"
              subtitle="Also hides Forward in the app switcher"
              icon="phone-portrait-outline"
              switchValue={settings.blockScreenshots}
              onSwitch={async v => {
                await updateSettings({ blockScreenshots: v });
                await applyScreenCapturePolicy(v);
              }}
            />
            <ListRow
              title="Clear copied secrets"
              icon="clipboard-outline"
              value={CLIPBOARD.find(o => o.value === settings.clipboardClearSeconds)?.label ?? `${settings.clipboardClearSeconds}s`}
              chevron
              onPress={() => setSheet('clipboard')}
            />
            <ListRow title="Change passcode" icon="keypad-outline" chevron onPress={() => nav.navigate('ChangePasscode')} />
            <ListRow title="Lock now" icon="lock-closed-outline" last onPress={() => void lock()} />
          </Section>

          <Section
            title="Sorting"
            footer="Link details come straight from the site you shared (for example YouTube’s own oEmbed service). Forward has no servers and never sees your data. Turn previews off to keep everything offline."
          >
            <ListRow
              title="Sort automatically"
              subtitle="Places & topics, e.g. Bangalore › Food"
              icon="sparkles-outline"
              switchValue={settings.autoFile}
              onSwitch={v => void updateSettings({ autoFile: v })}
            />
            <ListRow
              title="Link previews"
              subtitle="Fetch titles & thumbnails to sort links better"
              icon="globe-outline"
              switchValue={settings.linkPreviews}
              onSwitch={v => void updateSettings({ linkPreviews: v })}
              last
            />
          </Section>

          <Section title="Backup" footer="Backups are a single encrypted file you keep wherever you like. Use one to move to a new phone.">
            <ListRow title="Back up or restore" icon="cloud-download-outline" chevron last onPress={() => nav.navigate('Backup')} />
          </Section>

          <Section title="Appearance">
            <ListRow
              title="Theme"
              icon="contrast-outline"
              value={THEMES.find(t => t.value === theme)?.label}
              chevron
              last
              onPress={() => setSheet('theme')}
            />
          </Section>

          <Section title="Your vault">
            <ListRow title="Items" icon="albums-outline" value={String(items.filter(i => !i.trashedAt).length)} />
            <ListRow title="Folders" icon="folder-outline" value={String(folders.length)} />
            <ListRow title="Stored files" icon="server-outline" value={bytes === null ? '…' : formatBytes(bytes)} />
            <ListRow
              title="Empty Trash"
              icon="trash-outline"
              value={String(trashed)}
              last
              onPress={() =>
                trashed
                  ? Alert.alert('Empty Trash?', `${trashed} ${trashed === 1 ? 'item' : 'items'} will be deleted permanently.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => void emptyTrash() },
                    ])
                  : toast('Trash is already empty')
              }
            />
          </Section>

          <Section title="About">
            <ListRow title="Privacy & security" icon="shield-checkmark-outline" chevron onPress={() => nav.navigate('Privacy')} />
            <ListRow title="Version" icon="information-circle-outline" value={Constants.expoConfig?.version ?? '—'} last />
          </Section>

          <Section>
            <ListRow title="Erase vault" icon="nuclear-outline" destructive last onPress={erase} />
          </Section>
          <Txt variant="small" color={c.textMuted} style={{ textAlign: 'center' }}>
            No account. No cloud. No tracking.
          </Txt>
        </View>
      </Scroll>

      <ChoiceSheet
        visible={sheet === 'lock'}
        title="Auto-lock"
        choices={AUTO_LOCK}
        value={settings.autoLockSeconds}
        onChoose={v => void updateSettings({ autoLockSeconds: v })}
        onClose={() => setSheet(null)}
      />
      <ChoiceSheet
        visible={sheet === 'clipboard'}
        title="Clear copied secrets"
        choices={CLIPBOARD}
        value={settings.clipboardClearSeconds}
        onChoose={v => void updateSettings({ clipboardClearSeconds: v })}
        onClose={() => setSheet(null)}
      />
      <ChoiceSheet
        visible={sheet === 'theme'}
        title="Theme"
        choices={THEMES}
        value={theme}
        onChoose={v => void setTheme(v)}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}
