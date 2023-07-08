<template>
  <q-page class="column" :style="{ cursor: store.globalCursor || undefined }">
    <q-toolbar class="text-white shadow-2" style="z-index: 2">
      <q-input
        class="full-width"
        bg-color="white"
        v-model="store.search"
        dense
        square
        outlined
        clearable
      >
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
        <template v-slot:after>
          <q-btn flat square dense icon="more_vert">
            <q-menu square>
              <q-list dense style="min-width: 150px">
                <q-item
                  dense
                  clickable
                  v-close-popup
                  @click="openSettingsDialog"
                >
                  <q-item-section avatar>
                    <q-icon name="settings" />
                  </q-item-section>
                  <q-item-section>Settings</q-item-section>
                </q-item>
                <q-item
                  dense
                  clickable
                  v-close-popup
                  @click="handleAddRepository"
                >
                  <q-item-section avatar>
                    <q-icon name="add" />
                  </q-item-section>
                  <q-item-section>Add Repository</q-item-section>
                </q-item>
                <q-item
                  v-if="store.preferences.showManagementUI"
                  dense
                  clickable
                  v-close-popup
                  @click="handleAutoThumb"
                >
                  <q-item-section avatar>
                    <q-icon name="image" />
                  </q-item-section>
                  <q-item-section>Auto-Thumb</q-item-section>
                </q-item>
                <q-item
                  dense
                  clickable
                  v-close-popup
                  @click="
                    () => {
                      rpc.request('close', {});
                    }
                  "
                >
                  <q-item-section avatar>
                    <q-icon name="close" />
                  </q-item-section>
                  <q-item-section>Close</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </template>
      </q-input>
    </q-toolbar>

    <div
      style="
        flex: 1;
        overflow-y: auto;
        padding-top: 4px;
        background-color: white;
      "
    >
      <RepoTree
        dense
        :showManagementUI="store.preferences.showManagementUI"
        no-transition
        ref="treeRef"
        :filter="store.search"
        :filter-method="treeFilter"
        :nodes="store.tree"
        label-key="name"
        node-key="id"
        no-selection-unset
        :no-nodes-label="getNoNodesLabel()"
        v-model:selected="selected"
        v-model:expanded="expanded"
        @update:expanded="onExpand"
        @action:import="onImportModel"
        @action:open="onOpenModel"
        @action:reload="reloadCollection"
        @action:edit="onEdit"
        @action:upload="onUpload"
        style="flex: 1"
        :show-thumbnails="store.preferences.showThumbnails"
      >
        <template v-slot:default-header="prop">
          <div class="row">
            <img
              v-if="prop.node.img && store.preferences.showThumbnails"
              class="q-tree__img q-mr-sm"
              style="
                border-style: solid;
                border-radius: 4px;
                border-width: 1px;
                z-index: 1;
                background-color: white;
              "
              :src="prop.node.img"
            />
            <q-icon
              v-else
              class="q-tree__icon q-mr-sm"
              :name="prop.node.icon"
              :style="
                prop.node.type === 'blob'
                  ? 'border-style: solid; border-radius: 4px; border-width: 1px; z-index: 1; background-color: white'
                  : ''
              "
              :size="
                prop.node.type === 'blob'
                  ? store.preferences.showThumbnails
                    ? '48px'
                    : '24px'
                  : undefined
              "
            />
            <div
              style="
                display: flex;
                flex-direction: column;
                justify-content: center;
              "
            >
              <div
                :style="{
                  fontWeight: prop.node.type === 'blob' ? 'bold' : 'inherit',
                }"
              >
                {{ prop.node.name }}
              </div>
              <div>
                <!-- <q-badge
                rounded
                v-for="ct of Object.keys(prop.node.content_types || {}).filter(
                  (k) => ['thumb', 'meta'].indexOf(k) === -1
                )"
                :key="ct"
                class="q-mr-xs bg-secondary"
              >
                <strong>.{{ ct }}&nbsp;&nbsp;</strong>
                {{ humanStorageSize(prop.node.content_types[ct].size) }}
              </q-badge> -->
              </div>
            </div>
          </div>
        </template>
      </RepoTree>
    </div>
    <NodePreview
      :showManagementUI="store.preferences.showManagementUI"
      v-if="selectedNode"
      :node="selectedNode"
      @action:import="onImportModel"
      @action:open="onOpenModel"
      @action:edit="onEdit"
    />
  </q-page>
</template>

<script lang="ts" setup>
import { ref, watch, computed, h } from 'vue';
import { useCoreStore, RepoNode } from 'src/stores/core';
import { RepoTree } from 'src/components/tree';
import { setCache } from 'src/repodb';
import { useQuasar, uid, format } from 'quasar';
const { humanStorageSize } = format;
import NodePreview from 'src/components/NodePreview.vue';
import SettingsDialog from 'src/components/SettingsDialog.vue';
import CollectionEditor from 'src/components/CollectionEditor.vue';
import ContentEditor from 'src/components/ContentEditor.vue';
import AutoThumb from 'src/components/AutoThumb.vue';
import rpc from 'src/rpc';

const $q = useQuasar();

setCache({
  async clear() {
    return await rpc.request('kv_mdel', { pattern: 'cache:%' });
  },

  async get(key: string, defaultValue: any) {
    let value = await rpc.request('kv_get', { key });
    if (value === null) {
      value = defaultValue;
    }
    return value;
  },

  async set(key: string, value: any) {
    return await rpc.request('kv_set', { key, value });
  },
});

