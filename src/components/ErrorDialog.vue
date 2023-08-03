<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" square>
    <q-card class="q-dialog-plugin">
      <q-card-section>{{ props.message }}</q-card-section>
      <q-card-actions>
        <q-space />
        <q-btn
          square
          size="sm"
          class="bordered"
          label="OK"
          color="positive"
          @click="onDialogOK"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useDialogPluginComponent } from 'quasar';

const props = defineProps({
  message: String,
});

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
</script>
