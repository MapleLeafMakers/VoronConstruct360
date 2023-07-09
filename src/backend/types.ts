export type JsonSerializable = any;

export type KeysOrPattern =
  | { keys?: string[]; pattern: string }
  | { keys: string[]; pattern?: string };

export type ContentTypes = 'step' | 'f3d' | 'dxf' | 'svg';

declare global {
  interface Window {
    adsk: { fusionSendData: (action: string, data: string) => void };
    fusionJavaScriptHandler: {
      handle: (action: string, data: string) => string;
    };
    showDirectoryPicker?: ({
      id,
      mode,
      startIn,
    }: {
      id: string;
      mode: string;
      startIn?: FileSystemHandle | string;
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

export interface Backend {
  isFusion360: boolean;
  version: number;
  latestVersion: number;
  updateUrl?: string;

  get_version(): Promise<number>;

  kv_get({
    key,
    or,
  }: {
    key: string;
    or?: JsonSerializable;
  }): Promise<JsonSerializable>;

  kv_mget({
    keys,
    pattern,
  }: KeysOrPattern): Promise<{ [key: string]: JsonSerializable }>;

  kv_set({
    key,
    value,
  }: {
    key: string;
    value: JsonSerializable;
  }): Promise<void>;

  kv_mset(values: { [key: string]: JsonSerializable }): Promise<void>;

  kv_keys({ pattern }: { pattern: string }): Promise<string[]>;
  kv_del({ key }: { key: string }): Promise<void>;
  kv_mdel({ keys, pattern }: KeysOrPattern): Promise<void>;
  get_screenshot({
    width,
    height,
    transparent,
    antialias,
  }: {
    width?: number;
    height?: number;
    transparent?: boolean;
    antialias?: boolean;
  }): Promise<string>;

  open_model({
    url,
    token,
    content_type,
    filename,
  }: {
    url: string;
    token: string;
    content_type: ContentTypes;
    filename?: string;
  }): Promise<void>;

  import_model({
    url,
    token,
    content_type,
    filename,
  }: {
    url: string;
    token: string;
    content_type: ContentTypes;
    filename?: string;
  }): Promise<void>;

  export_model({ step, f3d }: { step: boolean; f3d: boolean }): Promise<{
    name: string;
    step?: string;
    f3d?: string;
  }>;
  close(): Promise<void>;
  autothumb({
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
    width?: number;
    height?: number;
    transparent?: boolean;
    antialias?: boolean;
  }): Promise<string>;
}
