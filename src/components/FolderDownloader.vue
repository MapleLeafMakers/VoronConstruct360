<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" square>
    <q-card class="q-dialog-plugin">
      <q-card-section style="text-align: center"
        ><q-circular-progress
          show-value
          :value="progress"
          size="90px"
          color="accent"
          center-color="white"
          track-color="transparent"
          :animation-speed="10"
        >
          <q-icon name="mdi-folder-download" /></q-circular-progress
      ></q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import { downloadRawBlob } from 'src/repodb';
import { ref } from 'vue';
import {
  BlobRepoNode,
  ModelContentType,
  RepoNode,
  useCoreStore,
} from 'src/stores/core';
import JSZip from 'jszip';

const progress = ref(0);
const store = useCoreStore();

const props = defineProps<{
  node: RepoNode;
}>();

const getFilesNodes = (nodes: RepoNode[]) => {
  const results = [] as BlobRepoNode[];
  for (let node of nodes) {
    if (node.type === 'blob') {
      results.push(node as BlobRepoNode);
    } else if (node.type === 'tree') {
      results.push(...getFilesNodes(node.children || []));
    }
  }
  return results;
};

const startDownloads = async () => {
  const root = props.node.path;
  const nodes = getFilesNodes(props.node.children || []);

  const allFiles = ([] as ModelContentType[]).concat(
    ...nodes.map((n) => {
      const results = [] as ModelContentType[];
      for (const [content_type, info] of Object.entries(
        n.content_types as { [key: string]: ModelContentType }
      )) {
        if (content_type === 'meta' || content_type === 'thumb') {
          continue;
        }
        results.push(info);
      }
      return results;
    })
  );
  const totalFiles = allFiles.length;

  const zip = JSZip();

  for (const [i, file] of allFiles.entries()) {
    const blob = await downloadRawBlob({ url: file.url, token: store.token });
    zip.file(file.path.substring(root.length + 1), blob);
    progress.value = Math.ceil(((i + 1) / totalFiles) * 100);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipBlob);
  link.download = `${props.node.name}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
};

startDownloads().then(() => {
  onDialogOK();
});

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

// this is part of our example (so not required)
function onOKClick() {
  onDialogOK();
}
</script>
