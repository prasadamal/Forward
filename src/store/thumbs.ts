import { useEffect, useState } from 'react';
import { BlobKind } from '../types';
import { dataUri } from '../utils/encoding';
import { getSession, hasSession } from './session';

/**
 * Decrypted images are kept in memory only (never written to disk) as data
 * URIs in a small LRU cache that is wiped when the vault locks.
 */
const MAX_ENTRIES = 120;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function remember(key: string, uri: string) {
  cache.delete(key);
  cache.set(key, uri);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function clearThumbCache(): void {
  cache.clear();
  inflight.clear();
}

export function forgetImage(itemId: string): void {
  for (const key of [...cache.keys()]) if (key.startsWith(`${itemId}:`)) cache.delete(key);
}

export async function loadImageUri(itemId: string, kind: BlobKind): Promise<string | null> {
  const key = `${itemId}:${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  const task = (async () => {
    if (!hasSession()) return null;
    const blob = await getSession().repo.getBlob(itemId, kind);
    if (!blob || !blob.mime.startsWith('image/')) return null;
    const uri = dataUri(blob.mime, blob.data);
    // Full-size images are large; only cache thumbnails long-term.
    if (kind === 'thumb') remember(key, uri);
    return uri;
  })()
    .catch(() => null)
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

/** Data URI for an item's image, or null while loading / when there is none. */
export function useImageUri(itemId: string | undefined, kind: BlobKind, enabled = true): string | null {
  const key = itemId ? `${itemId}:${kind}` : '';
  const [uri, setUri] = useState<string | null>(() => (key ? cache.get(key) ?? null : null));
  useEffect(() => {
    let alive = true;
    if (!itemId || !enabled) {
      setUri(null);
      return;
    }
    const cached = cache.get(`${itemId}:${kind}`);
    if (cached) {
      setUri(cached);
      return;
    }
    loadImageUri(itemId, kind).then(u => {
      if (alive) setUri(u);
    });
    return () => {
      alive = false;
    };
  }, [itemId, kind, enabled]);
  return uri;
}
