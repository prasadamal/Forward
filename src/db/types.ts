/**
 * Minimal async database interface. Production uses expo-sqlite (SQLCipher
 * build); tests use sql.js. Keeping the surface small makes both easy.
 */
export type SQLValue = string | number | null | Uint8Array;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SQLDatabase {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SQLValue[]): Promise<RunResult>;
  get<T>(sql: string, params?: SQLValue[]): Promise<T | null>;
  all<T>(sql: string, params?: SQLValue[]): Promise<T[]>;
  /** Runs `fn` inside BEGIN/COMMIT, rolling back if it throws. */
  transaction(fn: () => Promise<void>): Promise<void>;
  close(): Promise<void>;
}

/** Serialises async work so transactions never interleave on one connection. */
export class AsyncQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
