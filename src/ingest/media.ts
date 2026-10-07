import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { StoredBlob } from '../types';
import { newId } from '../utils/ids';
import { FileTooLargeError, MAX_FILE_BYTES, PreparedImage } from './mediaTypes';

export { FileTooLargeError, MAX_FILE_BYTES };
export type { PreparedImage };

/**
 * File and image handling for imports. Everything that ends up in the vault is
 * read into memory and stored inside the encrypted database; temporary
 * plaintext copies are deleted as soon as they're no longer needed.
 */

/** Images larger than this (pixels on the long side) are scaled down. */
const MAX_IMAGE_SIDE = 2560;
const THUMB_SIDE = 480;
/** Re-encode images above this size even if their dimensions are fine. */
const REENCODE_ABOVE_BYTES = 4 * 1024 * 1024;

export function fileSize(uri: string): number | undefined {
  try {
    const f = new File(uri);
    return f.exists ? f.size : undefined;
  } catch {
    return undefined;
  }
}

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  const size = fileSize(uri);
  if (size !== undefined && size > MAX_FILE_BYTES) throw new FileTooLargeError(size);
  const bytes = await new File(uri).bytes();
  if (bytes.length > MAX_FILE_BYTES) throw new FileTooLargeError(bytes.length);
  return bytes;
}

function containerUris(): string[] {
  const uris = [Paths.cache.uri];
  try {
    for (const dir of Object.values(Paths.appleSharedContainers ?? {})) uris.push(dir.uri);
  } catch {
    // not available on this platform
  }
  return uris.map(u => (u.endsWith('/') ? u : `${u}/`));
}

/**
 * Deletes a file handed to us by the share sheet or a picker, but only if it is
 * our own temporary copy (cache or app-group container) — never a user's file.
 */
export function deleteImportedCopy(uri: string | undefined): void {
  if (!uri) return;
  // iOS reports app-group paths both with and without the /private prefix.
  const norm = (u: string) => u.replace(/^file:\/\/+/, 'file:///').replace(/^file:\/\/\/private\//, 'file:///');
  const target = norm(uri);
  if (!containerUris().some(prefix => target.startsWith(norm(prefix)))) return;
  deleteQuietly(uri);
}

/** Deletes a temporary file; never throws. */
export function deleteQuietly(uri: string | undefined): void {
  if (!uri || !uri.startsWith('file://')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}

async function scaled(
  uri: string,
  maxSide: number,
  width: number | undefined,
  height: number | undefined,
  compress: number,
): Promise<{ blob: StoredBlob; tmpUri: string }> {
  const ctx = ImageManipulator.manipulate(uri);
  const landscape = (width ?? 1) >= (height ?? 1);
  if (!width || !height || Math.max(width, height) > maxSide) {
    ctx.resize(landscape ? { width: maxSide } : { height: maxSide });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress });
  const data = await new File(saved.uri).bytes();
  return { blob: { mime: 'image/jpeg', data, width: saved.width, height: saved.height }, tmpUri: saved.uri };
}

/**
 * Reads an image for storage. GIFs are kept as-is (animated memes!); very
 * large photos and HEIC images are re-encoded as JPEG. A small JPEG thumbnail
 * is generated for lists.
 */
export async function prepareImage(
  uri: string,
  mime: string,
  size?: number,
  width?: number,
  height?: number,
): Promise<PreparedImage> {
  const temps: string[] = [];
  try {
    const isGif = /gif/i.test(mime);
    const isHeic = /hei[cf]/i.test(mime);
    const bytesSize = size ?? fileSize(uri) ?? 0;
    const tooBig = (width && height && Math.max(width, height) > MAX_IMAGE_SIDE) || bytesSize > REENCODE_ABOVE_BYTES;

    let original: StoredBlob;
    if (!isGif && (isHeic || tooBig)) {
      const r = await scaled(uri, MAX_IMAGE_SIDE, width, height, 0.85);
      temps.push(r.tmpUri);
      original = r.blob;
    } else {
      original = { mime, data: await readFileBytes(uri), width, height };
    }

    let thumb: StoredBlob | undefined;
    try {
      const t = await scaled(uri, THUMB_SIDE, width ?? original.width, height ?? original.height, 0.7);
      temps.push(t.tmpUri);
      thumb = t.blob;
      if (!original.width || !original.height) {
        // Derive the original's dimensions from the thumbnail's aspect ratio when unknown.
        original = { ...original, width: original.width ?? width, height: original.height ?? height };
      }
    } catch {
      thumb = undefined;
    }
    return { original, thumb };
  } finally {
    temps.forEach(deleteQuietly);
  }
}

/** Downloads a preview image (e.g. a YouTube thumbnail) and returns a small JPEG. */
export async function downloadThumbnail(url: string): Promise<StoredBlob | null> {
  const dir = new Directory(Paths.cache, 'previews');
  const temps: string[] = [];
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `${newId()}.img`);
    const file = await File.downloadFileAsync(url, dest, { idempotent: true });
    temps.push(file.uri);
    if (file.size > 8 * 1024 * 1024) return null;
    const t = await scaled(file.uri, THUMB_SIDE, undefined, undefined, 0.7);
    temps.push(t.tmpUri);
    return t.blob;
  } catch {
    return null;
  } finally {
    temps.forEach(deleteQuietly);
  }
}

const OPEN_DIR = 'opened';

function safeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'file';
}

/**
 * Writes decrypted bytes to a temporary file so another app (or the video
 * player) can open it. Call `clearOpenedFiles()` when locking.
 */
export function writeTempFile(bytes: Uint8Array, name: string): string {
  const dir = new Directory(Paths.cache, OPEN_DIR, newId());
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, safeName(name));
  file.write(bytes);
  return file.uri;
}

export function clearOpenedFiles(): void {
  try {
    const dir = new Directory(Paths.cache, OPEN_DIR);
    if (dir.exists) dir.delete();
  } catch {
    // ignore
  }
}
