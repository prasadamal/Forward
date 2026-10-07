import { decodeHtmlEntities, fetchLinkPreview, metaContent, parseHtmlPreview } from '../ingest/linkPreview';

type FakeResponse = { ok: boolean; url?: string; headers?: { get: (k: string) => string | null }; json?: () => Promise<unknown>; text?: () => Promise<string> };

function htmlResponse(html: string, url?: string): FakeResponse {
  return { ok: true, url, headers: { get: () => 'text/html; charset=utf-8' }, text: async () => html };
}

function jsonResponse(data: unknown): FakeResponse {
  return { ok: true, headers: { get: () => 'application/json' }, json: async () => data };
}

function fakeFetch(routes: Record<string, FakeResponse | Error>) {
  return jest.fn(async (url: string) => {
    for (const [prefix, res] of Object.entries(routes)) {
      if (url.startsWith(prefix)) {
        if (res instanceof Error) throw res;
        return res;
      }
    }
    return { ok: false } as FakeResponse;
  }) as unknown as typeof fetch;
}

describe('HTML parsing', () => {
  it('reads meta tags in either attribute order and quoting style', () => {
    const html = `<meta property="og:title" content="A &amp; B"><meta content='Desc' name='description'>`;
    expect(metaContent(html, 'og:title')).toBe('A & B');
    expect(metaContent(html, 'description')).toBe('Desc');
    expect(metaContent(html, 'og:image')).toBeUndefined();
  });

  it('falls back from og to twitter to <title>', () => {
    expect(parseHtmlPreview('<title> Page </title><meta name="twitter:title" content="TW">').title).toBe('TW');
    expect(parseHtmlPreview('<title> Page </title>').title).toBe('Page');
  });

  it('resolves relative image URLs', () => {
    const p = parseHtmlPreview('<meta property="og:image" content="/img/a.jpg">', 'https://site.com/post/1');
    expect(p.imageUrl).toBe('https://site.com/img/a.jpg');
  });

  it('decodes entities without double-decoding', () => {
    expect(decodeHtmlEntities('&amp;lt; &#8217; &#x1F600; &hellip;')).toBe('&lt; ’ 😀 …');
  });
});

describe('fetchLinkPreview', () => {
  it('uses YouTube oEmbed and the thumbnail CDN', async () => {
    const fetchFn = fakeFetch({
      'https://www.youtube.com/oembed': jsonResponse({ title: 'Bangalore Food Tour', author_name: 'Food Ranger' }),
    });
    const p = await fetchLinkPreview('https://youtu.be/dQw4w9WgXcQ', { fetchFn });
    expect(p).toEqual({
      siteName: 'YouTube',
      title: 'Bangalore Food Tour',
      author: 'Food Ranger',
      imageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    });
  });

  it('reads post text from X oEmbed', async () => {
    const fetchFn = fakeFetch({
      'https://publish.twitter.com/oembed': jsonResponse({
        author_name: 'Someone',
        html: '<blockquote><p lang="en">New app for BMTC buses in Bangalore<br>Try it!</p>&mdash; Someone</blockquote>',
      }),
    });
    const p = await fetchLinkPreview('https://x.com/someone/status/1', { fetchFn });
    expect(p.title).toBe('New app for BMTC buses in Bangalore');
    expect(p.description).toBe('New app for BMTC buses in Bangalore\nTry it!');
    expect(p.author).toBe('Someone');
  });

  it('falls back to the Instagram embed caption behind a login wall', async () => {
    const fetchFn = fakeFetch({
      'https://www.instagram.com/p/ABC/embed': htmlResponse(
        '<div class="Caption"><a class="CaptionUsername" href="#">wanderer</a> Hidden lake near Bengaluru 🌅<br>#bangaloretrips<div class="CaptionComments"></div></div>',
      ),
      'https://www.instagram.com/reel/ABC': htmlResponse('<title>Instagram</title>'),
    });
    const p = await fetchLinkPreview('https://www.instagram.com/reel/ABC/', { fetchFn });
    expect(p.title).toBe('Hidden lake near Bengaluru 🌅');
    expect(p.author).toBe('wanderer');
    expect(p.description).toContain('#bangaloretrips');
  });

  it('follows Google Maps short links to the place name', async () => {
    const fetchFn = fakeFetch({
      'https://maps.app.goo.gl/': htmlResponse('<title>Google Maps</title>', 'https://www.google.com/maps/place/Cubbon+Park/@12.9,77.5'),
    });
    const p = await fetchLinkPreview('https://maps.app.goo.gl/AbCd', { fetchFn });
    expect(p.title).toBe('Cubbon Park');
    expect(p.finalUrl).toBe('https://www.google.com/maps/place/Cubbon+Park/@12.9,77.5');
  });

  it('returns an empty preview when offline', async () => {
    const fetchFn = fakeFetch({ 'https://': new Error('Network request failed') });
    await expect(fetchLinkPreview('https://example.com', { fetchFn })).resolves.toEqual({});
  });

  it('drops useless titles', async () => {
    const fetchFn = fakeFetch({ 'https://example.com': htmlResponse('<title>Log in</title>') });
    const p = await fetchLinkPreview('https://example.com', { fetchFn });
    expect(p.title).toBeUndefined();
  });
});
