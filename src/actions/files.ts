import { Share } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { IncomingFile, IncomingShare, Item } from '../types';
import { withAutoLockSuspended } from '../security/autoLock';
import { mimeFromName, baseName } from '../ingest/shareParser';
import { deleteQuietly, writeTempFile } from '../ingest/media';
import { useVault } from '../store/vault';
import { newId } from '../utils/ids';

/** Photos & videos from the gallery. Uses the system picker: no photo-library permission needed. */
export async function pickMedia(): Promise<IncomingFile[]> {
  const result = await withAutoLockSuspended(() =>
    ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 1,
      exif: false,
    }),
  );
  if (result.canceled) return [];
  return result.assets.map(a => {
    const name = a.fileName || baseName(a.uri);
    return {
      uri: a.uri,
      name,
      mimeType: a.mimeType || (a.type === 'video' ? 'video/mp4' : mimeFromName(name)),
      size: a.fileSize,
      width: a.width || undefined,
      height: a.height || undefined,
    };
  });
}

/** Any file (PDF tickets, bills, documents…). Copied to our cache, imported, then deleted. */
export async function pickDocuments(): Promise<IncomingFile[]> {
  const result = await withAutoLockSuspended(() =>
    DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true }),
  );
  if (result.canceled) return [];
  return result.assets.map(a => ({
    uri: a.uri,
    name: a.name,
    mimeType: a.mimeType || mimeFromName(a.name),
    size: a.size,
  }));
}

/** Wraps picked files as a share so they go through the same pipeline as the share sheet. */
export function localShare(files: IncomingFile[], folderId?: string): IncomingShare {
  return { id: newId(), receivedAt: Date.now(), files, origin: 'app', folderId };
}

/**
 * Sends an item out through the system share sheet. Files are decrypted to a
 * temporary file that is deleted right after.
 */
export async function shareItemOut(item: Item): Promise<void> {
  if (item.hasBlob) {
    const blob = await useVault.getState().getBlob(item.id, 'original');
    if (!blob) return;
    const name = item.meta.media?.fileName || `${item.title || 'forward'}.${blob.mime.split('/')[1] ?? 'bin'}`;
    const uri = writeTempFile(blob.data, name);
    try {
      await withAutoLockSuspended(() => Sharing.shareAsync(uri, { mimeType: blob.mime, dialogTitle: item.title }));
    } finally {
      deleteQuietly(uri);
    }
    return;
  }
  const message = [item.title, item.text, item.url].filter(Boolean).join('\n\n');
  await withAutoLockSuspended(() => Share.share(item.url ? { message, url: item.url } : { message }));
}
