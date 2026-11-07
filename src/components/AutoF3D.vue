<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" square>
    <q-card class="q-dialog-plugin">
      <q-card-section>
        <div class="row">
          <div class="col-12">
            AutoF3D will automatically generate and upload F3D files for any library
            items that only have a STEP/STP file in the selected path. Existing F3D
            files will not be replaced.
          </div>
        </div>
        <q-separator class="q-mb-sm" />
        <div
          class="row q-mb-sm"
          v-if="!modelsToProcess.length && !processedFiles.length"
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
          v-if="!modelsToProcess.length && !processedFiles.length"
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
          class="row q-py-sm"
          v-if="processedFiles.length && !modelsToProcess.length"
        >
          <div class="col-12">
            <div>Generated {{ processedFiles.length }} F3D files.</div>
            <q-scroll-area class="thumb-list">
              <div
                v-for="pf of processedFiles"
                :key="pf.path"
                style="white-space: nowrap"
              >
                {{ pf.path }}
              </div>
            </q-scroll-area>
          </div>
        </div>
        <div
          class="row q-py-sm"
          v-if="processedFiles.length && !modelsToProcess.length"
        >
          <label>Upload To: </label>

          <select v-model="selectedRepo" style="flex: 1">
            <option
              :value="repo.repr"
              :key="repo.repr"
              v-for="repo of collection?.repositories"
            >
              {{ repo.repr }}
            </option>
          </select>
        </div>

        <div v-if="modelsToProcess.length" class="row justify-center items-center q-py-sm">
          <img
            v-if="currentModel?.img"
            :src="currentModel.img"
            class="autothumb-preview"
          />
          <q-icon
            v-else
            name="mdi-cube-outline"
            size="64px"
            color="grey-7"
          />
          <div class="col-12 text-center text-weight-medium q-mt-xs">
            {{ currentModel?.name }}
          </div>
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
          v-if="uploadProgress.length"
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
              (processedFiles.length && !selectedRepo)
            )
          "
          @click="onOKClick"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useCoreStore } from 'src/stores/core';
import {
  BlobRepoNode,
  CollectionRepoNode,
  RepoNode,
  Repository,
} from 'src/repodb';

import { format, useDialogPluginComponent } from 'quasar';
const { humanStorageSize } = format;

import { ref, reactive, computed } from 'vue';
import { uploadFiles } from 'src/repodb';
import { showAlert } from 'src/alert';

const selectedPath = ref(null);
const expandedPaths = ref([]);
const store = useCoreStore();
const collectionId = ref(null);
const modelsToProcess = ref([] as RepoNode[]);
const currentModel = ref<BlobRepoNode | null>(null);
const totalModelsToProcess = ref(0);
const selectedRepo = ref<string | null>(null);
const uploadProgress = ref<number[]>([]);

const collection = computed(() => {
  if (!collectionId.value) return null;
  return store.tree.filter(
    (n) => n.id === collectionId.value
  )[0] as CollectionRepoNode;
});

const processedFiles = ref(
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
    } else if (node.type === 'blob') {
      nodes.push(node);
    }
  }

  return nodes.filter((n: RepoNode) => {
    let node = n as BlobRepoNode;
    return (
      !node?.content_types?.f3d &&
      Boolean(node?.content_types?.step)
    );
  });
};

const processF3DFiles = async () => {
  while (modelsToProcess.value.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const model = modelsToProcess.value.shift() as BlobRepoNode;
    currentModel.value = model;
    try {
      const f3dData = (await store.backend.autof3d({
        url: model?.content_types?.step?.url as string,
        token: store.token,
      })) as string;
      if (f3dData) {
        processedFiles.value.push({
          path: `${model.path}.f3d`,
          content: f3dData.includes(',') ? f3dData.split(',')[1] : f3dData,
          encoding: 'base64',
        });
      }
    } catch (err) {
      console.error(`Failed to generate F3D for ${model.name}:`, err);
    }
  }
  currentModel.value = null;
};

const uploadAndCommit = async () => {
  const repo = collection.value?.repositories.filter(
    (r) => r.repr === selectedRepo.value
  )[0] as Repository;
  await uploadFiles({
    repo: repo.repo,
    branch: repo.branch,
    files: [...processedFiles.value],
    token: store.token,
    message: 'Add auto-generated F3D files.',
    progressCallback: (processed: number, total: number) => {
      uploadProgress.value = [processed, total];
    },
  });
};

defineEmits([
  ...useDialogPluginComponent.emits,
]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

function onCancelClick() {
  if (modelsToProcess.value.length) {
    modelsToProcess.value = [];
    totalModelsToProcess.value = 0;
    currentModel.value = null;
    processedFiles.value = [];
  } else if (processedFiles.value.length) {
    processedFiles.value = [];
  } else {
    onDialogCancel();
  }
}

function onOKClick() {
  if (processedFiles.value.length) {
    // 2nd phase: OK-ing the upload & commit
    uploadAndCommit()
      .then(() => {
        onDialogOK(collection?.value?.id);
      })
      .catch((err) => {
        showAlert({ message: `${err}` });
      });
  } else {
    // 1st phase: OK-ing the conversion
    let path = selectedPath.value || '';
    if (path === '/') {
      path = '';
    }

    modelsToProcess.value = getModels(collection.value?.children || []).filter(
      (n) => n.path.startsWith(path)
    );

    totalModelsToProcess.value = modelsToProcess.value.length;
    if (!totalModelsToProcess.value) {
      showAlert({
        message: 'No models found with only STEP/STP files in the selected path.',
      });
      return;
    }

    processF3DFiles()
      .then(() => {
        totalModelsToProcess.value = 0;
        if (!processedFiles.value.length) {
          showAlert({
            message:
              'No F3D files were generated. Check the Fusion 360 Text Commands window for errors.',
          });
          return;
        }
        if (!selectedRepo.value) {
          selectedRepo.value = collection.value?.repositories?.[0]?.repr ?? null;
        }
      })
      .catch((err) => {
        console.error('Processing Error', err);
        totalModelsToProcess.value = 0;
        modelsToProcess.value = [];
        currentModel.value = null;
        processedFiles.value = [];
      });
  }
}
</script>

