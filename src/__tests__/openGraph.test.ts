// Tests for openGraph.ts HTML parsing helpers.
// We test the exported fetchOpenGraph with a mocked fetch, and also test
// the decode/extract logic indirectly through fetchOpenGraph.

import { fetchOpenGraph } from '../utils/openGraph';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function makeHtml(overrides: Record<string, string> = {}): string {
  const {
    ogTitle = 'OG Title',
    ogDesc = 'OG Description',
    ogSite = 'Example Site',
    twitterTitle = '',
    pageTitle = 'Page Title',
  } = overrides;

  return `<!DOCTYPE html>
<html>
<head>
  <title>${pageTitle}</title>
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:site_name" content="${ogSite}" />
  ${twitterTitle ? `<meta name="twitter:title" content="${twitterTitle}" />` : ''}
</head>
<body></body>
</html>`;
}

describe('fetchOpenGraph', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns og:title and og:description from well-formed HTML', async () => {
    mockFetch.mockResolvedValueOnce({
      text: async () => makeHtml({ ogTitle: 'Hello World', ogDesc: 'A test page' }),
    });

    const result = await fetchOpenGraph('https://example.com');
    expect(result.title).toBe('Hello World');
    expect(result.description).toBe('A test page');
    expect(result.siteName).toBe('Example Site');
  });

  it('falls back to twitter:title when og:title is missing', async () => {
    const html = `<html><head>
      <meta name="twitter:title" content="Twitter Title" />
    </head></html>`;
    mockFetch.mockResolvedValueOnce({ text: async () => html });

    const result = await fetchOpenGraph('https://example.com');
    expect(result.title).toBe('Twitter Title');
  });

  it('falls back to <title> tag when og and twitter titles are missing', async () => {
    const html = `<html><head><title>Page Title Only</title></head></html>`;
    mockFetch.mockResolvedValueOnce({ text: async () => html });

    const result = await fetchOpenGraph('https://example.com');
    expect(result.title).toBe('Page Title Only');
  });

  it('returns an empty object when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchOpenGraph('https://example.com');
    expect(result).toEqual({});
  });

  it('returns an empty object for non-http/https URLs', async () => {
    const result = await fetchOpenGraph('ftp://example.com');
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns an empty object for invalid URLs', async () => {
    const result = await fetchOpenGraph('not-a-url');
    expect(result).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('decodes HTML entities in title', async () => {
    const html = `<html><head>
      <meta property="og:title" content="It&#39;s &amp; It&apos;s &lt;great&gt;" />
    </head></html>`;
    mockFetch.mockResolvedValueOnce({ text: async () => html });

    const result = await fetchOpenGraph('https://example.com');
    expect(result.title).toBe("It's & It's <great>");
  });

  it('decodes numeric HTML entities in title', async () => {
    const html = `<html><head>
      <meta property="og:title" content="&#8220;Quoted&#8221;" />
    </head></html>`;
    mockFetch.mockResolvedValueOnce({ text: async () => html });

    const result = await fetchOpenGraph('https://example.com');
    expect(result.title).toBe('\u201CQuoted\u201D');
  });
});
