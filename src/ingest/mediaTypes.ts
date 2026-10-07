import { StoredBlob } from '../types';

/** Largest file Forward stores (videos, PDFs…). */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

export class FileTooLargeError extends Error {
  constructor(readonly size: number) {
    super('File is too large');
    this.name = 'FileTooLargeError';
  }
}

export interface PreparedImage {
  original: StoredBlob;
  thumb?: StoredBlob;
}
