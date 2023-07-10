<template>
  <div class="row">
    <q-item dense class="col-xs-12">
      <q-item-section>
        <q-item-label
          >{{ info.path }} [{{ humanStorageSize(info.size) }}]</q-item-label
        >
        <q-item-label
          ><a
            :href="`https://github.com/${info.repo}/tree/${info.branch}/${info.path}`"
            ><q-icon
              name="mdi-github"
              size="15px"
              style="vertical-align: baseline"
            />{{ info.repo }}</a
          >
        </q-item-label>
      </q-item-section>
    </q-item>
  </div>
</template>
<script setup lang="ts">
import { useCoreStore } from 'src/stores/core';
import { format } from 'quasar';
import { onMounted, ref, watch } from 'vue';
import { ModelContentType, getLatestCommitForPath } from 'src/repodb';
const { humanStorageSize } = format;

const store = useCoreStore();
const commitInfo = ref(null);

const props = defineProps<{
  label: string;
  info: ModelContentType;
}>();

const loadCommitInfo = async (info: ModelContentType) => {
  commitInfo.value = (
    await getLatestCommitForPath({
      ...info,
      token: store.token,
    })
  ).commit;
};

watch(() => props.info, loadCommitInfo);

onMounted(() => {
  loadCommitInfo(props.info);
});
</script>
