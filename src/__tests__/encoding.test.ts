import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  dataUri,
  formatBytes,
  hexToBytes,
  utf8Decode,
  utf8Encode,
} from '../utils/encoding';
import { randomBytes } from 'crypto';

describe('encoding', () => {
  it('round-trips hex', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(bytesToHex(bytes)).toBe('00010f10ff');
    expect(Array.from(hexToBytes('00010F10FF'))).toEqual([0, 1, 15, 16, 255]);
    expect(() => hexToBytes('abc')).toThrow();
  });

  it('matches Node for base64 of random data of every length', () => {
    for (let len = 0; len < 70; len++) {
      const buf = randomBytes(len);
      const b64 = bytesToBase64(new Uint8Array(buf));
      expect(b64).toBe(buf.toString('base64'));
      expect(Buffer.from(base64ToBytes(b64)).equals(buf)).toBe(true);
    }
  });

  it('encodes large buffers in chunks', () => {
    const buf = randomBytes(100_003);
    expect(bytesToBase64(new Uint8Array(buf))).toBe(buf.toString('base64'));
  });

  it('round-trips UTF-8 including emoji and Kannada', () => {
    const s = 'Namma ಬೆಂಗಳೂರು 🌳 café';
    const bytes = utf8Encode(s);
    expect(Buffer.from(bytes).toString('utf8')).toBe(s);
    expect(utf8Decode(bytes)).toBe(s);
  });

  it('builds data URIs and formats sizes', () => {
    expect(dataUri('image/png', new Uint8Array([1, 2, 3]))).toBe('data:image/png;base64,AQID');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
