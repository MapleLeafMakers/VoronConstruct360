<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" square>
    <q-card class="q-dialog-plugin">
      <q-card-section>
        <div class="row q-mb-sm">
          <label for="token">Github API Key: </label>
          <input
            id="token"
            bg-color="white"
            :style="{ flex: 1 }"
            v-model="token"
          />
        </div>
        <div class="row q-mb-sm">
          <label for="token">Interface URL: </label>
          <input
            id="token"
            bg-color="white"
            :style="{ flex: 1 }"
            placeholder="https://mapleleafmakers.github.io/VoronConstruct360/"
            v-model="prefs.interfaceUrl"
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
import { useCoreStore } from 'src/stores/core';
import { useDialogPluginComponent } from 'quasar';
import { ref } from 'vue';
const store = useCoreStore();
const token = ref(store.token);
const prefs = { ...store.preferences };

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
  // on OK, it is REQUIRED to
  // call onDialogOK (with optional payload)
  prefs.interfaceUrl;
  store.token = token;
  store.saveToken();
  Object.assign(store.preferences, prefs);
  store.savePreferences();
  onDialogOK();
  // or with payload: onDialogOK({ ... })
  // ...and it will also hide the dialog automatically
}
</script>
