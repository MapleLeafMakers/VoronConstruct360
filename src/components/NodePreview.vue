<template>
  <div
    class="previewPane shadow-up-2"
    style="z-index: 2"
    :style="{ maxHeight: `${store.preferences.previewSize}px` }"
  >
    <PanelResizer
      :setSize="(s) => (store.preferences.previewSize = s)"
      :minSize="64"
      :maxSize="256"
    />
    <div
      class="row"
      :style="{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        height: `${store.preferences.previewSize}px`,
      }"
    >
      <div class="thumbnail">
        <img
          :src="dataUrl"
          v-if="dataUrl"
          :style="{
            width: `${store.preferences.previewSize}px`,
            height: `${store.preferences.previewSize}px`,
            objectFit: 'contain',
          }"
        />
        <q-icon
          v-if="!dataUrl"
          :name="node.icon"
          :size="`${store.preferences.previewSize}px`"
        />
      </div>
      <div style="display: flex; flex-direction: column; flex: 1">
        <q-tabs
          :breakpoint="50"
          v-model="tab"
          dense
          narrow-indicator
          align="left"
          class="shadow-2"
        >
          <q-tab
            v-for="ct of Object.keys(node?.content_types || {}).filter(
              (n) => n !== 'meta' && n !== 'thumb'
            )"
            :name="ct"
            :key="ct"
            dense
            :label="`.${ct.toUpperCase()}`"
          />
          <q-space />
          <template v-if="store.backend.isFusion360">
            <q-btn
              icon="mdi-import"
              size="sm"
              dense
              rounded
              unelevated
              label="Import"
              class="q-pr-sm q-mr-sm"
              @click="
                (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  emit('action:import', { nodeId: node.id, contentType: tab });
                }
              "
            />
            <q-btn
              v-if="node.content_types?.step || node.content_types?.f3d"
              icon="mdi-open-in-new"
              size="sm"
              dense
              rounded
              unelevated
              label="Open"
              class="q-pr-sm q-mr-sm"
              @click="
                (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  emit('action:open', { nodeId: node.id, contentType: tab });
                }
              "
            />
          </template>
          <template v-else>
            <q-btn
              v-if="node.content_types?.step || node.content_types?.f3d"
              icon="mdi-download"
              size="sm"
              dense
              rounded
              unelevated
              label="Download"
              class="q-pr-sm q-mr-sm"
              @click="
                (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  emit('action:open', { nodeId: node.id, contentType: tab });
                }
              "
            />
          </template>
          <q-btn
            v-if="
              props.showManagementUI &&
              (node.content_types?.step || node.content_types?.f3d)
            "
            icon="mdi-pencil"
            size="sm"
            dense
            rounded
            unelevated
            label="edit"
            class="q-mr-sm"
            @click="
              (e) => {
                e.stopPropagation();
                e.preventDefault();
                emit('action:edit', { nodeId: node.id });
              }
            "
          />
        </q-tabs>

        <q-tab-panels
          animated
          v-model="tab"
          style="flex: 1; overflow-y: auto; height: 1px"
        >
          <q-tab-panel
            class="q-pa-xs"
            v-for="ct of Object.keys(node?.content_types || {}).filter(
              (n) => n !== 'meta' && n !== 'thumb'
            )"
            :key="ct"
            :name="ct"
          >
            <NodePreviewTab
              :label="ct.toUpperCase()"
              :info="(node?.content_types?.[ct as 'step' | 'f3d' | 'dxf' | 'svg'] as ModelContentType)"
            />
          </q-tab-panel>
        </q-tab-panels>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { downloadBlobImageAsDataUri } from 'src/repodb';
import { onMounted, ref, watch } from 'vue';
import { BlobRepoNode, ModelContentType, useCoreStore } from 'src/stores/core';
import PanelResizer from 'src/components/PanelResizer.vue';
import NodePreviewTab from 'src/components/NodePreviewTab.vue';
import { WebBackend } from 'src/backend/WebBackend';
const props = defineProps<{ node: BlobRepoNode; showManagementUI: boolean }>();
const store = useCoreStore();
const dataUrl = ref('');

const tab = ref('step');

const emit = defineEmits(['action:import', 'action:open', 'action:edit']);
const setDataUrl = async (node: BlobRepoNode) => {
  if (node.meta?.thumb) {
    dataUrl.value = node?.meta?.thumb as string;
  } else if (node.content_types?.thumb) {
    downloadBlobImageAsDataUri({
      url: node?.content_types?.thumb.url,
      token: store.token,
    }).then((val) => (dataUrl.value = val));
  } else {
    dataUrl.value = '';
  }
};

const setActiveTab = (node: BlobRepoNode) => {
  if (
    node.content_types?.[tab.value as 'step' | 'f3d' | 'dxf' | 'svg'] ===
    undefined
  ) {
    const cts = node.content_types;
    tab.value = cts?.['step']
      ? 'step'
      : cts?.['f3d']
      ? 'f3d'
      : cts?.['dxf']
      ? 'dxf'
      : cts?.['svg']
      ? 'svg'
      : tab.value;
  }
};

onMounted(() => {
  setDataUrl(props.node);
  setActiveTab(props.node);
});

watch(() => props.node, setDataUrl);
watch(() => props.node, setActiveTab);
</script>