const store = useCoreStore();
store.loadState();
const selected = ref([]);
const expanded = ref([]);
const treeRef = ref();
const previouslyExpanded = ref([]);

const getNoNodesLabel = () => {
  const node = h('div', { class: 'row justify-center q-my-xl' }, [
    'Select "Add Repository" from the menu to get started.',
  ]);

  return node;
};

const onExpand = (expandedNodes: string[]) => {
  expandedNodes
    .map((n) => treeRef.value.getNodeByKey(n))
    .forEach((n) => {
      if (n) {
        for (let child of n.children) {
          if (child?.content_types?.thumb && !child?.img) {
            store.setNodeThumbnail(child);
          }
        }
      }
    });
};

const selectedNode = computed(() => {
  if (selected.value.length > 0) {
    return treeRef.value.getNodeByKey(selected.value);
  }
  return null;
});

watch(expanded, (curExpanded, prevExpanded) => {
  prevExpanded.forEach((n) => {
    if (curExpanded.indexOf(n) === -1) {
      const node = treeRef.value.getNodeByKey(n);
      if (node.type === 'tree') {
        node.icon = 'mdi-folder';
      }
    }
  });
  curExpanded.forEach((n) => {
    if (prevExpanded.indexOf(n) === -1) {
      const node = treeRef.value.getNodeByKey(n);
      if (node.type === 'tree') {
        node.icon = 'mdi-folder';
      }
    }
  });
});

watch(
  () => store.search,
  (value, previousValue) => {
    if (value && !previousValue) {
      previouslyExpanded.value = [...expanded.value];
      treeRef.value.expandAll();
    } else if (previousValue && !value) {
      expanded.value = [...previouslyExpanded.value];
    }
  }
);

const reloadCollection = async ({ nodeId }: { nodeId: string }) => {
  const repoNode = treeRef.value.getNodeByKey(nodeId);
  const idPrefix = repoNode.id;
  expanded.value = expanded.value.filter(
    (e) => e != idPrefix && !e.startsWith(idPrefix + '|')
  );
  await store.reloadCollection({ nodeId });
};

const openSettingsDialog = () => {
  $q.dialog({
    component: SettingsDialog,
  });
};

const handleAddRepository = () => {
  $q.dialog({
    component: CollectionEditor,
  }).onOk((newCollection) => {
    console.log('OK', newCollection);
    const id = uid();
    store.tree.push({
      ...newCollection,
      id,
      type: 'repo',
      icon: 'mdi-github',
      selectable: false,
      children: [],
    });
    store.saveCollections();
    reloadCollection({ nodeId: id });
  });
};

const handleAutoThumb = () => {
  $q.dialog({
    component: AutoThumb,
  }).onOk((reloadCollectionId) => {
    if (reloadCollectionId) {
      reloadCollection({ nodeId: reloadCollectionId });
    }
  });
};

const treeFilter = (node: RepoNode, filter: string) => {
  const tokens = filter.toLowerCase().split(/\s+/);
  const matches = tokens.every((t: string) => {
    return (
      node?.path?.toLowerCase().indexOf(t) !== -1 ||
      (node?.meta?.keywords?.toLowerCase() || '').indexOf(t) !== -1
    );
  });
  return matches;
};

const onUpload = ({ nodeId }: { nodeId: string }) => {
  const node = treeRef.value.getNodeByKey(nodeId);
  let collection = node;
  if (node.type === 'tree') {
    collection = treeRef.value.getNodeByKey(node.id.split('|')[0]);
  }
  $q.dialog({
    component: ContentEditor,
    componentProps: {
      collection,
      initialValue: {
        content_types: {},
      },
    },
  });
};
const onImportModel = ({
  nodeId,
  contentType,
}: {
  nodeId: string;
  contentType?: 'step' | 'f3d' | 'dxf' | 'svg';
}) => {
  const node = treeRef.value.getNodeByKey(nodeId);
  const cts = node.content_types;
  contentType =
    contentType ||
    (cts.f3d ? 'f3d' : cts.step ? 'step' : cts.dxf ? 'dxf' : cts.svg && 'svg');
  rpc.request('import_model', {
    url: cts[contentType as string].url,
    token: store.token,
    content_type: contentType,
  });
};

const onOpenModel = ({
  nodeId,
  contentType,
}: {
  nodeId: string;
  contentType?: 'f3d' | 'step' | 'dxf' | 'svg';
}) => {
  const node = treeRef.value.getNodeByKey(nodeId);
  const cts = node.content_types;
  contentType =
    contentType ||
    (cts.f3d ? 'f3d' : cts.step ? 'step' : cts.dxf ? 'dxf' : cts.svg && 'svg');
  rpc.request('open_model', {
    url: cts[contentType as string].url,
    token: store.token,
    content_type: contentType,
  });
};

const onEdit = ({ nodeId }: { nodeId: string }) => {
  const node = treeRef.value.getNodeByKey(nodeId);
  const component = node.type === 'repo' ? CollectionEditor : ContentEditor;
  $q.dialog({
    component: component,
    componentProps: {
      initialValue: node,
    },
  }).onOk((updatedCollection) => {
    node.name = updatedCollection.name;
    const a = JSON.stringify(updatedCollection.repositories);
    const b = JSON.stringify(node.repositories);
    if (a != b) {
      node.repositories = updatedCollection.repositories;
      reloadCollection({ nodeId });
    }
    store.saveCollections();
  });
};
</script>