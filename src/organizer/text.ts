/**
 * Text normalisation for on-device matching.
 *
 * Text is lowercased, accents are stripped and every run of punctuation or
 * whitespace becomes a single space. The result is padded with spaces so a
 * phrase can be matched on word boundaries with a plain `includes`:
 *   " best street food in bangalore " includes " street food " → true
 *   " great idea " includes " eat " → false
 */

// Keep ASCII letters/digits plus letters from other scripts (Latin-extended,
// Indic, CJK, Hangul…). Everything else — punctuation, '#', '_', symbols and
// emoji — separates words.
const SEPARATORS = /[^0-9a-zÀ-῿぀-鿿가-힯]+/g;

function stripAccents(s: string): string {
  try {
    return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  } catch {
    return s;
  }
}

/** Lowercased, accent-free, single-spaced, padded with one space on each side. */
export function normalizeText(s: string | undefined | null): string {
  if (!s) return ' ';
  const words = stripAccents(s.toLowerCase()).replace(SEPARATORS, ' ').trim();
  return ` ${words} `;
}

/** Normalised phrase without padding (used for keywords and folder names). */
export function normalizePhrase(s: string): string {
  return normalizeText(s).trim();
}

export function containsPhrase(paddedText: string, phrase: string): boolean {
  if (!phrase) return false;
  return paddedText.includes(` ${phrase} `);
}

/** Index of a phrase in padded text, or -1. */
export function indexOfPhrase(paddedText: string, phrase: string): number {
  if (!phrase) return -1;
  return paddedText.indexOf(` ${phrase} `);
}

const HASHTAG = /#([0-9A-Za-z_À-ɏऀ-෿]+)/g;

/** Hashtags without the '#', lowercased, in order, unique. */
export function extractHashtags(s: string | undefined | null): string[] {
  if (!s) return [];
  const out: string[] = [];
  let m: RegExpExecArray | null;
  HASHTAG.lastIndex = 0;
  while ((m = HASHTAG.exec(s)) !== null) {
    const tag = stripAccents(m[1].toLowerCase());
    if (tag.length > 1 && !/^[0-9]+$/.test(tag) && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/** Simple English plural forms so "cafe" also matches "cafes" and "city" matches "cities". */
export function phraseVariants(phrase: string): string[] {
  const variants = [phrase];
  const parts = phrase.split(' ');
  const last = parts[parts.length - 1];
  if (last.length < 3 || /[^a-z]/.test(last)) return variants;
  const head = parts.slice(0, -1);
  const join = (w: string) => [...head, w].join(' ');
  if (/(s|x|z|ch|sh)$/.test(last)) {
    variants.push(join(last + 'es'));
  } else if (/[^aeiou]y$/.test(last)) {
    variants.push(join(last.slice(0, -1) + 'ies'));
  } else {
    variants.push(join(last + 's'));
  }
  return variants;
}

/** Trim and collapse whitespace; cut to `max` characters on a word boundary. */
export function tidy(s: string | undefined | null, max = 200): string {
  if (!s) return '';
  const clean = s.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim() + '…';
}

/** First non-empty line of a text, tidied. */
export function firstLine(s: string | undefined | null, max = 80): string {
  if (!s) return '';
  const line = s.split(/\r?\n/).map(l => l.trim()).find(Boolean) ?? '';
  return tidy(line, max);
}
