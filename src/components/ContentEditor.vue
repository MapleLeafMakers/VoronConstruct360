<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" square>
    <q-card class="q-dialog-plugin">
      <q-card-section style="position: relative">
        <div class="row q-mb-sm">
          <label>Name: </label>
          <input
            :disabled="!!props.initialValue?.name"
            bg-color="white"
            :style="{ flex: 1 }"
            v-model="name"
          />
        </div>
        <div class="row q-mb-sm">
          <label>Path: </label>
          <div style="flex: 1; position: relative">
            <q-tree
              ref="treeRef"
              dense
              :default-expand-all="!!pathFilter"
              v-model:selected="selectedPath"
              v-model:expanded="expandedPaths"
              no-selection-unset
              :nodes="pathTree"
              :filter="pathFilter"
              :filter-method="
                (node, filter) => {
                  return node.path === filter;
                }
              "
              node-key="id"
              label-key="name"
              class="pathTree"
            >
              <template v-slot:default-header="{ node }">
                <q-icon :name="node.icon" class="q-tree__icon q-mr-sm" />
                <div
                  :id="`pathTree--${pathToId(node.id)}`"
                  @keypress="(e) => e.stopImmediatePropagation()"
                >
                  <span v-if="!node.editing">{{ node.name }}</span>
                  <input
                    v-else
                    v-model="newFolderName"
                    @blur="
                      (event) => onEditingComplete(event, node, newFolderName)
                    "
                    @keypress.enter="
                      (event) => onEditingComplete(event, node, newFolderName)
                    "
                  />
                </div>
              </template>
            </q-tree>
            <div
              class="pathTree--disabler"
              v-if="props.initialValue?.path"
              @click="
                (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }
              "
            ></div>
            <div v-if="!props.initialValue?.path">
              <q-btn
                size="sm"
                icon="mdi-folder-plus-outline"
                label="New Folder"
                flat
                square
                no-caps
                :disable="!selectedPath"
                class="bordered q-mt-xs"
                @click="onNewFolder"
              />
            </div>
          </div>
        </div>
        <div class="row q-mb-sm no-wrap">
          <label style="margin-left: 17px; white-space: nowrap"
            >Upload .STEP: <input type="checkbox" v-model="uploadStep"
          /></label>
          <div class="text-negative" v-if="uploadStepError">
            {{ uploadStepError }}
          </div>
        </div>
        <div class="row q-mb-sm no-wrap">
          <label style="margin-left: 17px; white-space: nowrap"
            >Upload .F3D: <input type="checkbox" v-model="uploadF3d"
          /></label>
          <div class="text-negative" v-if="uploadF3dError">
            {{ uploadF3dError }}
          </div>
        </div>
        <div class="row q-mb-sm">
          <label>Thumbnail: </label>
          <div class="thumbnail-edit-wrapper">
            <div class="row q-col-gutter-xs">
              <div
                contenteditable="true"
                class="col-6 q-pa-none editor-thumb"
                @dragover="(event:DragEvent) => {
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed =
                'all';
                }
              }"
                @drop="handleThumbnailDrop"
                @paste="handleImagePaste"
                @beforeinput="
                  (e:Event) => {
                    if ((e as InputEvent).inputType !== 'insertFromPaste') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                    console.log(e);
                  }
                "
              >
                <img :src="thumbnail || 'img/cube-outline.svg'" />
              </div>

              <div class="col-6 q-pt-none">
                <q-btn
                  dense
                  label="Choose"
                  size="sm"
                  flat
                  icon="upload"
                  class="full-width bordered q-mb-xs"
                  no-caps
                  @click="handleFilePickerButton"
                />
                <q-btn
                  dense
                  @click="handleCaptureClick"
                  label="Capture"
                  icon="mdi-monitor-screenshot"
                  size="sm"
                  flat
                  class="full-width bordered"
                  no-caps
                />
                <label
                  ><input type="checkbox" v-model="bgTransparency" /> BG
                  Transparency</label
                >
              </div>
            </div>

            <input
              ref="filePicker"
              @change="handleFilePicker"
              id="thumbnail"
              type="file"
              style="display: none"
            />
          </div>
        </div>
        <div class="row">
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
        <div
          v-if="busy"
          style="
            display: flex;
            flex-direction: row;
            position: absolute;
            top: 0px;
            bottom: 0px;
            left: 0px;
            right: 0px;
            text-align: center;
            align-items: center;
            justify-content: center;
            background-color: rgba(128, 128, 128, 0.5);
          "
        >
          <q-spinner-hourglass color="purple" size="10em" />
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          square
          size="sm"
          class="bordered"
          color="negative"
          label="Cancel"
          @click="onDialogCancel"
        />
        <q-btn
          square
          size="sm"
          class="bordered"
          label="OK"
          color="positive"
          :disable="!canSave()"
          @click="onOKClick"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { QTree, uid, useDialogPluginComponent } from 'quasar';
