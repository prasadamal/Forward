import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';
import { deleteExportedBackup, useVault } from '../store/vault';
import { withAutoLockSuspended } from '../security/autoLock';
import { MIN_BACKUP_PASSWORD, WrongBackupPasswordError } from '../db/backup';
import { passwordStrength } from '../wallet/passwords';
import { space, useTheme } from '../theme';
import { Button, Card, Header, Screen, Scroll, TextField, Txt } from '../ui/primitives';
import { toast } from '../ui/Toast';

export default function BackupScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const exportBackup = useVault(s => s.exportBackup);
  const importBackup = useVault(s => s.importBackup);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [exporting, setExporting] = useState(false);

  const [file, setFile] = useState<{ uri: string; name: string } | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoring, setRestoring] = useState(false);

  const strength = passwordStrength(password);
  const exportError =
    password && password.length < MIN_BACKUP_PASSWORD
      ? `Use at least ${MIN_BACKUP_PASSWORD} characters`
      : confirm && confirm !== password
        ? 'Passwords don’t match'
        : null;

  const doExport = async () => {
    if (exportError || !password || confirm !== password) return;
    setExporting(true);
    let uri: string | null = null;
    try {
      uri = await exportBackup(password);
      const target = uri;
      await withAutoLockSuspended(() =>
        Sharing.shareAsync(target, { mimeType: 'application/octet-stream', UTI: 'public.data', dialogTitle: 'Save your Forward backup' }),
      );
      setPassword('');
      setConfirm('');
      toast('Backup created');
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : String(e));
    } finally {
      if (uri) deleteExportedBackup(uri);
      setExporting(false);
    }
  };

  const chooseFile = async () => {
    const result = await withAutoLockSuspended(() =>
      DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false }),
    );
    if (result.canceled || !result.assets?.[0]) return;
    setFile({ uri: result.assets[0].uri, name: result.assets[0].name });
  };

  const doRestore = async () => {
    if (!file || !restorePassword) return;
    setRestoring(true);
    try {
      const r = await importBackup(file.uri, restorePassword);
      setFile(null);
      setRestorePassword('');
      Alert.alert(
        'Backup restored',
        r.items || r.folders
          ? `Added ${r.items} ${r.items === 1 ? 'item' : 'items'} and ${r.folders} ${r.folders === 1 ? 'folder' : 'folders'}. Things you already had were kept.`
          : 'Everything in this backup was already in your vault.',
      );
    } catch (e) {
      if (e instanceof WrongBackupPasswordError) {
        Alert.alert('Can’t open backup', e.message);
      } else {
        Alert.alert('Restore failed', e instanceof Error ? e.message : String(e));
        setFile(null);
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Header onBack={() => nav.goBack()} title="Backup" subtitle="Your vault never leaves this phone unless you export it." />
        <Scroll>
          <Card style={{ marginBottom: space.xl }}>
            <Txt variant="h3">Create an encrypted backup</Txt>
            <Txt variant="caption" color={c.textSecondary} style={{ marginTop: space.xs, marginBottom: space.lg, lineHeight: 19 }}>
              One file with everything — folders, links, memes, files, cards and passwords — locked with a password you
              choose. Save it to Files, Google Drive, or send it to your laptop. Without the password it’s unreadable, and
              it can’t be recovered if you forget it.
            </Txt>
            <TextField
              label="Backup password"
              secure
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              hint={password ? `Strength: ${strength.label}` : 'At least 8 characters. Different from your passcode is best.'}
            />
            <TextField
              label="Confirm password"
              secure
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              error={exportError}
            />
            <Button
              title="Create backup"
              icon="download-outline"
              onPress={() => void doExport()}
              loading={exporting}
              disabled={!password || confirm !== password || !!exportError}
            />
          </Card>

          <Card>
            <Txt variant="h3">Restore a backup</Txt>
            <Txt variant="caption" color={c.textSecondary} style={{ marginTop: space.xs, marginBottom: space.lg, lineHeight: 19 }}>
              Adds everything from a Forward backup to this vault. Nothing you already have is removed, and restoring the same
              backup twice doesn’t create duplicates.
            </Txt>
            {file ? (
              <View>
                <Txt variant="bodyStrong" numberOfLines={1} style={{ marginBottom: space.md }}>
                  {file.name}
                </Txt>
                <TextField
                  label="Backup password"
                  secure
                  value={restorePassword}
                  onChangeText={setRestorePassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                <Button title="Restore" icon="refresh" onPress={() => void doRestore()} loading={restoring} disabled={!restorePassword} />
                <Button title="Choose a different file" variant="ghost" onPress={() => void chooseFile()} style={{ marginTop: space.sm }} />
              </View>
            ) : (
              <Button title="Choose backup file" variant="secondary" icon="folder-open-outline" onPress={() => void chooseFile()} />
            )}
          </Card>
        </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
