<template>
  <MergeWizard @merge-complete="handleMergeComplete" />
</template>
<script setup>
import MergeWizard from './MergeWizard.vue'

const emit = defineEmits(['merge-complete'])

function handleMergeComplete(result) {
  console.log('Merge process completed:', result)
  emit('merge-complete', result)
}
</script>
<style scoped>

</style>
