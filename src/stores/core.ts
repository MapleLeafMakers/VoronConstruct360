import { defineStore } from 'pinia';
import { downloadBlobImageAsDataUri, getMergedTrees } from '../repodb.js';
import { reactive } from 'vue';
import rpc from 'src/rpc';

export interface ModelContentType {
  path: string;
  url: string;
  sha: string;
  size: number;
  repo: string;
  branch: string;
}

export interface RepoNode {
  children?: RepoNode[];
  id: string;
  name: string;
  type: 'blob' | 'tree' | 'repo';
  path: string;
  meta: unknown;
  icon?: string;
  img?: string;
  lazy?: boolean | string;
  uploadTo?: string;
  content_types?: {
    f3d?: ModelContentType;
    step?: ModelContentType;
    dxf?: ModelContentType;
    svg?: ModelContentType;
    meta?: ModelContentType;
    thumb?: ModelContentType;
  };
  selectable: boolean;
  expandable: boolean;
}

export interface Preferences {
  showThumbnails: boolean;
  previewSize: number;
  showManagementUI: boolean;
  interfaceUrl: string;
}

export function setNodeProps(tree: RepoNode[]) {
  for (const node of tree) {
    if (node.type === 'repo') {
      node.icon = 'mdi-github';
    } else if (node.type === 'tree') {
      node.icon = 'mdi-folder';
    } else if (node.type === 'blob') {
      node.icon = 'mdi-cube-outline';
    }
    node.selectable = node.type === 'blob';
    node.expandable = node.type === 'repo' || node.type === 'tree';
    if (node.children) {
      setNodeProps(node.children);
    }
  }
}

export const useCoreStore = defineStore('core', {
  state: () => ({
    globalCursor: '',
    search: '' as string,
    tree: reactive([]) as RepoNode[],
    token: '',
    preferences: {
      showThumbnails: false,
      previewSize: 128,
      showManagementUI: false,
      interfaceUrl: '',
    } as Preferences,
  }),

  getters: {},

  actions: {
    getTopLevelNode(id: string) {
      return this.tree.filter((n) => n.id === id)[0];
    },
    async loadState() {
      await rpc.init();
      const { token, collections, preferences } = await rpc.request('kv_mget', {
        keys: ['token', 'collections', 'preferences'],
      });
      if (token) {
        this.token = token;
      }
      if (collections) {
        for (const c of collections) {
          c.selectable = false;
          c.icon = 'mdi-github';
          if (Array.isArray(c.repositories) && c.repositories.length > 0) {
            c.repositories = c.repositories.map((r) => {
              if (typeof r === 'string') {
                return {
                  repr: r,
                  repo: r.split('/').slice(0, 2).join('/'),
                  path: r.split('/').slice(2).join('/'),
                  branch: r.split('#')[1] || null,
                };
              }
              return r;
            });
          }
        }
        console.log(collections);
        this.tree = reactive(collections);
        this.tree.forEach((n) => this.reloadCollection({ nodeId: n.id }));
      }
      if (preferences) {
        for (const key of Object.keys(preferences)) {
          this.preferences[key] = preferences[key];
        }
      }
    },
    async saveToken() {
      rpc.request('kv_set', {
        key: 'token',
        value: this.token,
      });
    },
    async saveCollections() {
      rpc.request('kv_set', {
        key: 'collections',
        value: this.tree.map((n) => ({ ...n, children: undefined })),
      });
    },

    async savePreferences() {
      return rpc.request('kv_set', {
        key: 'preferences',
        value: { ...this.preferences },
      });
    },

    async reloadCollection({ nodeId }: { nodeId: string }) {
      const node = this.tree.filter((n: RepoNode) => n.id === nodeId)[0];
      node.lazy = 'loading';
      const tree = await getMergedTrees({
        repositories: node?.repositories.map((r) => r.repr),
        token: this.token,
        index: true,
        id_prefix: node.id,
        noCache: false,
        setLoadingMessage: console.log,
      });
      node.lazy = false;
      setNodeProps(tree);
      node.children = reactive(tree);
    },

    async setNodeThumbnail(node: RepoNode) {
      const dataUrl = await downloadBlobImageAsDataUri({
        url: node?.content_types?.thumb?.url,
        token: this.token,
      });
      node.img = dataUrl;
    },
  },
});
