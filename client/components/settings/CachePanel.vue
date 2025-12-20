<template>
  <div class="cache-panel">
    <div class="stats-card" v-if="stats">
      <div class="stats-grid">
        <div class="stat">
          <div class="value">{{ stats.totalFiles }}</div>
          <div class="label">文件数量</div>
        </div>
        <div class="stat">
          <div class="value">{{ stats.totalSizeMB.toFixed(1) }} MB</div>
          <div class="label">已用空间</div>
        </div>
        <div class="stat">
          <div class="value">{{ stats.maxSizeMB }} MB</div>
          <div class="label">最大容量</div>
        </div>
      </div>

      <div class="progress-row">
        <div class="progress-bar">
          <div class="fill" :style="{ width: usagePercent + '%' }"></div>
        </div>
        <span class="percent">{{ usagePercent.toFixed(1) }}%</span>
      </div>
    </div>

    <div class="actions">
      <k-button @click="refresh">
        <template #icon><k-icon name="refresh"></k-icon></template>
        刷新
      </k-button>
      <k-button type="error" @click="clear">
        <template #icon><k-icon name="delete"></k-icon></template>
        清空缓存
      </k-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from '@koishijs/client'
import { cacheApi, CacheStats } from '../../api'

const stats = ref<CacheStats | null>(null)

const usagePercent = computed(() => {
  if (!stats.value) return 0
  return Math.min(100, (stats.value.totalSizeMB / stats.value.maxSizeMB) * 100)
})

const refresh = async () => {
  try {
    stats.value = await cacheApi.stats()
  } catch (e) {
    message.error('获取缓存统计失败')
  }
}

const clear = async () => {
  if (!confirm('确定要清空所有缓存吗？')) return
  try {
    await cacheApi.clear()
    message.success('缓存已清空')
    await refresh()
  } catch (e) {
    message.error('清空缓存失败')
  }
}

onMounted(refresh)
</script>

<style scoped>
.cache-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats-card {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
  padding: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.stat {
  text-align: center;
}

.value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--k-color-text);
}

.label {
  font-size: 13px;
  color: var(--k-color-text-description);
  margin-top: 4px;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--k-color-bg-2);
  border-radius: 4px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--k-color-active);
  border-radius: 4px;
  transition: width 0.3s;
}

.percent {
  font-size: 13px;
  color: var(--k-color-text-description);
  white-space: nowrap;
}

.actions {
  display: flex;
  gap: 12px;
}
</style>
