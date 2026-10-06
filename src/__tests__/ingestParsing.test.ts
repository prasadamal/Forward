import { parseNativeShare, mimeFromName, shareSignature } from '../ingest/shareParser';
import { cleanSubject, draftsFromShare } from '../ingest/drafts';
import { IncomingShare } from '../types';

function share(partial: Partial<IncomingShare>): IncomingShare {
  return { id: 's1', receivedAt: 1, files: [], ...partial };
}

describe('parseNativeShare', () => {
  it('parses Android text shares with subject', () => {
    const s = parseNativeShare(
      { text: 'https://youtu.be/dQw4w9WgXcQ', type: 'text', meta: { title: null, subject: 'Watch "Bangalore food" on YouTube' } },
      'id1',
      5,
    );
    expect(s).toEqual({
      id: 'id1',
      receivedAt: 5,
      text: 'https://youtu.be/dQw4w9WgXcQ',
      subject: 'Watch "Bangalore food" on YouTube',
      description: undefined,
      files: [],
    });
  });

  it('parses iOS web page shares from a JSON string', () => {
    const raw = JSON.stringify({
      weburls: [{ url: 'https://example.com/a', meta: JSON.stringify({ title: 'Page', 'og:description': 'Desc' }) }],
      type: 'weburl',
    });
    const s = parseNativeShare(raw, 'id2')!;
    expect(s.text).toBe('https://example.com/a');
    expect(s.subject).toBe('Page');
    expect(s.description).toBe('Desc');
  });

  it('parses files from both platforms and ignores junk entries', () => {
    const android = parseNativeShare(
      {
        files: [
          { filePath: '/data/user/0/app/cache/IMG_1.jpg', fileName: 'IMG_1.jpg', mimeType: 'image/jpeg', fileSize: '2048', width: 100, height: 50 },
          { first: 'type', second: 'file' },
        ],
        type: 'file',
      },
      'a',
    )!;
    expect(android.files).toEqual([
      { uri: 'file:///data/user/0/app/cache/IMG_1.jpg', name: 'IMG_1.jpg', mimeType: 'image/jpeg', size: 2048, width: 100, height: 50 },
    ]);

    const ios = parseNativeShare(
      JSON.stringify({ files: [{ path: '/private/var/group/x/meme.gif', fileName: 'meme.gif', mimeType: '', type: '0' }], type: 'media' }),
      'b',
    )!;
    expect(ios.files[0]).toMatchObject({ uri: 'file:///private/var/group/x/meme.gif', mimeType: 'image/gif' });
  });

  it('returns null for empty or malformed payloads', () => {
    expect(parseNativeShare('not json', 'x')).toBeNull();
    expect(parseNativeShare({ type: 'text' }, 'x')).toBeNull();
    expect(parseNativeShare(null, 'x')).toBeNull();
  });

  it('guesses mime types and builds signatures', () => {
    expect(mimeFromName('doc.PDF')).toBe('application/pdf');
    expect(mimeFromName('noext')).toBe('application/octet-stream');
    expect(shareSignature(share({ text: 'a' }))).toBe(shareSignature(share({ id: 'other', text: 'a' })));
  });
});

describe('draftsFromShare', () => {
  it('turns a bare YouTube link into a link draft with a placeholder title', () => {
    const [d] = draftsFromShare(share({ text: 'https://youtu.be/dQw4w9WgXcQ?si=abc' }));
    expect(d).toMatchObject({ type: 'link', title: 'YouTube video', titleIsGuess: true, source: 'youtube', text: '' });
  });

  it('uses the sending app subject as the title', () => {
    const [d] = draftsFromShare(share({ text: 'https://youtu.be/dQw4w9WgXcQ', subject: 'Watch "Bangalore street food" on YouTube' }));
    expect(d.title).toBe('Bangalore street food');
    expect(d.titleIsGuess).toBe(false);
  });

  it('keeps text around a link as the note', () => {
    const [d] = draftsFromShare(share({ text: 'Must try this weekend! https://www.instagram.com/reel/ABC/' }));
    expect(d).toMatchObject({ type: 'link', title: 'Must try this weekend!', text: 'Must try this weekend!', source: 'instagram' });
  });

  it('turns text with several links into a note', () => {
    const [d] = draftsFromShare(share({ text: 'Places:\nhttps://a.com\nhttps://b.com' }));
    expect(d).toMatchObject({ type: 'note', title: 'Places:' });
  });

  it('creates one draft per file with the text as caption', () => {
    const drafts = draftsFromShare(
      share({
        text: 'lol monday mood',
        files: [
          { uri: 'file:///a.jpg', name: 'IMG_2024.jpg', mimeType: 'image/jpeg' },
          { uri: 'file:///b.mp4', name: 'Trip to Coorg.mp4', mimeType: 'video/mp4' },
          { uri: 'file:///c.pdf', name: 'ticket.pdf', mimeType: 'application/pdf' },
        ],
      }),
    );
    expect(drafts.map(d => [d.type, d.title, d.text])).toEqual([
      ['image', 'lol monday mood', 'lol monday mood'],
      ['video', 'lol monday mood', 'lol monday mood'],
      ['file', 'lol monday mood', 'lol monday mood'],
    ]);
  });

  it('names untitled files from meaningful file names only', () => {
    const drafts = draftsFromShare(
      share({
        files: [
          { uri: 'file:///a.jpg', name: 'IMG_20240101_1234.jpg', mimeType: 'image/jpeg' },
          { uri: 'file:///b.pdf', name: 'Coorg_homestay_booking.pdf', mimeType: 'application/pdf' },
        ],
      }),
    );
    expect(drafts.map(d => [d.title, d.titleIsGuess])).toEqual([
      ['Image', true],
      ['Coorg homestay booking', false],
    ]);
  });

  it('cleans boilerplate subjects', () => {
    expect(cleanSubject('“Masala Dosa” on YouTube')).toBe('Masala Dosa');
    expect(cleanSubject('Some Page - YouTube')).toBe('Some Page');
    expect(cleanSubject('Check this out')).toBeUndefined();
  });
});
