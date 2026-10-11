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

function time(iso: unknown, fallback: number): number {
  const t = typeof iso === 'string' ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : fallback;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Safe to run again after an interruption: every folder and note gets an id
 * derived from its v1 id, and ones already imported are skipped. The plaintext
 * is removed only once everything is in the vault.
 */
export async function importLegacyData(repo: VaultRepository, storage: LegacyStorage, now: number): Promise<number> {
  const raw = await storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return 0;
  let data: { notes?: LegacyNote[]; folders?: LegacyFolder[] };
  try {
    data = JSON.parse(raw);
  } catch {
    return 0;
  }

  const existingFolders = new Set((await repo.listFolders()).map(f => f.id));
  const folderMap = new Map<string, string>();
  for (const f of Array.isArray(data.folders) ? data.folders : []) {
    const name = str(f?.name).trim();
    if (!f || !str(f.id) || f.isSystem || !name) continue;
    const id = `v1-folder-${f.id}`;
    if (!existingFolders.has(id)) {
      await repo.createFolder({ id, parentId: null, name, emoji: str(f.emoji) || '📁', color: str(f.color) || undefined });
    }
    folderMap.set(str(f.id), id);
  }

  // v1 "archived" notes were kept, not deleted: file them in an Archive folder.
  const ARCHIVE_ID = 'v1-folder-archive';
  const archiveFolder = async () => {
    if (!existingFolders.has(ARCHIVE_ID)) {
      await repo.createFolder({ id: ARCHIVE_ID, parentId: null, name: 'Archive', emoji: '🗄️' });
      existingFolders.add(ARCHIVE_ID);
    }
    return ARCHIVE_ID;
  };

  let count = 0;
  const notes = Array.isArray(data.notes) ? data.notes : [];
  for (const [index, n] of notes.entries()) {
    if (!n || typeof n !== 'object') continue;
    const id = `v1-note-${str(n.id) || index}`;
    if (await repo.getItem(id)) continue;
    const content = str(n.content).trim();
    const url = str(n.url) || extractUrl(content);
    const text = url ? content.split(url).join(' ').replace(/\s+\n/g, '\n').trim() : content;
    const createdAt = time(n.createdAt, now);
    const folderIds = strings(n.folderIds).map(fid => folderMap.get(fid)).filter((fid): fid is string => !!fid);
    if (n.archived) folderIds.push(await archiveFolder());
    await repo.createItem({
      id,
      type: url ? 'link' : 'note',
      title: str(n.title).trim() || (url ? 'Saved link' : 'Note'),
      text,
      url,
      source: PLATFORM_TO_SOURCE[str(n.platform)] ?? (url ? 'web' : 'manual'),
      tags: strings(n.tags),
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
