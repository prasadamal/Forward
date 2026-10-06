import { VaultRepository } from './repository';
import { Source } from '../types';
import { extractUrl } from '../ingest/urls';

/**
 * One-time import of notes saved by Forward 1.x, which kept everything as
 * plain JSON in AsyncStorage. After a successful import the plaintext copy is
 * deleted so nothing sensitive is left unencrypted on the device.
 */
export const LEGACY_STORAGE_KEY = '@forward_data_v1';

export interface LegacyStorage {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

interface LegacyNote {
  id?: string;
  title?: string;
  content?: string;
  url?: string;
  platform?: string;
  tags?: string[];
  folderIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  pinned?: boolean;
  archived?: boolean;
}

interface LegacyFolder {
  id?: string;
  name?: string;
  emoji?: string;
  color?: string;
  isSystem?: boolean;
}

const PLATFORM_TO_SOURCE: Record<string, Source> = {
  youtube: 'youtube',
  instagram: 'instagram',
  twitter: 'x',
  reddit: 'reddit',
  web: 'web',
  manual: 'manual',
};

function time(iso: string | undefined, fallback: number): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : fallback;
}

export async function importLegacyData(repo: VaultRepository, storage: LegacyStorage, now: number): Promise<number> {
  const raw = await storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return 0;
  let data: { notes?: LegacyNote[]; folders?: LegacyFolder[] };
  try {
    data = JSON.parse(raw);
  } catch {
    return 0;
  }

  const folderMap = new Map<string, string>();
  for (const f of data.folders ?? []) {
    if (!f?.id || f.isSystem || !f.name) continue;
    const created = await repo.createFolder({
      parentId: null,
      name: f.name,
      emoji: f.emoji || '📁',
      color: f.color,
    });
    folderMap.set(f.id, created.id);
  }

  // v1 "archived" notes were kept, not deleted: file them in an Archive folder.
  let archiveFolderId: string | undefined;
  const archiveFolder = async () => {
    if (!archiveFolderId) {
      archiveFolderId = (await repo.createFolder({ parentId: null, name: 'Archive', emoji: '🗄️' })).id;
    }
    return archiveFolderId;
  };

  let count = 0;
  for (const n of data.notes ?? []) {
    if (!n) continue;
    const content = (n.content ?? '').trim();
    const url = n.url ?? extractUrl(content);
    const text = url ? content.split(url).join(' ').replace(/\s+\n/g, '\n').trim() : content;
    const createdAt = time(n.createdAt, now);
    const folderIds = (n.folderIds ?? []).map(id => folderMap.get(id)).filter((id): id is string => !!id);
    if (n.archived) folderIds.push(await archiveFolder());
    await repo.createItem({
      type: url ? 'link' : 'note',
      title: (n.title ?? '').trim() || (url ? 'Saved link' : 'Note'),
      text,
      url,
      source: PLATFORM_TO_SOURCE[n.platform ?? ''] ?? (url ? 'web' : 'manual'),
      tags: Array.isArray(n.tags) ? n.tags.filter(t => typeof t === 'string') : [],
      folderIds,
      pinned: !!n.pinned && !n.archived,
      filing: 'manual',
      createdAt,
      updatedAt: time(n.updatedAt, createdAt),
    });
    count++;
  }
  await storage.removeItem(LEGACY_STORAGE_KEY);
  return count;
}
