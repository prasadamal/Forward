import { Source } from '../types';

/**
 * URL helpers that work without the WHATWG `URL` class. React Native's built-in
 * URL polyfill does not implement `hostname`/`pathname`, so we parse by hand.
 */

export interface ParsedUrl {
  protocol: string;
  host: string;
  port?: string;
  path: string;
  query: [string, string][];
  hash: string;
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const URL_PARTS = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/?#\s]*@)?([^/?#:\s]+)(?::(\d+))?([^?#\s]*)(?:\?([^#\s]*))?(?:#(\S*))?$/i;

function stripTrailingPunctuation(url: string): string {
  let out = url.replace(/[.,;:!?'"*]+$/, '');
  // Drop unbalanced closing brackets, e.g. "(see https://a.com/x)".
  const pairs: [string, string][] = [['(', ')'], ['[', ']'], ['{', '}'], ['<', '>']];
  let changed = true;
  while (changed) {
    changed = false;
    for (const [open, close] of pairs) {
      if (out.endsWith(close) && count(out, open) < count(out, close)) {
        out = out.slice(0, -1).replace(/[.,;:!?'"*]+$/, '');
        changed = true;
      }
    }
  }
  return out;
}

function count(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

/** All http(s) URLs in a piece of text, in order, without duplicates. */
export function extractUrls(text: string | undefined | null): string[] {
  if (!text) return [];
  const found = text.match(URL_IN_TEXT) ?? [];
  const out: string[] = [];
  for (const raw of found) {
    const url = stripTrailingPunctuation(raw);
    if (parseUrl(url) && !out.includes(url)) out.push(url);
  }
  return out;
}

export function extractUrl(text: string | undefined | null): string | undefined {
  return extractUrls(text)[0];
}

export function parseUrl(url: string): ParsedUrl | null {
  const m = URL_PARTS.exec(url.trim());
  if (!m) return null;
  const host = m[2].toLowerCase();
  if (!host.includes('.') && host !== 'localhost') return null;
  const query: [string, string][] = [];
  if (m[5]) {
    for (const part of m[5].split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      query.push(eq === -1 ? [part, ''] : [part.slice(0, eq), part.slice(eq + 1)]);
    }
  }
  return {
    protocol: m[1].toLowerCase(),
    host,
    port: m[3],
    path: m[4] || '/',
    query,
    hash: m[6] ?? '',
  };
}

export function formatUrl(p: ParsedUrl): string {
  const port = p.port ? `:${p.port}` : '';
  const query = p.query.length
    ? '?' + p.query.map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join('&')
    : '';
  const hash = p.hash ? `#${p.hash}` : '';
  return `${p.protocol}://${p.host}${port}${p.path}${query}${hash}`;
}

/** Host without a leading "www." (or "m."), lowercased. Empty string when invalid. */
export function hostOf(url: string): string {
  const p = parseUrl(url);
  if (!p) return '';
  return p.host.replace(/^(www|m|mobile)\./, '');
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}

export function matchesDomain(url: string, domains: readonly string[]): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return domains.some(d => {
    if (d.includes('/')) {
      // Domain plus path prefix, e.g. "google.com/maps".
      const [dHost, ...rest] = d.split('/');
      const p = parseUrl(url);
      return !!p && hostMatches(host, dHost) && p.path.startsWith('/' + rest.join('/'));
    }
    return hostMatches(host, d);
  });
}

const SOURCE_DOMAINS: [Source, string[]][] = [
  ['youtube', ['youtube.com', 'youtu.be', 'youtube-nocookie.com']],
  ['instagram', ['instagram.com', 'instagr.am']],
  ['x', ['x.com', 'twitter.com', 't.co']],
  ['reddit', ['reddit.com', 'redd.it']],
  ['facebook', ['facebook.com', 'fb.watch', 'fb.com', 'fb.me']],
  ['linkedin', ['linkedin.com', 'lnkd.in']],
  ['threads', ['threads.net', 'threads.com']],
  ['pinterest', ['pinterest.com', 'pinterest.co.uk', 'pinterest.ca', 'pin.it']],
  ['spotify', ['spotify.com', 'spotify.link']],
  [
    'maps',
    [
      'maps.google.com',
      'maps.app.goo.gl',
      'goo.gl/maps',
      'google.com/maps',
      'google.co.in/maps',
      'maps.apple.com',
      'maps.apple',
    ],
  ],
  ['whatsapp', ['wa.me', 'whatsapp.com']],
  ['telegram', ['t.me', 'telegram.me']],
];

export function detectSource(url: string | undefined): Source {
  if (!url) return 'manual';
  if (!parseUrl(url)) return 'manual';
  for (const [source, domains] of SOURCE_DOMAINS) {
    if (matchesDomain(url, domains)) return source;
  }
  return 'web';
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function youTubeId(url: string): string | undefined {
  const p = parseUrl(url);
  if (!p) return undefined;
  const host = p.host.replace(/^(www|m|music)\./, '');
  if (host === 'youtu.be') {
    const id = p.path.split('/')[1];
    return id && YT_ID.test(id) ? id : undefined;
  }
  if (!hostMatches(host, 'youtube.com') && !hostMatches(host, 'youtube-nocookie.com')) return undefined;
  const v = p.query.find(([k]) => k === 'v')?.[1];
  if (v && YT_ID.test(v)) return v;
  const m = /^\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{11})/.exec(p.path);
  return m ? m[1] : undefined;
}

/** Instagram post/reel shortcode, if any. */
export function instagramCode(url: string): string | undefined {
  const p = parseUrl(url);
  if (!p || !hostMatches(p.host, 'instagram.com')) return undefined;
  const m = /^\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/.exec(p.path);
  return m ? m[1] : undefined;
}

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'igsh',
  'igshid',
  'si',
  'feature',
  'pp',
  'ref',
  'ref_src',
  'ref_url',
  'mibextid',
  'rdt',
  'share_id',
  'utm_id',
  '_branch_match_id',
  '_branch_referrer',
  'app',
]);

/**
 * Canonical form used to detect duplicates: https, no "www.", no tracking
 * parameters, no fragment, no trailing slash, sorted query.
 */
export function normalizeUrl(url: string): string {
  const p = parseUrl(url);
  if (!p) return url.trim();
  let host = p.host.replace(/^(www|m|mobile)\./, '');
  let path = p.path.replace(/\/+$/, '') || '/';
  let query = p.query.filter(([k]) => {
    const key = k.toLowerCase();
    return !key.startsWith('utm_') && !TRACKING_PARAMS.has(key);
  });

  const ytId = youTubeId(url);
  if (ytId) {
    const isShort = /^\/shorts\//.test(p.path);
    host = 'youtube.com';
    path = isShort ? `/shorts/${ytId}` : '/watch';
    query = isShort ? [] : [['v', ytId]];
  } else if (host === 'twitter.com' || host === 'x.com') {
    host = 'x.com';
    query = query.filter(([k]) => k !== 's' && k !== 't');
  } else if (hostMatches(host, 'instagram.com')) {
    path = path.replace(/^\/reels\//, '/reel/');
    query = [];
  }

  query.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return formatUrl({ protocol: 'https', host, port: p.port, path, query, hash: '' });
}

/** Words from the URL path, useful for classification (e.g. zomato.com/bangalore/truffles). */
export function urlPathWords(url: string | undefined): string[] {
  if (!url) return [];
  const p = parseUrl(url);
  if (!p) return [];
  let path = p.path;
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep raw path
  }
  return path
    .split(/[/\-_.+,%]+/)
    .map(w => w.toLowerCase())
    .filter(w => w.length > 1 && !/^[0-9]+$/.test(w) && !looksLikeId(w));
}

function looksLikeId(word: string): boolean {
  // Random-looking tokens (IDs, hashes): long and mixing digits with letters.
  return word.length >= 8 && /\d/.test(word) && /[a-z]/i.test(word);
}

/** Short host for display: "youtube.com". */
export function displayHost(url: string | undefined): string {
  if (!url) return '';
  return hostOf(url) || url.slice(0, 40);
}

/** Place name embedded in a Google Maps URL, e.g. /maps/place/Cubbon+Park/… */
export function mapsPlaceName(url: string): string | undefined {
  const p = parseUrl(url);
  if (!p) return undefined;
  const m = /\/maps\/place\/([^/]+)/.exec(p.path);
  if (!m) return undefined;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim() || undefined;
  } catch {
    return m[1].replace(/\+/g, ' ');
  }
}
