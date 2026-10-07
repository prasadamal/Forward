import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import {
  BlobKind,
  DEFAULT_SETTINGS,
  Folder,
  IncomingShare,
  Item,
  ItemSecret,
  StoredBlob,
  VaultSettings,
} from '../types';
import { BiometricUnlockResult, KeyringState, PasscodeKind, UnlockResult } from '../security/keyring';
import { closeSession, eraseEverything, getSession, hasSession, keyring, openSession } from './session';
import { FolderPatch, ItemPatch, NewItemInput } from '../db/repository';
import { exportBackup as writeBackup, importBackup as readBackup, MergeResult } from '../db/backup';
import { importLegacyData } from '../db/legacyImport';
import { enrichLink, IngestDeps, IngestOutcome, ingestShare } from '../ingest/ingest';
import { fetchLinkPreview } from '../ingest/linkPreview';
import { deleteImportedCopy, downloadThumbnail, prepareImage, readFileBytes } from '../ingest/media';
import { autoFileItem, classifyInputFor } from '../organizer/fileItem';
import { buildTree, uniqueChildName } from '../folders/tree';
import { folderColor } from '../constants/palette';
import { clearPendingSecret } from '../security/clipboard';
import { clearThumbCache } from './thumbs';
import { normalizePhrase } from '../organizer/text';

export type VaultStatus = 'booting' | 'setup' | 'locked' | 'unlocked' | 'orphaned' | 'failed';

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const REVEAL_GRACE_MS = 60 * 1000;

interface VaultStore {
  status: VaultStatus;
  failure: string | null;
  keyringState: KeyringState | null;
  folders: Folder[];
  items: Item[];
  settings: VaultSettings;
  pendingShares: IncomingShare[];
  /** Secrets may be shown without asking again until this time. */
  revealUntil: number;
  /** One-off message for the user (e.g. "Imported 12 notes"). */
  notice: string | null;
  /** True while first-run setup is still showing (biometrics/tips steps). */
  onboarding: boolean;

  boot: () => Promise<void>;
  setOnboarding: (on: boolean) => void;
  setupVault: (passcode: string, kind: PasscodeKind) => Promise<void>;
  unlockWithPasscode: (passcode: string) => Promise<UnlockResult>;
  unlockWithBiometrics: () => Promise<BiometricUnlockResult>;
  lock: () => Promise<void>;
  eraseVault: () => Promise<void>;
  setBiometrics: (enabled: boolean) => Promise<boolean>;
  changePasscode: (passcode: string, kind: PasscodeKind) => Promise<void>;
  verifyPasscode: (passcode: string) => Promise<boolean>;
  markRevealed: () => void;
  dismissNotice: () => void;

  reload: () => Promise<void>;
  createFolder: (input: { parentId: string | null; name: string; emoji?: string; keywords?: string[] }) => Promise<Folder>;
  updateFolder: (id: string, patch: FolderPatch) => Promise<void>;
  moveFolder: (id: string, parentId: string | null) => Promise<void>;
  deleteFolder: (id: string, items: 'keep' | 'trash') => Promise<void>;

  createItem: (input: NewItemInput, options?: { autoFile?: boolean }) => Promise<Item>;
  updateItem: (id: string, patch: ItemPatch) => Promise<void>;
  setItemFolders: (id: string, folderIds: string[]) => Promise<void>;
  refileItem: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  trashItems: (ids: string[]) => Promise<void>;
  restoreItems: (ids: string[]) => Promise<void>;
  deleteItemsForever: (ids: string[]) => Promise<void>;
  emptyTrash: () => Promise<void>;
  getSecret: (id: string) => Promise<ItemSecret | null>;
  setSecret: (id: string, secret: ItemSecret | null) => Promise<void>;
  getBlob: (id: string, kind: BlobKind) => Promise<StoredBlob | null>;
  enrich: (id: string) => void;

  updateSettings: (patch: Partial<VaultSettings>) => Promise<void>;

  enqueueShare: (share: IncomingShare) => void;
  takeShare: (id: string) => IncomingShare | undefined;
  processShare: (share: IncomingShare) => Promise<IngestOutcome[]>;

  exportBackup: (password: string) => Promise<string>;
  importBackup: (uri: string, password: string) => Promise<MergeResult>;
}

function ingestDeps(get: () => VaultStore): IngestDeps {
  const { repo } = getSession();
  return {
    repo,
    settings: () => get().settings,
    fetchPreview: url => fetchLinkPreview(url),
    downloadThumbnail,
    prepareImage,
    readFileBytes,
    deleteImportedCopy,
    now: () => Date.now(),
    onChange: () => scheduleReload(get),
  };
}

let reloadTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleReload(get: () => VaultStore) {
  if (reloadTimer) return;
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    if (hasSession()) void get().reload();
  }, 60);
}

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const useVault = create<VaultStore>((set, get) => {
  /** Loads everything after a successful unlock. */
  async function afterUnlock(key: Uint8Array, opts: { importLegacy?: boolean } = {}) {
    const session = await openSession(key);
    const { repo } = session;
    let notice: string | null = null;
    if (opts.importLegacy) {
      try {
        const n = await importLegacyData(repo, AsyncStorage, Date.now());
        if (n > 0) notice = `Moved ${n} ${n === 1 ? 'note' : 'notes'} from the previous version into your encrypted vault.`;
      } catch {
        notice = 'Some notes from the previous version could not be imported.';
      }
    }
    await repo.purgeTrash(TRASH_RETENTION_MS).catch(() => undefined);
    const [folders, items, settings, keyringState] = await Promise.all([
      repo.listFolders(),
      repo.listItems(),
      repo.getSettings(),
      keyring.getState(),
    ]);
    set({
      status: 'unlocked',
      failure: null,
      folders,
      items,
      settings,
      keyringState,
      notice,
      revealUntil: Date.now() + REVEAL_GRACE_MS,
    });
    // Links saved while offline (or before a preview finished) get their details now.
    if (settings.linkPreviews) {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      items
        .filter(i => i.type === 'link' && i.url && !i.trashedAt && !i.meta.link?.previewAt && i.createdAt > weekAgo)
        .slice(0, 10)
        .forEach(i => get().enrich(i.id));
    }
  }

  async function refreshItem(id: string) {
    const item = await getSession().repo.getItem(id);
    set(state => ({
      items: item
        ? state.items.some(i => i.id === id)
          ? state.items.map(i => (i.id === id ? item : i))
          : [item, ...state.items]
        : state.items.filter(i => i.id !== id),
    }));
  }

  return {
    status: 'booting',
    failure: null,
    keyringState: null,
    folders: [],
    items: [],
    settings: DEFAULT_SETTINGS,
    pendingShares: [],
    revealUntil: 0,
    notice: null,
    onboarding: false,

    setOnboarding: on => set({ onboarding: on }),

    boot: async () => {
      try {
        const status = await keyring.status();
        const keyringState = await keyring.getState();
        set({
          status: status === 'none' ? 'setup' : status === 'orphaned' ? 'orphaned' : 'locked',
          keyringState,
        });
      } catch (e) {
        set({ status: 'failed', failure: describeError(e) });
      }
    },

    setupVault: async (passcode, kind) => {
      // A vault file without a keyring is unreadable leftovers; start clean.
      await eraseEverything().catch(() => undefined);
      const key = await keyring.setup(passcode, kind);
      await afterUnlock(key, { importLegacy: true });
    },

    unlockWithPasscode: async passcode => {
      const result = await keyring.unlockWithPasscode(passcode);
      if (result.ok) {
        try {
          await afterUnlock(result.key);
        } catch (e) {
          set({ status: 'failed', failure: describeError(e) });
        }
      } else {
        set({ keyringState: await keyring.getState() });
      }
      return result;
    },

    unlockWithBiometrics: async () => {
      const result = await keyring.unlockWithBiometrics('Unlock Forward');
      if (result.ok) {
        try {
          await afterUnlock(result.key);
        } catch (e) {
          set({ status: 'failed', failure: describeError(e) });
        }
      } else {
        set({ keyringState: await keyring.getState() });
      }
      return result;
    },

    lock: async () => {
      if (get().status !== 'unlocked') return;
      await clearPendingSecret();
      clearThumbCache();
      await closeSession();
      set({ status: 'locked', folders: [], items: [], revealUntil: 0, keyringState: await keyring.getState() });
    },

    eraseVault: async () => {
      clearThumbCache();
      await eraseEverything();
      set({
        status: 'setup',
        folders: [],
        items: [],
        settings: DEFAULT_SETTINGS,
        keyringState: null,
        pendingShares: [],
        revealUntil: 0,
        notice: null,
      });
    },

    setBiometrics: async enabled => {
      let ok = true;
      if (enabled) ok = await keyring.enableBiometrics(getSession().key, 'Turn on quick unlock');
      else await keyring.disableBiometrics();
      set({ keyringState: await keyring.getState() });
      return ok;
    },

    changePasscode: async (passcode, kind) => {
      await keyring.changePasscode(getSession().key, passcode, kind);
      set({ keyringState: await keyring.getState() });
    },

    verifyPasscode: async passcode => {
      const result = await keyring.unlockWithPasscode(passcode);
      set({ keyringState: await keyring.getState() });
      if (result.ok) result.key.fill(0);
      return result.ok;
    },

    markRevealed: () => set({ revealUntil: Date.now() + REVEAL_GRACE_MS }),
    dismissNotice: () => set({ notice: null }),

    reload: async () => {
      if (!hasSession()) return;
      const { repo } = getSession();
      const [folders, items] = await Promise.all([repo.listFolders(), repo.listItems()]);
      set({ folders, items });
    },

    // ── Folders ──
    createFolder: async ({ parentId, name, emoji, keywords }) => {
      const tree = buildTree(get().folders);
      const finalName = uniqueChildName(tree, parentId, name.trim() || 'New folder');
      // Top-level folders auto-collect items that mention their name ("Coorg", "Wedding").
      // Subfolders don't, so "Bangalore › Cafes" doesn't swallow cafés from other cities.
      const words = keywords ?? (parentId === null && finalName.length >= 3 ? [normalizePhrase(finalName)] : []);
      const folder = await getSession().repo.createFolder({
        parentId,
        name: finalName,
        emoji: emoji ?? '📁',
        color: folderColor(finalName),
        keywords: words.filter(Boolean),
      });
      set(state => ({ folders: [...state.folders, folder] }));
      return folder;
    },

    updateFolder: async (id, patch) => {
      const { repo } = getSession();
      // A folder the user edits is theirs now; it keeps its smart key so auto-filing still finds it.
      await repo.updateFolder(id, { ...patch, auto: false });
      set({ folders: await repo.listFolders() });
    },

    moveFolder: async (id, parentId) => {
      const { repo } = getSession();
      await repo.moveFolder(id, parentId);
      await repo.updateFolder(id, { auto: false });
      set({ folders: await repo.listFolders() });
    },

    deleteFolder: async (id, mode) => {
      await getSession().repo.deleteFolder(id, mode);
      await get().reload();
    },

    // ── Items ──
    createItem: async (input, options) => {
      const { repo } = getSession();
      const item = await repo.createItem(input);
      const shouldFile = options?.autoFile ?? (get().settings.autoFile && !input.folderIds?.length);
      if (shouldFile) await autoFileItem(repo, item.id, classifyInputFor(item));
      await get().reload();
      if (item.type === 'link' && item.url) get().enrich(item.id);
      return (await repo.getItem(item.id)) ?? item;
    },

    updateItem: async (id, patch) => {
      await getSession().repo.updateItem(id, patch);
      await refreshItem(id);
    },

    setItemFolders: async (id, folderIds) => {
      const { repo } = getSession();
      await repo.setItemFolders(id, folderIds);
      await repo.updateItem(id, { filing: 'manual' });
      await refreshItem(id);
    },

    refileItem: async id => {
      const { repo } = getSession();
      const item = await repo.getItem(id);
      if (!item) return;
      await repo.updateItem(id, { filing: 'auto' });
      await autoFileItem(repo, id, classifyInputFor(item));
      await get().reload();
    },

    togglePin: async id => {
      const item = get().items.find(i => i.id === id);
      if (!item) return;
      await get().updateItem(id, { pinned: !item.pinned });
    },

    trashItems: async ids => {
      await getSession().repo.trashItems(ids);
      await get().reload();
    },

    restoreItems: async ids => {
      await getSession().repo.restoreItems(ids);
      await get().reload();
    },

    deleteItemsForever: async ids => {
      await getSession().repo.deleteItems(ids);
      await get().reload();
    },

    emptyTrash: async () => {
      await getSession().repo.purgeTrash();
      await get().reload();
    },

    getSecret: id => getSession().repo.getSecret(id),

    setSecret: async (id, secret) => {
      await getSession().repo.setSecret(id, secret);
      await refreshItem(id);
    },

    getBlob: (id, kind) => getSession().repo.getBlob(id, kind),

    enrich: id => {
      if (!hasSession() || !get().settings.linkPreviews) return;
      enrichLink(id, ingestDeps(get)).catch(() => undefined);
    },

    // ── Settings ──
    updateSettings: async patch => {
      const settings = { ...get().settings, ...patch };
      set({ settings });
      await getSession().repo.saveSettings(patch);
    },

    // ── Shares ──
    enqueueShare: share => set(state => ({ pendingShares: [...state.pendingShares, share] })),

    takeShare: id => {
      const share = get().pendingShares.find(s => s.id === id);
      if (share) set(state => ({ pendingShares: state.pendingShares.filter(s => s.id !== id) }));
      return share;
    },

    processShare: async share => {
      const deps = ingestDeps(get);
      const outcomes = await ingestShare(share, deps);
      await get().reload();
      for (const o of outcomes) {
        if (o.status === 'saved' && o.type === 'link') get().enrich(o.itemId);
      }
      return outcomes;
    },

    // ── Backups ──
    exportBackup: async password => {
      const { repo } = getSession();
      const dir = new Directory(Paths.cache, 'backups');
      if (dir.exists) dir.delete();
      dir.create({ intermediates: true, idempotent: true });
      const date = new Date().toISOString().slice(0, 10);
      const file = new File(dir, `Forward-backup-${date}.forward`);
      await repo.exclusive(db => writeBackup(db, password, file.uri));
      return file.uri;
    },

    importBackup: async (uri, password) => {
      const { repo } = getSession();
      try {
        const result = await repo.exclusive(db => readBackup(db, password, uri, Date.now()));
        await get().reload();
        return result;
      } finally {
        deleteImportedCopy(uri);
      }
    },
  };
});

/** Removes an exported backup file from the cache once it has been shared. */
export function deleteExportedBackup(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}
