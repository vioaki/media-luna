<template>
  <div class="tag-input">
    <el-select
      v-model="model"
      multiple
      filterable
      allow-create
      default-first-option
      :placeholder="placeholder"
      class="tag-select"
      tag-type="primary"
    >
      <el-option
        v-for="item in suggestions"
        :key="item"
        :label="item"
        :value="item"
      />
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string[],
  suggestions?: string[],
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<style scoped>
.tag-input {
  width: 100%;
}
.tag-select {
  width: 100%;
}

.tag-select :deep(.el-tag) {
  background-color: var(--k-color-bg-3);
  color: var(--k-color-text);
  border-color: transparent;
  border-radius: 4px;
}

.tag-select :deep(.el-tag .el-tag__close) {
  color: var(--k-color-text-description);
}

.tag-select :deep(.el-tag .el-tag__close:hover) {
  background-color: var(--k-color-text);
  color: var(--k-color-bg-1);
}
</style>