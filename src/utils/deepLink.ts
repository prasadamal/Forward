export interface ShareLink {
  text: string;
  mode: 'auto' | 'picker';
}

export const SHARE_LINK_PREFIX = 'forward://share';

export function isShareLink(url: string | null | undefined): url is string {
  return !!url && url.startsWith(SHARE_LINK_PREFIX);
}

/**
 * Parse a `forward://share?text=<encoded>&mode=auto|picker` deep link.
 *
 * Returns null when the URL is not a share link or carries no text.
 * `URLSearchParams` already percent-decodes values, so the text must NOT be
 * decoded a second time (that would mangle literal "%xx" sequences in the
 * shared text and throw on a lone "%").
 */
export function parseShareLink(url: string): ShareLink | null {
  if (!isShareLink(url)) return null;
  const query = url.slice(SHARE_LINK_PREFIX.length).replace(/^\/?\?/, '');
  const params = new URLSearchParams(query);
  const text = params.get('text') ?? '';
  if (!text.trim()) return null;
  return { text, mode: params.get('mode') === 'auto' ? 'auto' : 'picker' };
}
