import {
  extractTags,
  extractUrl,
  detectPlatform,
  extractTitle,
  assignEmoji,
  getFolderColor,
} from '../utils/smartOrganizer';

describe('extractUrl', () => {
  it('returns undefined for plain text', () => {
    expect(extractUrl('hello world')).toBeUndefined();
  });

  it('extracts an http URL', () => {
    expect(extractUrl('check out https://example.com')).toBe('https://example.com');
  });

  it('extracts a URL from mixed text', () => {
    expect(extractUrl('Great video https://youtu.be/abc123 watch it')).toBe('https://youtu.be/abc123');
  });

  it('strips trailing punctuation from URL', () => {
    expect(extractUrl('See https://example.com.')).toBe('https://example.com');
    expect(extractUrl('See https://example.com,')).toBe('https://example.com');
    expect(extractUrl('(https://example.com)')).toBe('https://example.com');
  });

  it('returns only the first URL if multiple are present', () => {
    expect(extractUrl('https://first.com and https://second.com')).toBe('https://first.com');
  });

  it('returns undefined for non-URL input', () => {
    expect(extractUrl('no link here')).toBeUndefined();
    expect(extractUrl('')).toBeUndefined();
  });
});

describe('detectPlatform', () => {
  it('detects YouTube', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBe('youtube');
    expect(detectPlatform('https://youtu.be/abc')).toBe('youtube');
  });

  it('detects Instagram', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc')).toBe('instagram');
  });

  it('detects Twitter/X', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBe('twitter');
    expect(detectPlatform('https://x.com/user/status/123')).toBe('twitter');
  });

  it('detects Reddit', () => {
    expect(detectPlatform('https://www.reddit.com/r/reactnative')).toBe('reddit');
  });

  it('detects generic web', () => {
    expect(detectPlatform('https://example.com')).toBe('web');
    expect(detectPlatform('http://blog.example.org/post')).toBe('web');
  });

  it('returns manual for non-http strings', () => {
    expect(detectPlatform('some plain text')).toBe('manual');
  });
});

describe('extractTitle', () => {
  it('returns the text without the URL when text accompanies a URL', () => {
    const result = extractTitle('Check this out https://example.com', 'web');
    expect(result).toBe('Check this out');
  });

  it('falls back to platform label when only URL is given', () => {
    expect(extractTitle('https://youtu.be/abc', 'youtube')).toBe('YouTube Video');
    expect(extractTitle('https://www.instagram.com/p/abc', 'instagram')).toBe('Instagram Post');
    expect(extractTitle('https://twitter.com/u/1', 'twitter')).toBe('Twitter/X Post');
    expect(extractTitle('https://reddit.com/r/t', 'reddit')).toBe('Reddit Post');
  });

  it('truncates long text to 60 characters', () => {
    const long = 'A'.repeat(80);
    expect(extractTitle(long, 'manual').length).toBeLessThanOrEqual(60);
  });

  it('returns "Note" when content is only whitespace', () => {
    expect(extractTitle('   ', 'manual')).toBe('Note');
  });

  it('returns the URL (up to 50 chars) when no text and no specific platform match', () => {
    const url = 'https://example.com/path';
    const result = extractTitle(url, 'web');
    expect(result).toContain('example.com');
  });
});

describe('extractTags', () => {
  it('detects location tags', () => {
    const { tags, folders } = extractTags('Great food in Bangalore');
    expect(tags).toContain('bangalore');
    expect(folders).toContain('Bangalore');
  });

  it('detects topic tags', () => {
    const { tags, folders } = extractTags('Best pizza restaurant ever');
    expect(folders).toContain('Food');
    expect(tags.length).toBeGreaterThan(0);
  });

  it('returns empty arrays for unrecognized content', () => {
    const { tags, folders } = extractTags('zyxwvutsrqponmlkjihgfedcba');
    expect(tags).toHaveLength(0);
    expect(folders).toHaveLength(0);
  });

  it('limits tags to 10 items', () => {
    // Force many keywords by using a long string
    const text = 'food restaurant cafe eat dining cuisine recipe pizza sushi burger pasta curry bar pub brewery brunch lunch dinner';
    const { tags } = extractTags(text);
    expect(tags.length).toBeLessThanOrEqual(10);
  });

  it('does not duplicate folders', () => {
    const { folders } = extractTags('Bangalore bengaluru food restaurant');
    const uniqueFolders = new Set(folders);
    expect(folders.length).toBe(uniqueFolders.size);
  });
});

describe('assignEmoji', () => {
  it('returns correct emoji for known topics', () => {
    expect(assignEmoji('Food')).toBe('🍽️');
    expect(assignEmoji('Travel')).toBe('✈️');
    expect(assignEmoji('Learning')).toBe('📚');
  });

  it('returns location emoji for known cities (lowercase)', () => {
    expect(assignEmoji('goa')).toBe('🏖️');
    expect(assignEmoji('paris')).toBe('🗼');
  });

  it('returns a default emoji for unknown names', () => {
    expect(assignEmoji('SomeRandomFolder')).toBe('📍');
  });
});

describe('getFolderColor', () => {
  it('returns a hex color string', () => {
    const color = getFolderColor('Food');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('returns a consistent color for the same name', () => {
    expect(getFolderColor('Travel')).toBe(getFolderColor('Travel'));
  });

  it('returns different colors for different names', () => {
    const colors = new Set(['Food', 'Travel', 'Work', 'Health', 'Finance', 'Learning', 'Shopping', 'Entertainment'].map(getFolderColor));
    // Should have at least 2 distinct colors among 8 different names
    expect(colors.size).toBeGreaterThan(1);
  });
});
