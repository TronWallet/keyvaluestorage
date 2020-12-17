import { safeJsonParse, safeJsonStringify } from 'safe-json-utils';

import { STORE_DEFAULT } from '../constants';
import { IKeyValueStorage } from '../shared';

import { IAsyncStorage } from './types';

interface AsyncStorageData {
  [key: string]: any;
}

type InitCallback = (data: AsyncStorageData) => void;

export class KeyValueStorage implements IKeyValueStorage {
  private data: AsyncStorageData = {};
  private initializing: boolean = false;
  private initCallbacks: InitCallback[] = [];

  constructor(
    private readonly asyncStorage: IAsyncStorage,
    private readonly prefix: string = STORE_DEFAULT.PREFIX,
    private readonly separator: string = STORE_DEFAULT.SEPARATOR,
    private readonly asyncStorageKey: string = STORE_DEFAULT.ASYNC_STORAGE_KEY
  ) {
    this.loadData();
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  loadData(): Promise<AsyncStorageData> {
    return new Promise(
      async (resolve, reject): Promise<void> => {
        if (this.initializing) {
          this.onInit((data: AsyncStorageData) => resolve(data));
        } else {
          try {
            this.initializing = true;
            this.data = await this.fetch();
            this.initializing = false;
            resolve(this.data);
            this.triggerInit(this.data);
          } catch (e) {
            this.initializing = false;
            reject(e);
          }
        }
      }
    );
  }

  onInit(callback: InitCallback): void {
    this.initCallbacks.push(callback);
  }

  triggerInit(data: AsyncStorageData): void {
    if (this.initCallbacks && this.initCallbacks.length) {
      this.initCallbacks.forEach((callback: InitCallback) => callback(data));
    }
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    await this.loadData();
    const result =
      this.data[`${this.prefix}${this.separator}${key}`] || undefined;
    // TODO: fix type casting
    return safeJsonParse(result) as any;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    await this.loadData();
    this.data[`${this.prefix}${this.separator}${key}`] = value;
    await this.persist();
  }

  async removeItem(key: string): Promise<void> {
    await this.loadData();
    delete this.data[`${this.prefix}${this.separator}${key}`];
    await this.persist();
  }

  async persist(): Promise<void> {
    await this.asyncStorage.setItem(
      this.asyncStorageKey,
      safeJsonStringify(this.data)
    );
  }

  async fetch(): Promise<AsyncStorageData> {
    const data = await this.asyncStorage.getItem(this.asyncStorageKey);
    // TODO: fix type casting
    return (safeJsonParse(data) as any) || {};
  }

  async getKeys(): Promise<string[]> {
    const relevantKeys = Object.keys(this.data).filter(key =>
      key.startsWith(this.prefix)
    );
    return relevantKeys.map(key =>
      key.replace(`${this.prefix}${this.separator}`, '')
    );
  }

  async getEntries(): Promise<[string, any][]> {
    return Object.entries(this.data)
      .filter(([name, _]) => name.startsWith(this.prefix))
      .map(([name, _]) => [
        name.replace(`${this.prefix}${this.separator}`, ''),
        _,
      ]);
  }

  getKey(...args: string[]): string {
    let str = '';
    args.forEach(arg => {
      // dont add separator to last one
      str = str.concat(
        arg,
        args.indexOf(arg) === args.length - 1 ? '' : this.separator
      );
    });
    return str;
  }
}

export default KeyValueStorage;
