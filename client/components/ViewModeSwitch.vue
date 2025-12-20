<template>
  <div class="view-mode-switch">
    <button
      class="mode-btn"
      :class="{ active: modelValue === 'card' }"
      @click="$emit('update:modelValue', 'card')"
      title="卡片视图"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <rect x="3" y="3" width="8" height="8" rx="1"/>
        <rect x="13" y="3" width="8" height="8" rx="1"/>
        <rect x="3" y="13" width="8" height="8" rx="1"/>
        <rect x="13" y="13" width="8" height="8" rx="1"/>
      </svg>
    </button>
    <button
      class="mode-btn"
      :class="{ active: modelValue === 'list' }"
      @click="$emit('update:modelValue', 'list')"
      title="列表视图"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <rect x="3" y="4" width="18" height="3" rx="1"/>
        <rect x="3" y="10.5" width="18" height="3" rx="1"/>
        <rect x="3" y="17" width="18" height="3" rx="1"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
export type ViewMode = 'card' | 'list'

defineProps<{
  modelValue: ViewMode
}>()

defineEmits<{
  (e: 'update:modelValue', value: ViewMode): void
}>()
</script>

<style scoped>
.view-mode-switch {
  display: flex;
  gap: 2px;
  background-color: var(--k-color-bg-2);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  padding: 2px;
}

.mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--k-color-text-description);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-size: 16px;
}

.mode-btn:hover {
  color: var(--k-color-text);
  background-color: var(--k-color-bg-1);
}

.mode-btn.active {
  color: var(--k-color-active);
  background-color: var(--k-card-bg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
