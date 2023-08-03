<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { useCoreStore } from 'src/stores/core';
import { watch, ref } from 'vue';
const body = ref<HTMLElement>(document.querySelector('body') as HTMLElement);
const store = useCoreStore();
body.value.style.fontSize = `${store.preferences.fontSize}px`;

watch(
  () => store.preferences.fontSize,
  () => {
    body.value.style.fontSize = `${store.preferences.fontSize}px`;
  }
);
</script>
