import * as SQLite from 'expo-sqlite';
import { RunResult, SQLDatabase, SQLValue } from './types';

/** Adapts an expo-sqlite connection to the app's SQLDatabase interface. */
export class ExpoDatabase implements SQLDatabase {
  constructor(private readonly db: SQLite.SQLiteDatabase) {}

  get path(): string {
    return this.db.databasePath;
  }

  exec(sql: string): Promise<void> {
    return this.db.execAsync(sql);
  }

  async run(sql: string, params: SQLValue[] = []): Promise<RunResult> {
    const r = await this.db.runAsync(sql, params);
    return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
  }

  get<T>(sql: string, params: SQLValue[] = []): Promise<T | null> {
    return this.db.getFirstAsync<T>(sql, params);
  }

  all<T>(sql: string, params: SQLValue[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params);
  }

  transaction(fn: () => Promise<void>): Promise<void> {
    return this.db.withTransactionAsync(fn);
  }

  close(): Promise<void> {
    return this.db.closeAsync();
  }
}

/** Opens a database file with a fresh (uncached) connection. */
export async function openExpoDatabase(name: string): Promise<ExpoDatabase> {
  const db = await SQLite.openDatabaseAsync(name, { useNewConnection: true });
  return new ExpoDatabase(db);
}
