<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" square>
    <q-card class="q-dialog-plugin">
      <q-card-section>
        <div class="row q-mb-sm">
          <label for="token">Github Access Token: </label>
          <div style="flex-direction: column; display: flex">
            <input
              autofocus
              ref="tokenInput"
              id="token"
              type="password"
              bg-color="white"
              :style="{ flex: 1 }"
              v-model="token"
            />
            <span class="help-text"
              >Generate a new access token
              <a target="_blank" href="https://github.com/settings/tokens/new"
                >here</a
              ></span
            >
          </div>
        </div>
        <div class="row q-mb-sm">
          <label for="fontSize">Font Size: </label>
          <q-slider
            color="blue-8"
            id="fontSize"
            :style="{ flex: 1 }"
            v-model="prefs.fontSize"
            :min="10"
            :max="20"
            :step="1"
            snap
            label
            @update:model-value="previewFontSize"
          />
        </div>
        <div class="row q-mb-sm">
          <label style="margin-left: 17px">
            Show Thumbnails:
            <input type="checkbox" v-model="prefs.showThumbnails" />
          </label>
        </div>
        <div class="row q-mb-sm">
          <label style="margin-left: 17px">
            Search Folder Names:
            <input type="checkbox" v-model="prefs.searchFolderNames" />
          </label>
        </div>
        <div class="row q-mb-sm">
          <label style="margin-left: 17px">
            Mgmt. Controls:
            <input type="checkbox" v-model="prefs.showManagementUI" />
          </label>
        </div>
      </q-card-section>
      <!-- buttons example -->
      <q-card-actions align="right">
        <q-btn
          size="sm"
          square
          color="negative"
          text-color="white"
          label="Cancel"
          @click="onDialogCancel"
        />
        <q-btn
          color="positive"
          text-color="white"
          label="OK"
          size="sm"
          square
          @click="onOKClick"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { verifyToken } from 'src/repodb';
import { useCoreStore } from 'src/stores/core';
import { useDialogPluginComponent } from 'quasar';
import { ref } from 'vue';
const tokenInput = ref(null);
const store = useCoreStore();
const token = ref(store.token);
const prefs = { ...store.preferences };
const previewFontSize = (val) => {
  document.querySelector('body').style.fontSize = `${val}px`;
};

defineEmits([
  // REQUIRED; need to specify some events that your
  // component will emit through useDialogPluginComponent()
  ...useDialogPluginComponent.emits,
]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

function onOKClick() {
  verifyToken({ token: token.value }).then((isValid) => {
    if (!isValid) {
      alert('The provided access token is invalid.');
    } else {
      store.token = token;
      store.saveToken();
      Object.assign(store.preferences, prefs);
      store.savePreferences();
      onDialogOK();
    }
  });
}
</script>
