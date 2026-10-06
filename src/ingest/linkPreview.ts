import { detectSource, instagramCode, mapsPlaceName, youTubeId } from './urls';

/**
 * Best-effort link previews. Forward only ever contacts the site the link
 * points to (or that platform's public, key-less oEmbed endpoint). There is no
 * Forward server and no third-party preview API. Everything here may fail
 * (offline, login walls, rate limits) and callers must treat the result as
 * optional.
 */

export interface LinkPreview {
  title?: string;
  description?: string;
  siteName?: string;
  author?: string;
  imageUrl?: string;
  /** URL after redirects (e.g. maps.app.goo.gl → google.com/maps/place/…). */
  finalUrl?: string;
}

type FetchFn = typeof fetch;

export interface PreviewOptions {
  timeoutMs?: number;
  fetchFn?: FetchFn;
}

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 Forward/2.0';
const MAX_HTML_CHARS = 400_000;

async function fetchWithTimeout(
  fetchFn: FetchFn,
  url: string,
  timeoutMs: number,
  accept: string,
): Promise<Response | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      signal: controller?.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'en' },
    });
    return res && res.ok !== false ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (m, dec) => {
      const code = parseInt(dec, 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')
    // &amp; last so "&amp;lt;" becomes "&lt;" rather than "<".
    .replace(/&amp;/g, '&');
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Reads <meta property|name="…" content="…"> in either attribute order. */
export function metaContent(html: string, key: string): string | undefined {
  const k = escapeRegExp(key);
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${k}["'][^>]*?content\\s*=\\s*"([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${k}["'][^>]*?content\\s*=\\s*'([^']*)'`, 'i'),
    new RegExp(`<meta[^>]+content\\s*=\\s*"([^"]*)"[^>]*?(?:property|name|itemprop)\\s*=\\s*["']${k}["']`, 'i'),
    new RegExp(`<meta[^>]+content\\s*=\\s*'([^']*)'[^>]*?(?:property|name|itemprop)\\s*=\\s*["']${k}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1].trim()) return decodeHtmlEntities(m[1].trim());
  }
  return undefined;
}

export function parseHtmlPreview(html: string, pageUrl?: string): LinkPreview {
  const head = html.slice(0, MAX_HTML_CHARS);
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1];
  const preview: LinkPreview = {
    title: metaContent(head, 'og:title') ?? metaContent(head, 'twitter:title') ?? (titleTag ? decodeHtmlEntities(titleTag.trim()) : undefined),
    description:
      metaContent(head, 'og:description') ?? metaContent(head, 'twitter:description') ?? metaContent(head, 'description'),
    siteName: metaContent(head, 'og:site_name') ?? metaContent(head, 'application-name'),
    author: metaContent(head, 'author') ?? metaContent(head, 'article:author') ?? metaContent(head, 'twitter:creator'),
    imageUrl: absolutize(metaContent(head, 'og:image') ?? metaContent(head, 'og:image:url') ?? metaContent(head, 'twitter:image'), pageUrl),
  };
  return clean(preview);
}

function absolutize(src: string | undefined, base?: string): string | undefined {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('//')) return `https:${src}`;
  if (!base) return undefined;
  const m = /^(https?:\/\/[^/]+)/i.exec(base);
  if (!m) return undefined;
  return src.startsWith('/') ? m[1] + src : `${m[1]}/${src}`;
}

function clean(p: LinkPreview): LinkPreview {
  const out: LinkPreview = {};
  for (const [k, v] of Object.entries(p) as [keyof LinkPreview, string | undefined][]) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

async function youtubePreview(url: string, fetchFn: FetchFn, timeoutMs: number): Promise<LinkPreview> {
  const id = youTubeId(url);
  const res = await fetchWithTimeout(
    fetchFn,
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    timeoutMs,
    'application/json',
  );
  const out: LinkPreview = { siteName: 'YouTube' };
  if (id) out.imageUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  if (res) {
    try {
      const json = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
      out.title = json.title;
      out.author = json.author_name;
      out.imageUrl = out.imageUrl ?? json.thumbnail_url;
    } catch {
      // ignore malformed JSON
    }
  }
  return clean(out);
}

async function xPreview(url: string, fetchFn: FetchFn, timeoutMs: number): Promise<LinkPreview> {
  const res = await fetchWithTimeout(
    fetchFn,
    `https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${encodeURIComponent(url)}`,
    timeoutMs,
    'application/json',
  );
  if (!res) return {};
  try {
    const json = (await res.json()) as { author_name?: string; html?: string };
    const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(json.html ?? '')?.[1];
    const text = paragraph ? stripTags(paragraph) : undefined;
    return clean({
      title: text ? text.split('\n')[0].slice(0, 120) : json.author_name ? `Post by ${json.author_name}` : undefined,
      description: text,
      author: json.author_name,
      siteName: 'X',
    });
  } catch {
    return {};
  }
}

async function instagramEmbedCaption(url: string, fetchFn: FetchFn, timeoutMs: number): Promise<LinkPreview> {
  const code = instagramCode(url);
  if (!code) return {};
  const res = await fetchWithTimeout(
    fetchFn,
    `https://www.instagram.com/p/${code}/embed/captioned/`,
    timeoutMs,
    'text/html',
  );
  if (!res) return {};
  try {
    const html = (await res.text()).slice(0, MAX_HTML_CHARS);
    const block = /<div[^>]+class="Caption"[^>]*>([\s\S]*?)<div[^>]+class="CaptionComments/i.exec(html)?.[1];
    if (!block) return {};
    const author = /class="CaptionUsername"[^>]*>([^<]+)</i.exec(block)?.[1];
    let caption = stripTags(block);
    if (author && caption.startsWith(author)) caption = caption.slice(author.length).trim();
    return clean({
      title: caption ? caption.split('\n')[0].slice(0, 120) : undefined,
      description: caption,
      author: author ? decodeHtmlEntities(author) : undefined,
      siteName: 'Instagram',
    });
  } catch {
    return {};
  }
}

async function htmlPreview(url: string, fetchFn: FetchFn, timeoutMs: number): Promise<LinkPreview> {
  const res = await fetchWithTimeout(fetchFn, url, timeoutMs, 'text/html,application/xhtml+xml');
  if (!res) return {};
  const contentType = res.headers?.get?.('content-type') ?? '';
  if (contentType && !/html|xml/i.test(contentType)) return { finalUrl: res.url || undefined };
  try {
    const html = await res.text();
    const finalUrl = res.url || url;
    return { ...parseHtmlPreview(html, finalUrl), ...(res.url && res.url !== url ? { finalUrl: res.url } : {}) };
  } catch {
    return {};
  }
}

/** Instagram's generic titles ("Instagram", "Login • Instagram") carry no information. */
function isUselessTitle(title: string | undefined): boolean {
  if (!title) return true;
  return /^(instagram|login\s*•\s*instagram|x|twitter|facebook|log in|sign in)$/i.test(title.trim());
}

export async function fetchLinkPreview(url: string, options: PreviewOptions = {}): Promise<LinkPreview> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 7000;
  const source = detectSource(url);

  try {
    if (source === 'youtube') {
      const yt = await youtubePreview(url, fetchFn, timeoutMs);
      if (yt.title) return yt;
      return { ...yt, ...(await htmlPreview(url, fetchFn, timeoutMs)) };
    }
    if (source === 'x') {
      const x = await xPreview(url, fetchFn, timeoutMs);
      if (x.title) return x;
    }

    const html = await htmlPreview(url, fetchFn, timeoutMs);

    if (source === 'instagram' && (isUselessTitle(html.title) || !html.description)) {
      const embed = await instagramEmbedCaption(url, fetchFn, timeoutMs);
      if (embed.title) return { ...html, ...embed, imageUrl: html.imageUrl ?? embed.imageUrl };
    }

    if (source === 'maps' || (html.finalUrl && detectSource(html.finalUrl) === 'maps')) {
      const name = mapsPlaceName(html.finalUrl ?? url) ?? mapsPlaceName(url);
      if (name && (!html.title || /google maps/i.test(html.title))) {
        return { ...html, title: name, siteName: html.siteName ?? 'Maps' };
      }
    }
    return isUselessTitle(html.title) ? { ...html, title: undefined } : html;
  } catch {
    return {};
  }
}