import { downloadBlobImageAsDataUri, uploadFiles } from 'src/repodb';
import {
  RepoNode,
  ModelContentType,
  useCoreStore,
  CollectionRepoNode,
  BlobRepoNode,
} from 'src/stores/core';
import { onMounted, ref, computed, reactive } from 'vue';
const bgTransparency = ref(false);
const filePicker = ref<HTMLInputElement | null>(null);
const uploadStep = ref(false);
const uploadF3d = ref(false);
const store = useCoreStore();
const thumbnailChanged = ref(false);
const treeRef = ref<QTree>();
const newFolderName = ref('New Folder');
const props = defineProps<{
  initialValue?: BlobRepoNode;
  collection?: CollectionRepoNode;
}>();
const name = ref(props?.initialValue?.name);
const thumbnail = ref('');
const collection = (props.collection ||
  store.getTopLevelNode(
    props.initialValue?.id?.split('|')[0] as string
  )) as CollectionRepoNode;

let path = '';
if (props?.initialValue?.path) {
  path = props?.initialValue.path.split('/').slice(0, -1).join('/');
}
const pathFilter = ref(path);
const expandedPaths = ref(['/']);
const selectedPath = ref(pathFilter.value);
const busy = ref(false);

const onEditingComplete = (
  event: FocusEvent | KeyboardEvent,
  node: PathTreeNode,
  newFolderName: string
) => {
  const parent = treeRef.value?.getNodeByKey(
    node.id.split('/').slice(0, -1).join('/')
  );
  let isValid = true;
  if (!newFolderName) {
    isValid = false;
  }

  const matches = parent.children.filter(
    (n: PathTreeNode) => n.name === newFolderName
  );
  if (matches.length > 1) {
    console.log('matches', matches);
    isValid = false;
  }

  node.name = newFolderName;
  node.path = parent.path = '/' + node.name;

  if (!isValid) {
    event.preventDefault();
    event.stopImmediatePropagation();
    (event.target as HTMLElement)?.focus();
  } else {
    node.editing = false;
  }
};
const pathToId = (path: string) => {
  return btoa(path).replaceAll('=', '');
};

type PathTreeNode = {
  id: string;
  path: string;
  icon: string;
  selectable: boolean;
  name: string;
  editing: boolean;
  children: PathTreeNode[];
};

const buildPathTree: (tree: RepoNode[]) => PathTreeNode[] = (tree) => {
  const newTree = tree
    .filter((n) => n.type === 'tree')
    .map((n: RepoNode) => ({
      id: n.path,
      path: n.path,
      icon: 'mdi-folder',
      selectable: true,
      name: n.name,
      editing: false,
      children: n.children ? buildPathTree(n.children) : [],
    }));

  return newTree;
};

const pathTree = reactive([
  {
    name: '/',
    icon: 'mdi-folder',
    selectable: true,
    id: '/',
    path: '',
    children: buildPathTree(collection?.children || []),
  },
]);

const selectedRepo = ref(
  collection?.uploadTo || collection?.repositories[0].repr
);

const onNewFolder = (event: Event) => {
  newFolderName.value = 'New Folder';
  event.preventDefault();
  event.stopPropagation();
  const node = treeRef.value?.getNodeByKey(selectedPath.value);
  const newNode = {
    id: node.path + '/' + uid(),
    name: 'New Folder',
    path: node.path + '/New Folder',
    selectable: true,
    icon: 'mdi-folder-star',
    editing: true,
    children: [],
  };
  node.children.push(newNode);
  selectedPath.value = newNode.id;
  treeRef.value?.setExpanded(node.id, true);
  setTimeout(() => {
    const node = document.querySelector(`#pathTree--${pathToId(newNode.id)}`);
    console.log('node', node);
    node?.scrollIntoView({ block: 'center' });
    node?.querySelector('input')?.focus();
  }, 500);
};

