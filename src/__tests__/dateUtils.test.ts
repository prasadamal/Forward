import { formatRelativeDate, formatFullDate } from '../utils/dateUtils';

describe('formatRelativeDate', () => {
  const now = new Date('2024-06-15T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "just now" for timestamps within the last 60 seconds', () => {
    expect(formatRelativeDate(new Date(now.getTime() - 30_000).toISOString())).toBe('just now');
    expect(formatRelativeDate(new Date(now.getTime() - 59_000).toISOString())).toBe('just now');
  });

  it('returns "just now" for timestamps in the future (clock skew)', () => {
    expect(formatRelativeDate(new Date(now.getTime() + 5_000).toISOString())).toBe('just now');
    expect(formatRelativeDate(new Date(now.getTime() + 60_000).toISOString())).toBe('just now');
  });

  it('returns "just now" for invalid ISO strings', () => {
    expect(formatRelativeDate('not-a-date')).toBe('just now');
  });

  it('returns minutes ago for timestamps between 1 and 59 minutes ago', () => {
    expect(formatRelativeDate(new Date(now.getTime() - 60_000).toISOString())).toBe('1m ago');
    expect(formatRelativeDate(new Date(now.getTime() - 30 * 60_000).toISOString())).toBe('30m ago');
    expect(formatRelativeDate(new Date(now.getTime() - 59 * 60_000).toISOString())).toBe('59m ago');
  });

  it('returns hours ago for timestamps between 1 and 23 hours ago', () => {
    expect(formatRelativeDate(new Date(now.getTime() - 3_600_000).toISOString())).toBe('1h ago');
    expect(formatRelativeDate(new Date(now.getTime() - 12 * 3_600_000).toISOString())).toBe('12h ago');
    expect(formatRelativeDate(new Date(now.getTime() - 23 * 3_600_000).toISOString())).toBe('23h ago');
  });

  it('returns "yesterday" for timestamps exactly 1 day ago', () => {
    expect(formatRelativeDate(new Date(now.getTime() - 24 * 3_600_000).toISOString())).toBe('yesterday');
  });

  it('returns days ago for timestamps 2–6 days ago', () => {
    expect(formatRelativeDate(new Date(now.getTime() - 2 * 86_400_000).toISOString())).toBe('2d ago');
    expect(formatRelativeDate(new Date(now.getTime() - 6 * 86_400_000).toISOString())).toBe('6d ago');
  });

  it('returns weeks ago for timestamps 1–3 weeks ago', () => {
    expect(formatRelativeDate(new Date(now.getTime() - 7 * 86_400_000).toISOString())).toBe('1w ago');
    expect(formatRelativeDate(new Date(now.getTime() - 21 * 86_400_000).toISOString())).toBe('3w ago');
  });

  it('returns months ago for timestamps 1–11 months ago', () => {
    expect(formatRelativeDate(new Date(now.getTime() - 31 * 86_400_000).toISOString())).toBe('1mo ago');
    expect(formatRelativeDate(new Date(now.getTime() - 300 * 86_400_000).toISOString())).toBe('10mo ago');
  });

  it('returns a short date for timestamps more than 12 months ago', () => {
    const result = formatRelativeDate(new Date(now.getTime() - 400 * 86_400_000).toISOString());
    // Should be a month+year string like "Jun 2023"
    expect(result).toMatch(/\w+ \d{4}/);
  });
});

describe('formatFullDate', () => {
  it('returns a human-readable full date string', () => {
    const result = formatFullDate('2024-01-15T09:30:00.000Z');
    // Should contain year
    expect(result).toContain('2024');
  });
});
