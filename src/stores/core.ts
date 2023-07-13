import { defineStore } from 'pinia';
import {
  RepoNode,
  OrgRepoNode,
  CollectionRepoNode,
  BlobRepoNode,
  Repository,
  downloadBlobImageAsDataUri,
  getMergedTrees,
  getOrgOrUserRepos,
} from '../repodb';

import { reactive } from 'vue';
import { initBackend, Backend } from '../backend';
import { uid } from 'quasar';

export interface Preferences {
  showThumbnails: boolean;
  previewSize: number;
  showManagementUI: boolean;
  interfaceUrl: string;
  fontSize: number;
}

export function setNodeProps(tree: RepoNode[]) {
  for (const node of tree) {
    if (node.type === 'repo') {
      node.icon = 'mdi-github';
    } else if (node.type === 'org') {
      node.icon = 'mdi-domain';
    } else if (node.type === 'tree') {
      node.icon = 'mdi-folder';
    } else if (node.type === 'blob') {
      node.icon = 'mdi-cube-outline';
    }
    node.selectable = node.type === 'blob';
    node.expandable =
      node.type === 'repo' || node.type === 'tree' || node.type === 'org';
    if (node.children) {
      setNodeProps(node.children);
    }
  }
}

export const useCoreStore = defineStore('core', {
  state: () => ({
    globalCursor: '',
    search: '' as string,
    tree: reactive([]) as CollectionRepoNode[],
    token: '',
    backend: {} as Backend,
    preferences: {
      showThumbnails: false,
      previewSize: 128,
      showManagementUI: false,
      interfaceUrl: '',
      fontSize: 12,
    } as Preferences,
  }),

  getters: {},

  actions: {
    getTopLevelNode(id: string) {
      for (const n of this.tree) {
        if (n.id === id) {
          return n;
        }
        if (n.type === 'org') {
          const orgMatches = n.children?.filter((n) => n.id === id);
          if (orgMatches) {
            return orgMatches[0];
          }
        }
      }
    },

    async loadState() {
      this.backend = await initBackend();
      const { token, collections, preferences } = await this.backend.kv_mget({
        keys: ['token', 'collections', 'preferences'],
      });

      if (token) {
        this.token = token as string;
      }

      if (collections) {
        const repoCollections = collections as unknown as CollectionRepoNode[];
        for (const c of repoCollections) {
          c.selectable = false;
          c.icon = c.type === 'repo' ? 'mdi-github' : 'mdi-domain';
          if (Array.isArray(c.repositories) && c.repositories.length > 0) {
            c.repositories = c.repositories.map((r: string | Repository) => {
              if (typeof r === 'string') {
                return {
                  repr: r,
                  repo: r.split('/').slice(0, 2).join('/'),
                  path: r.split('/').slice(2).join('/'),
                  branch: r.split('#')[1] || null,
                } as Repository;
              }
              return r;
            });
          }
        }
        this.tree = reactive(repoCollections);
        for (const n of this.tree) {
          if (n.type === 'repo') {
            this.reloadCollection({ nodeId: n.id });
          } else if (n.type === 'org') {
            for (const r of n.children || []) {
              this.reloadCollection({ nodeId: r.id });
            }
          }
        }
      }
      if (preferences) {
        Object.assign(this.preferences, preferences);
      }
    },

    async saveToken() {
      this.backend.kv_set({
        key: 'token',
        value: this.token,
      });
    },

    async saveCollections() {
      this.backend.kv_set({
        key: 'collections',
        value: this.tree.map(
          (n: CollectionRepoNode) =>
            ({
              ...n,
              children: (n.children || [])
                .filter((c) => c.type === 'repo')
                .map((c) => ({ ...c, children: [] })),
            } as CollectionRepoNode)
        ),
      });
    },

    async savePreferences() {
      return this.backend.kv_set({
        key: 'preferences',
        value: { ...this.preferences },
      });
    },

    async reloadCollection({
      nodeId,
      startup,
    }: {
      nodeId: string;
      startup?: boolean;
    }) {
      if (startup === undefined) {
        startup = false;
      }

      let node;
      for (const root of this.tree) {
        if (root.type === 'org') {
          const idx = (root.children || []).findIndex((c) => c.id === nodeId);
          if (idx !== -1) {
            node = (root.children as [])[idx];
            break;
          }
        }
        if (root.id === nodeId) {
          node = root;
          break;
        }
      }
      if (!node) {
        throw new Error('Node not found');
      }
      console.log('reloading collection', node);
      node.lazy = 'loading';
      let tree;
      if (node.type === 'repo') {
        tree = await getMergedTrees({
          repositories: node?.repositories.map((r) => r.repr),
          token: this.token,
          index: true,
          id_prefix: node.id,
          setLoadingMessage: () => null,
        });
        node.lazy = false;
        setNodeProps(tree);
        node.children = reactive(tree);
      } else if (node.type === 'org') {
        tree = (
          await getOrgOrUserRepos({
            org: (node as OrgRepoNode).org,
            token: this.token,
          })
        ).map((o) => ({ ...o, id: uid() }));
        console.log('is org', tree);
        for (const orgRepo of tree) {
          orgRepo.children = await getMergedTrees({
            repositories: orgRepo.repositories.map((r: Repository) => r.repr),
            token: this.token,
            id_prefix: orgRepo.id,
            index: true,
            setLoadingMessage: () => null,
          });
        }
        tree = tree.filter((c: RepoNode) => (c.children?.length || 0) > 0);
        node.lazy = false;
        setNodeProps(tree);
        node.children = reactive(tree);
        await this.saveCollections();
      }
    },

    async setNodeThumbnail(node: BlobRepoNode) {
      const dataUrl = await downloadBlobImageAsDataUri({
        url: (node?.content_types?.thumb?.url ||
          node?.content_types?.svg?.url) as string,
        token: this.token,
        content_type: node?.content_types?.thumb
          ? 'image/png'
          : 'image/svg+xml',
      });
      node.img = dataUrl;
    },
  },
});