const uploadF3dError = computed(() => {
  if (uploadF3d.value) {
    const f3dInfo: ModelContentType | undefined =
      props.initialValue?.content_types?.f3d;
    const repo = collection.repositories.filter(
      (r) => r.repr === selectedRepo.value
    )[0];
    if (f3dInfo) {
      if (f3dInfo.repo !== repo.repo) {
        return 'cannot replace the f3d file, it exists in another repository.';
      }
    }
  }
  return '';
});

const uploadStepError = computed(() => {
  if (uploadStep.value) {
    const stepInfo: ModelContentType | undefined =
      props.initialValue?.content_types?.step;
    const repo = collection.repositories.filter(
      (r) => r.repr === selectedRepo.value
    )[0];
    if (stepInfo) {
      if (stepInfo.repo !== repo.repo) {
        return 'cannot replace the step file, it exists in another repository.';
      }
    }
  }
  return '';
});

const handleImagePaste = (e: ClipboardEvent) => {
  let cbPayload = [...e.clipboardData?.items];
  cbPayload = cbPayload.filter((i) => /image/.test(i.type));
  if (!cbPayload.length || cbPayload.length === 0) return false;
  let reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    thumbnail.value = dataUrl as string;
  };
  reader.readAsDataURL(cbPayload[0].getAsFile());
};

const fileToThumbnail = (file: File) => {
  return new Promise((resolve) => {
    const reader = new window.FileReader();
    reader.onload = () => {
      thumbnail.value = reader.result as string;
      thumbnailChanged.value = true;
      resolve(thumbnail.value);
    };
    reader.readAsDataURL(file);
  });
};

const handleThumbnailDrop = (e: DragEvent) => {
  e.stopPropagation();
  e.preventDefault();
  fileToThumbnail(e.dataTransfer?.files[0] as File);
};

const handleFilePicker = (e: Event) => {
  e.stopPropagation();
  e.preventDefault();
  const fileInput = e.target as HTMLInputElement;
  fileToThumbnail(fileInput.files?.[0] as File).then(() => {
    if (filePicker.value !== null) {
      filePicker.value.value = '';
    }
  });
};

const handleFilePickerButton = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  filePicker.value?.click();
};

const handleCaptureClick = async () => {
  const thumb = await store.backend.get_screenshot({
    width: 256,
    height: 256,
    transparent: bgTransparency.value,
  });
  if (thumb) {
    thumbnail.value = thumb;
    thumbnailChanged.value = true;
  } else {
    alert('Workspace image capture failed.');
  }
};

const loadThumbnail = async () => {
  const blobUrl = props?.initialValue?.content_types?.thumb?.url;
  const metaThumb = props?.initialValue?.meta?.thumb;
  if (metaThumb) {
    thumbnail.value = metaThumb as string;
  } else if (blobUrl) {
    thumbnail.value = await downloadBlobImageAsDataUri({
      url: blobUrl,
      token: store.token,
    });
  } else {
    thumbnail.value = '';
  }

  if (!props?.initialValue?.name) {
    await store.backend
      .export_model({ f3d: false, step: false })
      .then((modelData) => {
        name.value = modelData?.name;
      });
  }
};

const canSave = () => {
  if (name.value !== props.initialValue?.name) return true;
  if (thumbnailChanged.value) return true;
  if (uploadF3d.value || uploadStep.value) {
    return true;
  }
};
onMounted(() => {
  loadThumbnail();
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
  busy.value = true;
  setTimeout(() => {
    store.backend
      .export_model({ f3d: uploadF3d.value, step: uploadStep.value })
      .then((modelData) => {
        const files = [];
        busy.value = false;
        if (uploadF3d.value) {
          files.push({
            path: `${selectedPath.value}/${name.value}.f3d`,
            content: modelData.f3d?.split(',')[1],
            encoding: 'base64',
          });
        }
        if (uploadStep.value) {
          files.push({
            path: `${selectedPath.value}/${name.value}.step`,
            content: modelData.step?.split(',')[1],
            encoding: 'base64',
          });
        }
        if (thumbnailChanged.value) {
          files.push({
            path: `${selectedPath.value}/${name.value}.png`,
            content: thumbnail.value.split(',')[1],
            encoding: 'base64',
          });
        }
        const repo = collection.repositories.filter(
          (r) => r.repr === selectedRepo.value
        )[0];
        uploadFiles({
          repo: repo.repo,
          branch: repo.branch,
          files,
          message: `Add ${selectedPath.value}`,
          token: store.token,
          progressCallback: null,
        }).then(() => {
          busy.value = false;
          onDialogOK();
        });
      });
  }, 500);
}
</script>
