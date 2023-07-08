<template>
  <div
    ref="el"
    :style="{
      height: '3px',
      cursor: 'ns-resize',
      marginTop: '-3px',
    }"
  >
    &nbsp;
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMousePressed, useMouse, useWindowSize } from '@vueuse/core';
import { useCoreStore } from 'src/stores/core';

const store = useCoreStore();
const el = ref<HTMLElement | null>();
const { pressed } = useMousePressed({ target: el });
const { y } = useMouse();
const { height } = useWindowSize();

const props = defineProps<{
  maxSize: number;
  minSize: number;
  setSize: (s: number) => void;
}>();

watch(
  () => pressed,
  (isPressed) => {
    store.globalCursor = isPressed ? 'ns-resize' : '';
  }
);

watch(y, (currentY) => {
  if (pressed.value) {
    let newSize = height.value - currentY - 3;
    if (newSize > props.maxSize) newSize = props.maxSize;
    if (newSize < props.minSize) newSize = props.minSize;
    props.setSize(newSize);
  }
});
</script>
