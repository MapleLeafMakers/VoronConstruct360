import {
  Backend,
  ContentTypes,
  JsonSerializable,
  KeysOrPattern,
} from './types';
import rpc from './rpc';

export class FusionBackend implements Backend {
  isFusion360: boolean;
  version: number;
  latestVersion = 3;
  updateUrl = 'https://github.com/MapleLeafMakers/VoronConstruct360/releases';

  constructor() {
    this.isFusion360 = true;
    this.version = -1;
  }

  async get_version() {
    if (this.version === -1) {
      try {
        this.version = await rpc.request('get_version', {});
      } catch (err) {
        this.version = 1;
      }
    }
    return this.version;
  }

  async kv_get({ key, or = null }: { key: string; or?: JsonSerializable }) {
    const result: JsonSerializable = await rpc.request('kv_get', { key: key });
    if (result === null) {
      return or;
    }
    return result;
  }

  async kv_mget({
    keys,
    pattern,
  }: KeysOrPattern): Promise<{ [key: string]: JsonSerializable }> {
    const result: { [key: string]: JsonSerializable } = await rpc.request(
      'kv_mget',
      {
        keys,
        pattern,
      }
    );
    return result;
  }

  async kv_set({ key, value }: { key: string; value: JsonSerializable }) {
    await rpc.request('kv_set', { key, value });
  }

  async kv_mset(values: { [key: string]: JsonSerializable }) {
    await rpc.request('kv_mset', { obj: values });
  }

  async kv_keys({ pattern }: { pattern: string }) {
    const result = (await rpc.request('kv_keys', { pattern })) as string[];
    return result;
  }

  async kv_del({ key }: { key: string }) {
    await rpc.request('kv_del', { key });
  }

  async kv_mdel({ keys, pattern }: KeysOrPattern) {
    await rpc.request('kv_mdel', { keys, pattern });
  }

  async get_screenshot({
    width,
    height,
    transparent,
    antialias,
  }: {
    width?: number | undefined;
    height?: number | undefined;
    transparent?: boolean | undefined;
    antialias?: boolean | undefined;
  }) {
    const result = (await rpc.request('get_screenshot', {
      width,
      height,
      transparent,
      antialias,
    })) as string;
    return result;
  }

  async open_model({
    url,
    token,
    content_type,
    filename,
  }: {
    url: string;
    token: string;
    content_type: ContentTypes;
    filename?: string;
  }) {
    await rpc.request('open_model', {
      url,
      token,
      content_type,
      filename: this._version < 2 ? undefined : filename,
    });
  }

  async import_model({
    url,
    token,
    content_type,
    filename,
  }: {
    url: string;
    token: string;
    content_type: ContentTypes;
    filename?: string;
  }) {
    await rpc.request('import_model', {
      url,
      token,
      content_type,
      filename: this._version < 2 ? undefined : filename,
    });
  }

  async export_model({ step, f3d }: { step: boolean; f3d: boolean }) {
    const result = (await rpc.request('export_model', { step, f3d })) as {
      step?: string;
      f3d?: string;
      name: string;
    };
    return result;
  }

  async close() {
    await rpc.request('close', {});
  }

  async autothumb({
    url,
    content_type,
    token,
    width,
    height,
    transparent,
    antialias,
  }: {
    url: string;
    content_type: ContentTypes;
    token: string;
    width?: number | undefined;
    height?: number | undefined;
    transparent?: boolean | undefined;
    antialias?: boolean | undefined;
  }) {
    const result = (await rpc.request('autothumb', {
      url,
      content_type,
      token,
      width,
      height,
      transparent,
      antialias,
    })) as string;
    return result;
  }
}
