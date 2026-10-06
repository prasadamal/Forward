import { IncomingFile, IncomingShare } from '../types';

/**
 * Converts the raw payload emitted by the native share module (expo-share-intent)
 * into an `IncomingShare`. iOS sends a JSON string, Android sends an object.
 * Parsing is defensive: unknown shapes yield `null` instead of throwing.
 */

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseMaybeJson(v: unknown): Raw | null {
  if (v && typeof v === 'object') return v as Raw;
  if (typeof v !== 'string') return null;
  try {
    const parsed = JSON.parse(v);
    return parsed && typeof parsed === 'object' ? (parsed as Raw) : null;
  } catch {
    return null;
  }
}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  '3gp': 'video/3gpp',
  webm: 'video/webm',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  pkpass: 'application/vnd.apple.pkpass',
  vcf: 'text/vcard',
};

export function mimeFromName(name: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return (ext && EXT_MIME[ext]) || 'application/octet-stream';
}

export function baseName(uri: string): string {
  const clean = uri.split('?')[0];
  const last = clean.split('/').filter(Boolean).pop() ?? 'file';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function toFileUri(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return `file://${path.startsWith('/') ? '' : '/'}${path}`;
}

function parseFile(raw: unknown): IncomingFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Raw;
  const path = str(f.path) ?? str(f.filePath) ?? str(f.contentUri);
  if (!path) return null;
  const uri = toFileUri(path);
  const name = str(f.fileName) ?? baseName(uri);
  const mime = str(f.mimeType);
  return {
    uri,
    name,
    mimeType: mime && mime !== '*/*' ? mime : mimeFromName(name),
    size: num(f.fileSize) ?? num(f.size),
    width: num(f.width),
    height: num(f.height),
  };
}

export function parseNativeShare(value: unknown, id: string, now: number = Date.now()): IncomingShare | null {
  const raw = parseMaybeJson(value);
  if (!raw) return null;

  const meta = parseMaybeJson(raw.meta) ?? {};
  let text = str(raw.text);
  let subject = str(meta.subject) ?? str(meta.title);
  let description: string | undefined;

  // iOS web page shares: [{ url, meta: "<json>" }]
  if (Array.isArray(raw.weburls) && raw.weburls.length) {
    const first = raw.weburls[0] as Raw;
    const pageMeta = parseMaybeJson(first?.meta) ?? {};
    text = str(first?.url) ?? text;
    subject = subject ?? str(pageMeta.title) ?? str(pageMeta['og:title']);
    description = str(pageMeta['og:description']) ?? str(pageMeta.description);
  }

  const files = (Array.isArray(raw.files) ? raw.files : [])
    .map(parseFile)
    .filter((f): f is IncomingFile => f !== null);

  if (!text && !files.length) return null;
  return {
    id,
    receivedAt: now,
    text: text?.trim(),
    subject: subject?.trim(),
    description: description?.trim(),
    files,
  };
}

/** Same content shared twice within a few seconds is delivered once. */
export function shareSignature(share: IncomingShare): string {
  return [share.text ?? '', share.subject ?? '', ...share.files.map(f => `${f.name}:${f.size ?? ''}`)].join('|');
}
