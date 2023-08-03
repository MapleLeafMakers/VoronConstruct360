<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" square>
    <q-card class="q-dialog-plugin">
      <q-card-section>
        <div class="row q-mb-sm">
          <label>Display Name: </label>
          <input
            bg-color="white"
            :style="{ flex: 1 }"
            v-model="collection.name"
          />
        </div>
        <div class="row q-mb-sm">
          <label>Repositories: </label>
          <div style="display: flex; flex-direction: column; flex: 1">
            <div class="row q-mb-xs">
              <input
                :disabled="collection.type === 'org'"
                v-model="addingRepo"
                bg-color="white"
                :style="{ flex: 1 }"
                @keypress.enter="onAdd"
              />
              <q-btn
                :disable="collection.type === 'org'"
                class="bordered"
                style="border-left: none"
                unelevated
                size="sm"
                icon="add"
                @click="onAdd"
              />
            </div>
            <select
              :disabled="collection.type === 'org'"
              v-model="selectedRepo"
              size="4"
              :style="{ flex: 1, overflowY: 'auto' }"
              class="q-mb-xs"
            >
              <option
                v-for="repo in collection.repositories || []"
                :key="repo.repr"
              >
                {{ repo.repr }}
              </option>
            </select>
            <div class="row">
              <q-btn-group square unelevated>
                <q-btn
                  size="sm"
                  class="bordered"
                  style="border-right: none"
                  unelevated
                  square
                  :disable="!canMoveUp"
                  @click="onMoveUp"
                  icon="mdi-arrow-up"
                />
                <q-btn
                  size="sm"
                  class="bordered"
                  unelevated
                  square
                  :disable="!canMoveDown"
                  @click="onMoveDown"
                  icon="mdi-arrow-down"
                />
              </q-btn-group>
              <q-btn
                size="sm"
                class="bordered q-ml-md"
                square
                unelevated
                :disable="!selectedRepo"
                @click="onDeleteRepo"
                icon="mdi-delete"
              ></q-btn>
            </div>
          </div>
        </div>
      </q-card-section>
      <q-card-actions>
        <q-btn
          square
          size="sm"
          class="bordered"
          label="DELETE"
          color="negative"
          text-color="yellow"
          style="font-weight: bold"
          @click="handleDelete"
        />
        <q-space />

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
          :disable="!(collection.name && collection?.repositories?.length > 0)"
          @click="onOKClick"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useQuasar, useDialogPluginComponent } from 'quasar';
import { cleanRepoString, getOrgOrUserRepos } from 'src/repodb';
import { computed, reactive, ref } from 'vue';
import { useCoreStore } from 'src/stores/core';
import { showAlert } from 'src/alert';

const $q = useQuasar();
const store = useCoreStore();
const selectedRepo = ref(null);
const addingRepo = ref('');
const props = defineProps({
  initialValue: { type: Object, required: false, default: null },
});

const collection = reactive(
  JSON.parse(JSON.stringify(props.initialValue || {}))
);

if (!collection.type) {
  collection.type = 'repo';
}

const onMoveUp = async () => {
  const prevIdx = selectedRepoIndex.value - 1;
  const idx = selectedRepoIndex.value;
  [collection.repositories[prevIdx], collection.repositories[idx]] = [
    collection.repositories[idx],
    collection.repositories[prevIdx],
  ];
};

const onMoveDown = async () => {
  const nextIdx = selectedRepoIndex.value + 1;
  const idx = selectedRepoIndex.value;
  [collection.repositories[nextIdx], collection.repositories[idx]] = [
    collection.repositories[idx],
    collection.repositories[nextIdx],
  ];
};

const onAdd = async () => {
  let repo;
  if (addingRepo.value.match(/[\w-]+\/\*/)) {
    const repos = (
      await getOrgOrUserRepos({
        org: addingRepo.value.split('/')[0],
        token: store.token,
      })
    ).map((r) => r.repositories[0]);
    collection.repositories = [...repos];
    collection.org = addingRepo.value.split('/')[0];
    collection.type = 'org';
    addingRepo.value = '';
  } else {
    try {
      repo = await cleanRepoString({
        input: addingRepo.value,
        token: store.token,
      });
    } catch (err) {
      let message = `${err}`;

      if (err?.response) {
        if (err.response.status === 401) {
          message =
            "You don't have permission to access this repository using the provided access token.";
        } else if (err.response.status === 404) {
          message = 'Repository not found';
        }
      }
      showAlert({ message });
      return;
    }

    collection.repositories = [...(collection.repositories || []), repo];
    addingRepo.value = '';
  }
};

const selectedRepoIndex = computed(() => {
  return (collection?.repositories || []).findIndex(
    (r) => r.repr === selectedRepo.value
  );
});

const canMoveUp = computed(() => {
  const can =
    selectedRepoIndex.value !== null &&
    selectedRepoIndex.value !== undefined &&
    selectedRepoIndex.value > 0;
  return can;
});

const canMoveDown = computed(() => {
  const can =
    selectedRepoIndex.value > -1 &&
    selectedRepoIndex.value < (collection?.repositories || []).length - 1;
  return can;
});

const onDeleteRepo = () => {
  const idx = collection.repositories.findIndex(
    (r) => r.repr === selectedRepo.value
  );
  collection.repositories.splice(idx, 1);
};

const handleDelete = () => {
  $q.dialog({
    title: 'Are you sure?',
    message: 'Are you sure you want to permanently delete this collection?',
    cancel: true,
    persistent: false,
    ok: {
      class: 'bordered',
      square: true,
      size: 'sm',
      color: 'positive',
      nocaps: true,
    },
    cancel: {
      class: 'bordered',
      square: true,
      size: 'sm',
      push: true,
      color: 'negative',
      nocaps: true,
    },
  }).onOk(() => {
    const idx = store.tree.findIndex((n) => {
      return n.id == collection.id;
    });
    if (idx !== -1) {
      store.tree.splice(idx, 1);
      store.saveCollections();
      onDialogCancel();
    } else {
      console.log('No match found for', collection.id);
    }
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

// this is part of our example (so not required)
function onOKClick() {
  onDialogOK(collection);
}
</script>
