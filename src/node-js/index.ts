import Database, { Database as IDatabase } from 'better-sqlite3';
import { safeJsonParse, safeJsonStringify } from 'safe-json-utils';

import {
  IKeyValueStorage,
  KeyValueStorageOptions,
  getNodeJSOptions,
  parseEntry,
} from '../shared';
import { Statements } from './sqlite';

export class KeyValueStorage implements IKeyValueStorage {
  private readonly database: IDatabase;
  private readonly statements: Statements;

  constructor(opts?: KeyValueStorageOptions) {
    const options = getNodeJSOptions(opts);
    this.database =
      typeof options.database === 'string'
        ? new Database(options.database)
        : options.database;
    const tableName = options.tableName || 'keyvaluestorage';
    this.statements = new Statements(tableName);
    this.database.prepare(this.statements.createTable()).run();
  }

  public async getKeys(): Promise<string[]> {
    const keys = this.database
      .prepare(this.statements.selectKeys())
      .all()
      .map<string[]>(x => Object.values(x))
      .flat();
    return keys;
  }

  public async getEntries<T = any>(): Promise<[string, T][]> {
    const entries = this.database
      .prepare(this.statements.selectEntries())
      .all()
      .map(x => parseEntry(Object.values(x) as [string, any]));
    return entries;
  }

  public async getItem<T = any>(key: string): Promise<T | undefined> {
    const item = this.database
      .prepare(this.statements.selectValueWhereKey())
      .get(key);
    if (typeof item === 'undefined' || typeof item.value === 'undefined') {
      return undefined;
    }
    // TODO: fix this annoying type casting
    return safeJsonParse(item.value) as T;
  }

  public async setItem<T = any>(key: string, value: any): Promise<void> {
    this.database
      .prepare(this.statements.replaceInto())
      .run({ key, value: safeJsonStringify(value) });
  }

  public async removeItem(key: string): Promise<void> {
    this.database.prepare(this.statements.deleteFromWhereKey()).run(key);
  }
}

export default KeyValueStorage;
