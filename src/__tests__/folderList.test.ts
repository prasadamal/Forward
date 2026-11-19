import { folderListText, MAX_SHARED_LINKS } from '../share/folderList';
import type { Item } from '../types';

const item = (over: Partial<Item>): Item => ({
  id: Math.random().toString(36).slice(2),
  type: 'link',
  title: '',
  text: '',
  source: 'web' as Item['source'],
  tags: [],
  folderIds: ['goa'],
  pinned: false,
  sensitive: false,
  filing: 'auto',
  meta: {} as Item['meta'],
  hasThumb: false,
  hasBlob: false,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('folderListText', () => {
  it('lists links with titles and a footer, numbered in the order given', () => {
    const out = folderListText('Goa', [
      item({ title: 'Fish thali at Ritz Classic', url: 'https://instagram.com/reel/abc' }),
      item({ title: '', url: 'https://maps.app.goo.gl/xyz' }),
    ])!;
    expect(out.message).toBe(
      'Goa (2 links)\n\n1. Fish thali at Ritz Classic\n   https://instagram.com/reel/abc\n2. https://maps.app.goo.gl/xyz\n\nSaved and sorted with Forward.',
    );
    expect(out.shared).toBe(2);
    expect(out.leftOut).toBe(0);
  });

  it('never shares notes, photos, hidden items, wallet items or trashed items', () => {
    const out = folderListText('Trip', [
      item({ title: 'Beach', url: 'https://example.com/beach' }),
      item({ type: 'note', title: 'My passport number', text: 'X1234567' }),
      item({ type: 'image', title: 'Ticket photo', hasBlob: true }),
      item({ title: 'Private link', url: 'https://example.com/private', sensitive: true }),
      item({ type: 'login', title: 'Bank', url: 'https://bank.example.com', sensitive: true }),
      item({ title: 'Old', url: 'https://example.com/old', trashedAt: 5 }),
    ])!;
    expect(out.message).toContain('https://example.com/beach');
    for (const secret of ['passport', 'X1234567', 'Ticket', 'private', 'bank', 'old']) expect(out.message.toLowerCase()).not.toContain(secret);
    expect(out.shared).toBe(1);
    expect(out.leftOut).toBe(4);
  });

  it('returns null when nothing can be shared', () => {
    expect(folderListText('Notes', [item({ type: 'note', title: 'todo' })])).toBeNull();
    expect(folderListText('Empty', [])).toBeNull();
  });

  it('caps very long lists and collapses titles to one line', () => {
    const many = Array.from({ length: MAX_SHARED_LINKS + 7 }, (_, i) => item({ title: `Place\n  ${i}`, url: `https://example.com/${i}` }));
    const out = folderListText('  Big\nlist ', many)!;
    expect(out.message.startsWith(`Big list (${MAX_SHARED_LINKS + 7} links)`)).toBe(true);
    expect(out.message).toContain('1. Place 0');
    expect(out.message).toContain('…and 7 more.');
    expect(out.shared).toBe(MAX_SHARED_LINKS);
  });
});
