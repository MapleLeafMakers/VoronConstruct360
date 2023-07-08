<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" square>
    <q-card class="q-dialog-plugin">
      <q-card-section>
        <div class="row">
          <div class="col-12">
            AutoThumb will automatically generate any missing thumbnail images
            in the selected path. Existing thumbnails will not be replaced.
          </div>
        </div>
        <q-separator class="q-mb-sm" />
        <div
          class="row q-mb-sm"
          v-if="!modelsToProcess.length && !processedThumbs.length"
        >
          <label>Collection: </label>

          <select v-model="collectionId" style="flex: 1">
            <option v-for="node in store.tree" :key="node.id" :value="node.id">
              {{ node.name }}
            </option>
          </select>
        </div>
        <div
          class="row q-mb-sm"
          v-if="!modelsToProcess.length && !processedThumbs.length"
        >
          <label>Path: </label>
          <div style="flex: 1; position: relative">
            <q-tree
              ref="treeRef"
              dense
              v-model:selected="selectedPath"
              v-model:expanded="expandedPaths"
              no-selection-unset
              :nodes="pathTree"
              node-key="id"
              label-key="name"
              class="pathTree"
            />
          </div>
        </div>
        <div
          class="row q-mb-sm"
          v-if="!modelsToProcess.length && !processedThumbs.length"
        >
          <label style="margin-left: 17px">
            BG Transparency:
            <input type="checkbox" v-model="bgTransparency" />
          </label>
        </div>
        <div
          class="row q-py-sm"
          v-if="processedThumbs.length && !modelsToProcess.length"
        >
          <div class="col-12">
            <div>Generated {{ processedThumbs.length }} thumbnails.</div>
            <q-scroll-area class="thumb-list">
              <div
                v-for="pt of processedThumbs"
                :key="pt.path"
                style="white-space: nowrap"
              >
                {{ pt.path }}
              </div>
            </q-scroll-area>
          </div>
        </div>
        <div
          class="row q-py-sm"
          v-if="processedThumbs.length && !modelsToProcess.length"
        >
          <label>Upload To: </label>

          <select v-model="selectedRepo" style="flex: 1">
            <option
              :value="repo.repr"
              :key="repo.repr"
              v-for="repo of collection.repositories"
            >
              {{ repo.repr }}
            </option>
          </select>
        </div>

        <div v-if="modelsToProcess.length" class="row justify-center q-py-sm">
          <img
            v-if="latestThumb"
            :src="latestThumb"
            class="autothumb-preview"
          />
        </div>
        <q-linear-progress
          v-if="totalModelsToProcess"
          :animation-speed="100"
          size="25px"
          :value="
            (totalModelsToProcess - modelsToProcess.length) /
            totalModelsToProcess
          "
          color="accent"
        >
          <div class="absolute-full flex flex-center">
            <q-badge
              color="white"
              text-color="accent"
              :label="`${
                totalModelsToProcess - modelsToProcess.length
              } / ${totalModelsToProcess}`"
            />
          </div>
        </q-linear-progress>
        <q-linear-progress
          v-if="uploadProgress"
          size="25px"
          :animation-speed="100"
          :value="uploadProgress[0] / uploadProgress[1]"
          color="accent"
        >
          <div class="absolute-full flex flex-center">
            <q-badge
              color="white"
              text-color="accent"
              :label="`${humanStorageSize(
                uploadProgress[0]
              )} / ${humanStorageSize(uploadProgress[1])}`"
            />
          </div>
        </q-linear-progress>
      </q-card-section>
      <!-- buttons example -->
      <q-card-actions align="right">
        <q-btn
          size="sm"
          square
          color="negative"
          text-color="white"
          label="Cancel"
          @click="onCancelClick"
        />
        <q-btn
          color="positive"
          text-color="white"
          label="OK"
          size="sm"
          square
          :disable="
            !!(
              !collection ||
              !selectedPath ||
              modelsToProcess.length ||
              (processedThumbs.length && !selectedRepo)
            )
          "
          @click="onOKClick"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { RepoNode, useCoreStore } from 'src/stores/core';
import { format, useDialogPluginComponent } from 'quasar';
const { humanStorageSize } = format;

import { ref, reactive, computed } from 'vue';
import rpc from 'src/rpc';
import { uploadFiles } from 'src/repodb';
const selectedPath = ref(null);
const expandedPaths = ref([]);
const store = useCoreStore();
const collectionId = ref(null);
const modelsToProcess = ref([] as RepoNode[]);
const totalModelsToProcess = ref(0);
const latestThumb = ref('');
const selectedRepo = ref(null);
const uploadProgress = ref(null);
const bgTransparency = ref(false);

const collection = computed(() => {
  if (!collectionId.value) return null;
  return store.tree.filter((n) => n.id === collectionId.value)[0];
});

const processedThumbs = ref(
  [] as { path: string; content: string; encoding: string }[]
);

interface TreeNode {
  id: string;
  path: string;
  icon: string;
  selectable: boolean;
  name: string;
  children?: TreeNode[];
}

const buildPathTree: (tree: RepoNode[]) => TreeNode[] = (tree) => {
  const newTree: TreeNode[] = tree
    .filter((n) => n.type === 'tree')
    .map((n: RepoNode) => ({
      id: n.path,
      path: n.path,
      icon: 'mdi-folder',
      selectable: true,
      name: n.name,
      children: n.children ? buildPathTree(n.children) : undefined,
    }));
  return newTree;
};

const pathTree = computed(() => {
  if (collection.value) {
    return reactive([
      {
        name: '/',
        icon: 'mdi-folder',
        selectable: true,
        id: '/',
        path: '',
        children: buildPathTree(collection.value?.children || []),
      },
    ]);
  }
  return [];
});

const getModels = (tree: RepoNode[]) => {
  const nodes: RepoNode[] = [];
  for (let node of tree) {
    if (node.type === 'tree' && node.children && node.children.length > 0) {
      nodes.push(...getModels(node.children));
    } else {
      nodes.push(node);
    }
  }

  return nodes.filter(
    (n) =>
      !n?.content_types?.thumb &&
      (n?.content_types?.step || n?.content_types?.f3d)
  );
};

const processThumbs = async () => {
  while (modelsToProcess.value.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const model = modelsToProcess.value.shift() as RepoNode;
    const screenshot = (await rpc.request('autothumb', {
      url: model?.content_types?.f3d?.url || model?.content_types?.step?.url,
      content_type: model?.content_types?.f3d ? 'f3d' : 'step',
      transparent: bgTransparency.value,
      token: store.token,
    })) as string;
    if (screenshot) {
      processedThumbs.value.push({
        path: `${model.path}.png`,
        content: screenshot.split(',')[1],
        encoding: 'base64',
      });
      latestThumb.value = screenshot;
    }
  }
};

const uploadAndCommit = async () => {
  const repo = collection.value.repositories.filter(
    (r) => r.repr === selectedRepo.value
  )[0];
  await uploadFiles({
    repo: repo.repo,
    branch: repo.branch,
    files: [...processedThumbs.value],
    token: store.token,
    message: 'Add auto-generated thumbnails.',
    progressCallback: (processed: number, total: number) => {
      uploadProgress.value = [processed, total];
      console.log(humanStorageSize(processed), '/', humanStorageSize(total));
    },
  });
};

defineEmits([
  // REQUIRED; need to specify some events that your
  // component will emit through useDialogPluginComponent()
  ...useDialogPluginComponent.emits,
]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
// dialogRef      - Vue ref to be applied to QDialog
// onDialogHide   - Function to be used as handler for @hide on QDialog
// onDialogOK     - Function to call to settle dialog with "ok" outcome
//                    example: onDialogOK() - no payload
//                    example: onDialogOK({ /*...*/ }) - with payload
// onDialogCancel - Function to call to settle dialog with "cancel" outcome

function onCancelClick() {
  if (modelsToProcess.value.length) {
    modelsToProcess.value = [];
    totalModelsToProcess.value = 0;
    latestThumb.value = '';
    processedThumbs.value = [];
  } else if (processedThumbs.value.length) {
    processedThumbs.value = [];
  } else {
    onDialogCancel();
  }
}
// this is part of our example (so not required)
function onOKClick() {
  // on OK, it is REQUIRED to
  // call onDialogOK (with optional payload)

  if (processedThumbs.value.length) {
    // 2nd 'phase', OK-ing the upload & commit.
    uploadAndCommit()
      .then(() => {
        onDialogOK(collection?.value?.id);
      })
      .catch((err) => {
        alert(err);
      });
  } else {
    // 1st phase, OK-ing the thumbnail generation.
    let path = selectedPath.value || '';
    if (path === '/') {
      path = '';
    }

    modelsToProcess.value = getModels(collection.value?.children || []).filter(
      (n) => n.path.startsWith(path)
    );

    totalModelsToProcess.value = modelsToProcess.value.length;
    processThumbs()
      .then(() => {
        totalModelsToProcess.value = 0;
        console.log('done');
      })
      .catch((err) => {
        console.error('Processing Error', err);
        totalModelsToProcess.value = 0;
        modelsToProcess.value = [];
        latestThumb.value = '';
        processedThumbs.value = [];
      });
  }
}
</script>
