/**
 * Test-only SQLDatabase backed by sql.js (SQLite compiled to JavaScript).
 * Lets repository tests run real SQL in Node without native modules.
 */
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { RunResult, SQLDatabase, SQLValue } from '../db/types';

// The asm.js build avoids WebAssembly realm issues inside Jest's sandbox.
const initSqlJs: () => Promise<SqlJsStatic> = require('sql.js/dist/sql-asm.js');

let sqlPromise: Promise<SqlJsStatic> | null = null;

function toSqlJs(params: SQLValue[]): SqlValue[] {
  return params.map(p => (p === undefined ? null : p)) as SqlValue[];
}

export class SqlJsDatabase implements SQLDatabase {
  private closed = false;

  constructor(readonly raw: Database) {}

  static async create(): Promise<SqlJsDatabase> {
    sqlPromise = sqlPromise ?? initSqlJs();
    const SQL = await sqlPromise;
    return new SqlJsDatabase(new SQL.Database());
  }

  private ensureOpen() {
    if (this.closed) throw new Error('Database is closed');
  }

  async exec(sql: string): Promise<void> {
    this.ensureOpen();
    this.raw.exec(sql);
  }

  async run(sql: string, params: SQLValue[] = []): Promise<RunResult> {
    this.ensureOpen();
    this.raw.run(sql, toSqlJs(params));
    const changes = this.raw.getRowsModified();
    const last = this.raw.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0];
    return { changes, lastInsertRowId: Number(last ?? 0) };
  }

  async all<T>(sql: string, params: SQLValue[] = []): Promise<T[]> {
    this.ensureOpen();
    const stmt = this.raw.prepare(sql);
    try {
      stmt.bind(toSqlJs(params));
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  async get<T>(sql: string, params: SQLValue[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, params);
    return rows[0] ?? null;
  }

  async transaction(fn: () => Promise<void>): Promise<void> {
    this.ensureOpen();
    this.raw.exec('BEGIN');
    try {
      await fn();
      this.raw.exec('COMMIT');
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }

  async close(): Promise<void> {
    if (!this.closed) {
      this.raw.close();
      this.closed = true;
    }
  }
}
