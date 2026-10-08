import React from 'react';
import { Alert, Linking, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { space, useTheme } from '../theme';
import { Button, Card, Header, IconName, Screen, Scroll, Txt } from '../ui/primitives';

/** Set `expo.extra.privacyPolicyUrl` in app.json once the policy is hosted (see PRIVACY.md). */
const POLICY_URL = Constants.expoConfig?.extra?.privacyPolicyUrl as string | undefined;

const SECTIONS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'phone-portrait-outline',
    title: 'Everything stays on this phone',
    body: 'Forward has no servers and no accounts. Nothing you save is uploaded, synced or seen by anyone else — including the people who make Forward.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'Encrypted at rest',
    body: 'Your vault is an AES-256 encrypted database (SQLCipher). The key is random and is itself locked by your passcode plus a secret that never leaves this phone’s secure hardware (Keychain on iPhone, Keystore on Android).',
  },
  {
    icon: 'finger-print',
    title: 'Face ID & fingerprint',
    body: 'Quick unlock keeps a copy of the key behind your phone’s biometrics. If your fingerprints or Face ID change, that copy is discarded automatically and your passcode is needed.',
  },
  {
    icon: 'eye-off-outline',
    title: 'Secrets stay hidden',
    body: 'Card numbers, CVVs, PINs and passwords are only loaded when you open them and confirm it’s you. Screens with secrets block screenshots, and copied secrets are wiped from the clipboard.',
  },
  {
    icon: 'globe-outline',
    title: 'What goes online',
    body: 'Only link previews: when you forward a link, Forward asks that site, its image server or its public preview service (YouTube, X) for the title and thumbnail so it can sort it. Some apps, like Instagram, hide post details from anyone not logged in; a short note does the job instead. You can turn previews off in Settings; sorting then works from the text you share.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Permissions',
    body: 'No contacts, location, camera or storage permissions. Photos and files are picked with the system pickers, which only hand over what you choose.',
  },
  {
    icon: 'key-outline',
    title: 'If you forget your passcode',
    body: 'Nobody can reset it — that’s what keeps it private. Use Face ID or fingerprint to get in and set a new one, or erase and restore from an encrypted backup.',
  },
  {
    icon: 'cloud-download-outline',
    title: 'Backups',
    body: 'Backups are a single file encrypted with a password you choose. Keep it wherever you like; it is useless without that password.',
  },
];

export default function PrivacyScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  return (
    <Screen>
      <Header onBack={() => nav.goBack()} title="Privacy & security" subtitle="How Forward keeps your things yours." />
      <Scroll>
        {SECTIONS.map(s => (
          <Card key={s.title} style={{ marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Ionicons name={s.icon} size={22} color={c.accent} />
              <View style={{ flex: 1 }}>
                <Txt variant="h3">{s.title}</Txt>
                <Txt variant="caption" color={c.textSecondary} style={{ marginTop: space.xs, lineHeight: 19 }}>
                  {s.body}
                </Txt>
              </View>
            </View>
          </Card>
        ))}
        {POLICY_URL ? (
          <Button
            title="Read the full privacy policy"
            variant="secondary"
            icon="document-text-outline"
            onPress={() => Linking.openURL(POLICY_URL).catch(() => Alert.alert('Can’t open link', POLICY_URL))}
          />
        ) : null}
      </Scroll>
    </Screen>
  );
}
