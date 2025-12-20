<template>
  <div class="scroll-container">
    <div class="scroll-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.scroll-container {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  background-color: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
}

.scroll-content {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
}

/* 自定义滚动条 */
.scroll-content::-webkit-scrollbar {
  width: 8px;
}

.scroll-content::-webkit-scrollbar-track {
  background: transparent;
}

.scroll-content::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
  border-radius: 4px;
}

.scroll-content::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-text-description);
}
</style>
