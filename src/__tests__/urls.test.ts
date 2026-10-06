import {
  detectSource,
  displayHost,
  extractUrl,
  extractUrls,
  hostOf,
  instagramCode,
  mapsPlaceName,
  matchesDomain,
  normalizeUrl,
  parseUrl,
  urlPathWords,
  youTubeId,
} from '../ingest/urls';

describe('extractUrls', () => {
  it('finds URLs in text and strips trailing punctuation', () => {
    expect(extractUrl('check out https://example.com.')).toBe('https://example.com');
    expect(extractUrl('(see https://example.com/a)')).toBe('https://example.com/a');
    expect(extractUrl('wiki https://en.wikipedia.org/wiki/Foo_(bar) ok')).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
  });

  it('returns all unique URLs in order', () => {
    expect(extractUrls('a https://a.com b https://b.com/x c https://a.com')).toEqual([
      'https://a.com',
      'https://b.com/x',
    ]);
  });

  it('returns nothing for plain text', () => {
    expect(extractUrls('no links here')).toEqual([]);
    expect(extractUrl(undefined)).toBeUndefined();
  });
});

describe('parseUrl / hostOf', () => {
  it('parses the parts of a URL', () => {
    const p = parseUrl('https://user@www.Example.com:8080/a/b?x=1&y=2#frag');
    expect(p).toEqual({
      protocol: 'https',
      host: 'www.example.com',
      port: '8080',
      path: '/a/b',
      query: [
        ['x', '1'],
        ['y', '2'],
      ],
      hash: 'frag',
    });
  });

  it('rejects things that are not URLs', () => {
    expect(parseUrl('hello')).toBeNull();
    expect(parseUrl('https://nodot')).toBeNull();
  });

  it('strips www/m prefixes from hosts', () => {
    expect(hostOf('https://m.youtube.com/watch?v=x')).toBe('youtube.com');
    expect(displayHost('https://www.zomato.com/bangalore')).toBe('zomato.com');
  });
});

describe('detectSource', () => {
  it.each([
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube'],
    ['https://www.instagram.com/reel/C9xYz12AbCd/?igsh=abc', 'instagram'],
    ['https://x.com/user/status/1', 'x'],
    ['https://twitter.com/user/status/1', 'x'],
    ['https://www.reddit.com/r/bangalore/comments/abc', 'reddit'],
    ['https://maps.app.goo.gl/AbCdEf', 'maps'],
    ['https://www.google.com/maps/place/Cubbon+Park', 'maps'],
    ['https://open.spotify.com/track/123', 'spotify'],
    ['https://www.linkedin.com/posts/abc', 'linkedin'],
    ['https://example.com', 'web'],
  ])('%s → %s', (url, source) => {
    expect(detectSource(url)).toBe(source);
  });

  it('treats non-URLs as manual', () => {
    expect(detectSource(undefined)).toBe('manual');
    expect(detectSource('nope')).toBe('manual');
  });
});

describe('matchesDomain', () => {
  it('matches subdomains and path-scoped domains', () => {
    expect(matchesDomain('https://in.bookmyshow.com/x', ['bookmyshow.com'])).toBe(true);
    expect(matchesDomain('https://google.com/maps/place/x', ['google.com/maps'])).toBe(true);
    expect(matchesDomain('https://google.com/search?q=x', ['google.com/maps'])).toBe(false);
    expect(matchesDomain('https://notbookmyshow.com/x', ['bookmyshow.com'])).toBe(false);
  });
});

describe('youTubeId / instagramCode', () => {
  it('extracts YouTube ids from every URL shape', () => {
    expect(youTubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
    expect(youTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42')).toBe('dQw4w9WgXcQ');
    expect(youTubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youTubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeUndefined();
  });

  it('extracts Instagram shortcodes', () => {
    expect(instagramCode('https://www.instagram.com/reel/C9xYz12AbCd/?igsh=x')).toBe('C9xYz12AbCd');
    expect(instagramCode('https://www.instagram.com/p/ABC_123/')).toBe('ABC_123');
    expect(instagramCode('https://www.instagram.com/someuser/')).toBeUndefined();
  });
});

describe('normalizeUrl', () => {
  it('collapses YouTube URL variants', () => {
    const a = normalizeUrl('https://youtu.be/dQw4w9WgXcQ?si=tracking');
    const b = normalizeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=shared&t=10');
    expect(a).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ');
    expect(b).toBe(a);
  });

  it('removes tracking parameters and fragments', () => {
    expect(normalizeUrl('https://www.example.com/a/?utm_source=x&id=5&fbclid=y#top')).toBe('https://example.com/a?id=5');
    expect(normalizeUrl('https://www.instagram.com/reels/ABC/?igsh=z')).toBe('https://instagram.com/reel/ABC');
    expect(normalizeUrl('https://twitter.com/u/status/1?s=20&t=abc')).toBe('https://x.com/u/status/1');
  });

  it('sorts query parameters for stable comparison', () => {
    expect(normalizeUrl('https://a.com/?b=2&a=1')).toBe(normalizeUrl('https://a.com?a=1&b=2'));
  });
});

describe('urlPathWords / mapsPlaceName', () => {
  it('splits paths into words and drops ids', () => {
    expect(urlPathWords('https://www.zomato.com/bangalore/truffles-koramangala-5th-block/info')).toEqual([
      'bangalore',
      'truffles',
      'koramangala',
      '5th',
      'block',
      'info',
    ]);
    expect(urlPathWords('https://x.com/user/status/1834567890123')).toEqual(['user', 'status']);
  });

  it('reads place names from Google Maps links', () => {
    expect(mapsPlaceName('https://www.google.com/maps/place/Cubbon+Park/@12.97,77.59,17z')).toBe('Cubbon Park');
    expect(mapsPlaceName('https://example.com/place/x')).toBeUndefined();
  });
});
