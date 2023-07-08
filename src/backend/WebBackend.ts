import {
  Backend,
  ContentTypes,
  JsonSerializable,
  KeysOrPattern,
} from './types';

function _escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class WebBackend implements Backend {
  isFusion360: boolean;
  version = 1;
  latestVersion = 1;

  constructor() {
    this.isFusion360 = false;
  }

  async get_version() {
    return this.version;
  }

  async kv_get({ key, or }: { key: string; or?: JsonSerializable }) {
    const result = localStorage.getItem(key);
    if (result === null) {
      return or;
    }
    return JSON.parse(result);
  }

  async kv_mget({ keys, pattern }: KeysOrPattern) {
    const results: { [key: string]: JsonSerializable } = {};
    const fetchKeys = [...(keys || [])];
    if (pattern) {
      fetchKeys.push(...(await this.kv_keys({ pattern })));
    }
    for (const key of fetchKeys) {
      results[key] = await this.kv_get({ key });
    }
    return results;
  }

  async kv_set({ key, value }: { key: string; value: JsonSerializable }) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async kv_mset(values: { [key: string]: JsonSerializable }) {
    for (const [k, v] of Object.entries(values)) {
      localStorage.setItem(k, JSON.stringify(v));
    }
  }

  async kv_keys({ pattern }: { pattern: string }) {
    const pat = new RegExp(
      `^${pattern.split('%').map(_escapeRegExp).join('.*')}$`
    );
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.match(pat)) {
        results.push(key);
      }
    }
    return results;
  }

  async kv_del({ key }: { key: string }) {
    localStorage.removeItem(key);
  }

  async kv_mdel({ keys, pattern }: KeysOrPattern) {
    const delKeys = [...(keys || [])];
    if (pattern) {
      delKeys.push(...(await this.kv_keys({ pattern })));
    }
    for (const key of delKeys) {
      localStorage.removeItem(key);
    }
  }

  get_screenshot({}: {
    width?: number | undefined;
    height?: number | undefined;
    transparent?: boolean | undefined;
    antialias?: boolean | undefined;
  }): Promise<string> {
    throw new Error('Method not implemented.');
  }
  open_model({}: {
    url: string;
    content_type: ContentTypes;
    token: string;
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }
  import_model({}: {
    url: string;
    content_type: ContentTypes;
    token: string;
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }
  export_model({}: { step: boolean; f3d: boolean }): Promise<{
    name: string;
    step?: string | undefined;
    f3d?: string | undefined;
  }> {
    throw new Error('Method not implemented.');
  }
  close(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  autothumb({}: {
    url: string;
    content_type: ContentTypes;
    token: string;
    width?: number | undefined;
    height?: number | undefined;
    transparent?: boolean | undefined;
    antialias?: boolean | undefined;
  }): Promise<string> {
    throw new Error('Method not implemented.');
  }
}
