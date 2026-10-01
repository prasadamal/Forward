import { isShareLink, parseShareLink } from '../utils/deepLink';

describe('isShareLink', () => {
  it('accepts forward://share URLs', () => {
    expect(isShareLink('forward://share?text=hi')).toBe(true);
  });

  it('rejects other URLs, null and undefined', () => {
    expect(isShareLink('https://example.com')).toBe(false);
    expect(isShareLink('forward://other')).toBe(false);
    expect(isShareLink(null)).toBe(false);
    expect(isShareLink(undefined)).toBe(false);
  });
});

describe('parseShareLink', () => {
  it('parses text and defaults to picker mode', () => {
    expect(parseShareLink('forward://share?text=hello%20world')).toEqual({
      text: 'hello world',
      mode: 'picker',
    });
  });

  it('parses auto mode', () => {
    expect(parseShareLink('forward://share?text=hi&mode=auto')?.mode).toBe('auto');
  });

  it('falls back to picker for unknown modes', () => {
    expect(parseShareLink('forward://share?text=hi&mode=weird')?.mode).toBe('picker');
  });

  it('round-trips text produced by Uri.encode on Android (URL with query string)', () => {
    const shared = 'Best pizza https://example.com/a?b=1&c=2#frag';
    const link = `forward://share?text=${encodeURIComponent(shared)}&mode=auto`;
    expect(parseShareLink(link)).toEqual({ text: shared, mode: 'auto' });
  });

  it('does not double-decode literal percent sequences', () => {
    const shared = '100% sure, 50%25 off';
    const link = `forward://share?text=${encodeURIComponent(shared)}`;
    expect(parseShareLink(link)?.text).toBe(shared);
  });

  it('keeps a literal plus sign (encoded as %2B)', () => {
    const link = `forward://share?text=${encodeURIComponent('C++ tips')}`;
    expect(parseShareLink(link)?.text).toBe('C++ tips');
  });

  it('accepts the forward://share/?text= form', () => {
    expect(parseShareLink('forward://share/?text=hi')?.text).toBe('hi');
  });

  it('returns null when there is no text', () => {
    expect(parseShareLink('forward://share')).toBeNull();
    expect(parseShareLink('forward://share?text=')).toBeNull();
    expect(parseShareLink('forward://share?text=%20%20')).toBeNull();
  });

  it('returns null for non-share URLs', () => {
    expect(parseShareLink('https://example.com?text=hi')).toBeNull();
  });
});
