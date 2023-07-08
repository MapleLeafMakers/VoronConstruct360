export type KeysOrPattern =
  | { keys?: string[]; pattern: string }
  | { keys: string[]; pattern?: string };

export interface Backend {
  kv_get({ key, or = null }: { key: string; or?: any }): Promise<any>;
  kv_mget({ keys, pattern }: KeysOrPattern): Promise<{ [key: string]: any }>;
  kv_set({ key, value }: { key: string; value: any }): Promise<any>;
  kv_mset(values: { [key: string]: any }): Promise<void>;
  kv_keys({ pattern }: { pattern: string }): Promise<void>;
  kv_del({ key }: { key: string }): Promise<void>;
  kv_mdel({ keys, pattern }: KeysOrPattern): Promise<void>;
}
