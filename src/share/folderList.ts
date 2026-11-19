import type { Item } from '../types';
import { isWalletType } from '../types';

/** Long lists stay readable in a chat message; the rest is summarised in one line. */
export const MAX_SHARED_LINKS = 50;

export interface FolderListText {
  message: string;
  /** Links written into the message. */
  shared: number;
  /** Items left out on purpose: notes, photos, files, hidden and wallet items. */
  leftOut: number;
}

/**
 * A plain-text list of a folder's links, ready for any chat app.
 * Only links go out: notes, photos and files stay on the phone, and hidden (sensitive) or wallet
 * items are never included, whatever folder they sit in. Returns null when there is nothing to share.
 */
export function folderListText(folderName: string, items: readonly Item[]): FolderListText | null {
  const links = items.filter(i => !i.trashedAt && i.url && !i.sensitive && !isWalletType(i.type));
  if (!links.length) return null;
  const shown = links.slice(0, MAX_SHARED_LINKS);
  const lines = shown.map((item, index) => {
    const title = oneLine(item.title) || oneLine(item.url!);
    return title === oneLine(item.url!) ? `${index + 1}. ${item.url}` : `${index + 1}. ${title}\n   ${item.url}`;
  });
  const more = links.length - shown.length;
  const name = oneLine(folderName) || 'My list';
  const message = [
    `${name} (${links.length === 1 ? '1 link' : `${links.length} links`})`,
    lines.join('\n'),
    more > 0 ? `…and ${more} more.` : '',
    'Saved and sorted with Forward.',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { message, shared: shown.length, leftOut: items.filter(i => !i.trashedAt).length - shown.length };
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}
