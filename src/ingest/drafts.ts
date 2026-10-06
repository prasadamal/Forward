import { IncomingFile, IncomingShare, ItemType, Source } from '../types';
import { detectSource, extractUrls } from './urls';
import { SOURCE_INFO } from '../constants/palette';
import { firstLine, tidy } from '../organizer/text';

/**
 * Turns one share action into the items it should become:
 *  - each file → one image / video / file item (the shared text is its caption)
 *  - text with a single link → a link item (the rest of the text is its note)
 *  - any other text → a note
 */

export type DraftType = Extract<ItemType, 'link' | 'note' | 'image' | 'video' | 'file'>;

export interface ItemDraft {
  type: DraftType;
  title: string;
  /** True when the title is a placeholder ("YouTube video") that a preview may replace. */
  titleIsGuess: boolean;
  text: string;
  url?: string;
  source: Source;
  /** Extra text that helps classification but isn't shown as the note (e.g. Safari page description). */
  hint?: string;
  file?: IncomingFile;
}

export function typeForMime(mime: string): DraftType {
  if (/^image\//i.test(mime)) return 'image';
  if (/^video\//i.test(mime)) return 'video';
  return 'file';
}

const GENERIC_FILE_NAMES = /^(img|image|vid|video|file|pxl|dsc|screenshot|photo|wa|signal|telegram)[-_\s]?[\d_\-\s.()]*$/i;

function titleFromFileName(name: string): string | undefined {
  const stem = name.replace(/\.[a-z0-9]{1,5}$/i, '').trim();
  if (!stem || GENERIC_FILE_NAMES.test(stem) || /^[0-9a-f-]{16,}$/i.test(stem)) return undefined;
  return tidy(stem.replace(/[_]+/g, ' '), 80);
}

/** Cleans titles that sending apps wrap in boilerplate. */
export function cleanSubject(subject: string | undefined): string | undefined {
  if (!subject) return undefined;
  let s = subject.trim();
  const yt = /^(?:watch\s+)?["“](.+)["”]\s+on\s+youtube$/i.exec(s);
  if (yt) s = yt[1];
  s = s.replace(/\s+[-–|]\s+youtube$/i, '');
  if (/^(check (this|it) out|shared via .+|sent from my .+)$/i.test(s)) return undefined;
  return tidy(s, 120) || undefined;
}

export function placeholderTitle(type: DraftType, source: Source): string {
  if (type === 'link') {
    switch (source) {
      case 'youtube':
        return 'YouTube video';
      case 'instagram':
        return 'Instagram post';
      case 'x':
        return 'Post on X';
      case 'reddit':
        return 'Reddit post';
      case 'maps':
        return 'Place on Maps';
      case 'spotify':
        return 'On Spotify';
      case 'web':
        return 'Saved link';
      default:
        return `${SOURCE_INFO[source].label} link`;
    }
  }
  if (type === 'image') return 'Image';
  if (type === 'video') return 'Video';
  if (type === 'file') return 'File';
  return 'Note';
}

function removeUrl(text: string, url: string): string {
  return text
    .split(url)
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function draftsFromShare(share: IncomingShare): ItemDraft[] {
  const text = (share.text ?? '').trim();
  const subject = cleanSubject(share.subject);

  if (share.files.length) {
    return share.files.map(file => {
      const type = typeForMime(file.mimeType);
      const caption = text;
      const fromCaption = firstLine(caption, 80);
      const fromName = titleFromFileName(file.name);
      const title = subject ?? (fromCaption || fromName);
      const urls = extractUrls(caption);
      return {
        type,
        title: title || placeholderTitle(type, 'shared'),
        titleIsGuess: !title,
        text: caption,
        url: urls[0],
        source: urls.length ? detectSource(urls[0]) : 'shared',
        hint: share.description,
        file,
      };
    });
  }

  if (!text) return [];
  const urls = extractUrls(text);
  if (urls.length === 1) {
    const url = urls[0];
    const source = detectSource(url);
    const note = removeUrl(text, url);
    const noteTitle = firstLine(note, 80);
    // A note like "Check this out!" isn't a useful title; prefer the app's subject.
    const title = subject ?? (note.length > 3 ? noteTitle : undefined);
    return [
      {
        type: 'link',
        title: title || placeholderTitle('link', source),
        titleIsGuess: !subject,
        text: note,
        url,
        source,
        hint: share.description,
      },
    ];
  }

  const title = subject ?? firstLine(text, 80);
  return [
    {
      type: 'note',
      title: title || 'Note',
      titleIsGuess: false,
      text,
      source: 'shared',
      hint: share.description,
    },
  ];
}
