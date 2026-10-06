/**
 * Core data model for Forward.
 *
 * Everything the user forwards (links, notes, memes, files) and everything they
 * lock away (cards, logins, secrets) is an `Item`. Items live in any number of
 * `Folder`s, and folders nest to unlimited depth through `parentId`.
 */

export type ItemType =
  | 'link'
  | 'note'
  | 'image'
  | 'video'
  | 'file'
  | 'card'
  | 'login'
  | 'secret';

/** Item types that belong to the Wallet and are always treated as sensitive. */
export const WALLET_TYPES: readonly ItemType[] = ['card', 'login', 'secret'];

export function isWalletType(type: ItemType): boolean {
  return WALLET_TYPES.includes(type);
}

/** Where an item came from. Detected from the link or the share payload. */
export type Source =
  | 'youtube'
  | 'instagram'
  | 'x'
  | 'reddit'
  | 'facebook'
  | 'linkedin'
  | 'threads'
  | 'pinterest'
  | 'spotify'
  | 'maps'
  | 'whatsapp'
  | 'telegram'
  | 'web'
  | 'shared'
  | 'manual';

export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'rupay'
  | 'amex'
  | 'diners'
  | 'discover'
  | 'jcb'
  | 'maestro'
  | 'unionpay'
  | 'other';

export type CardKind = 'credit' | 'debit' | 'prepaid' | 'other';

export interface LinkMeta {
  siteName?: string;
  author?: string;
  description?: string;
  imageUrl?: string;
  /** When the link preview was last fetched (ms). Undefined = never fetched. */
  previewAt?: number;
  /** The title is a placeholder that a link preview may replace. */
  autoTitle?: boolean;
  /** Final URL after redirects, when different (e.g. Maps short links). */
  finalUrl?: string;
}

export interface MediaMeta {
  mime: string;
  size: number;
  width?: number;
  height?: number;
  durationMs?: number;
  fileName?: string;
}

export interface CardMeta {
  brand: CardBrand;
  last4: string;
  holder: string;
  /** MM/YY */
  expiry: string;
  issuer: string;
  kind: CardKind;
  /** Index into CARD_THEMES. */
  theme: number;
}

export interface LoginMeta {
  username: string;
  website: string;
}

/** Non-secret structured data. Safe to keep in memory while unlocked. */
export interface ItemMeta {
  link?: LinkMeta;
  media?: MediaMeta;
  card?: CardMeta;
  login?: LoginMeta;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  /** Note body, caption, or a description of the item. */
  text: string;
  url?: string;
  source: Source;
  tags: string[];
  folderIds: string[];
  pinned: boolean;
  /** Content stays hidden until the user reveals it. Always true for wallet items. */
  sensitive: boolean;
  /** 'auto' means the auto-filer may still move the item (e.g. after a preview loads). */
  filing: 'auto' | 'manual';
  meta: ItemMeta;
  hasThumb: boolean;
  hasBlob: boolean;
  createdAt: number;
  updatedAt: number;
  trashedAt?: number;
}

export interface CardSecret {
  number: string;
  cvv: string;
  pin: string;
}

export interface LoginSecret {
  password: string;
}

/** Secret payloads. Loaded from the database only when the user opens an item. */
export interface ItemSecret {
  card?: CardSecret;
  login?: LoginSecret;
  /** Secure note body. */
  note?: string;
}

export interface Folder {
  id: string;
  /** null = top level. Nesting depth is unlimited. */
  parentId: string | null;
  name: string;
  emoji: string;
  color: string;
  /** Words or phrases that auto-file matching items into this folder. */
  keywords: string[];
  /** Created by the auto-filer rather than by the user. */
  auto: boolean;
  /**
   * Stable identity for smart folders ("place:Bangalore", "topic:Food") so
   * auto-filing keeps working after the user renames or moves the folder.
   */
  smartKey?: string;
  createdAt: number;
  updatedAt: number;
}

export type BlobKind = 'original' | 'thumb';

export interface StoredBlob {
  mime: string;
  data: Uint8Array;
  width?: number;
  height?: number;
}

export interface VaultSettings {
  /** Seconds in background before the vault locks. 0 = immediately. */
  autoLockSeconds: number;
  /** Block screenshots/screen recording and hide content in the app switcher. */
  blockScreenshots: boolean;
  /** Fetch titles and thumbnails for links from the site that was shared. */
  linkPreviews: boolean;
  /** Automatically file forwarded items into folders. */
  autoFile: boolean;
  /** Ask for Face ID / fingerprint / passcode before revealing card numbers & passwords. */
  revealNeedsAuth: boolean;
  /** Seconds after which copied secrets are wiped from the clipboard. 0 = never. */
  clipboardClearSeconds: number;
}

export const DEFAULT_SETTINGS: VaultSettings = {
  autoLockSeconds: 60,
  blockScreenshots: true,
  linkPreviews: true,
  autoFile: true,
  revealNeedsAuth: true,
  clipboardClearSeconds: 45,
};

export type ThemePreference = 'light' | 'dark' | 'system';

/** A file handed to Forward by the OS share sheet or a picker. */
export interface IncomingFile {
  uri: string;
  mimeType: string;
  name: string;
  size?: number;
  width?: number;
  height?: number;
  durationMs?: number;
}

/** Everything another app forwarded to us in one share action. */
export interface IncomingShare {
  id: string;
  receivedAt: number;
  text?: string;
  /** Title/subject provided by the sending app (Android EXTRA_SUBJECT, Safari page title…). */
  subject?: string;
  /** Page description provided by the sending app (Safari on iOS). */
  description?: string;
  files: IncomingFile[];
}
