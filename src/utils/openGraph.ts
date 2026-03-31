export interface OGMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url?: string;
}

function extractMeta(html: string, property: string): string | undefined {
  // Match og: meta tags (property attribute)
  const propertyMatch = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  ) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i')
  );
  if (propertyMatch) return decodeHtmlEntities(propertyMatch[1]);

  // Match name meta tags
  const nameMatch = html.match(
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  ) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i')
  );
  if (nameMatch) return decodeHtmlEntities(nameMatch[1]);

  return undefined;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : undefined;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export async function fetchOpenGraph(url: string, timeoutMs = 5000): Promise<OGMetadata> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ForwardBot/1.0)',
        Accept: 'text/html',
      },
    });
    clearTimeout(timer);

    const html = await res.text();

    const ogTitle = extractMeta(html, 'og:title');
    const ogDescription = extractMeta(html, 'og:description');
    const ogImage = extractMeta(html, 'og:image');
    const ogSiteName = extractMeta(html, 'og:site_name');
    const ogUrl = extractMeta(html, 'og:url');
    const twitterTitle = extractMeta(html, 'twitter:title');
    const twitterDescription = extractMeta(html, 'twitter:description');
    const twitterImage = extractMeta(html, 'twitter:image');
    const description = extractMeta(html, 'description');
    const pageTitle = extractTitle(html);

    return {
      title: ogTitle || twitterTitle || pageTitle,
      description: ogDescription || twitterDescription || description,
      image: ogImage || twitterImage,
      siteName: ogSiteName,
      url: ogUrl || url,
    };
  } catch {
    return {};
  }
}
