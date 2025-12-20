<template>
  <span class="status-badge" :class="status">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
}>()

const label = computed(() => {
  switch (props.status) {
    case 'pending': return '等待中'
    case 'processing': return '处理中'
    case 'success': return '成功'
    case 'failed': return '失败'
    default: return props.status
  }
})
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.2;
}

.status-badge.pending {
  background-color: var(--k-color-bg-2);
  color: var(--k-color-text-description);
}

.status-badge.processing {
  background-color: var(--k-color-primary-bg);
  color: var(--k-color-primary);
}

.status-badge.success {
  background-color: var(--k-color-success-bg);
  color: var(--k-color-success);
}

.status-badge.failed {
  background-color: var(--k-color-error-bg);
  color: var(--k-color-error);
}
</style>