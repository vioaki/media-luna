<template>
  <div class="settings-view">
    <!-- 侧边栏导航 -->
    <aside class="sidebar">
      <nav class="nav-list">
        <div
          v-for="panel in panels"
          :key="panel.id"
          class="nav-item"
          :class="{ active: activePanel === panel.id }"
          @click="activePanel = panel.id"
        >
          <k-icon :name="panel.icon"></k-icon>
          <span>{{ panel.name }}</span>
        </div>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <div v-if="loading" class="loading">
        <k-icon name="sync" class="spin"></k-icon>
        加载中...
      </div>

      <template v-else-if="currentPanel">
        <!-- 面板标题 -->
        <header class="panel-header">
          <h2>{{ currentPanel.name }}</h2>
          <p v-if="currentPanel.description">{{ currentPanel.description }}</p>
        </header>

        <!-- 功能模块面板 -->
        <template v-if="currentPanel.component === 'middlewares'">
          <MiddlewaresPanel />
        </template>

        <!-- 扩展插件面板 -->
        <template v-else-if="currentPanel.component === 'plugins'">
          <PluginsPanel />
        </template>

        <!-- 自定义面板 -->
        <template v-else-if="currentPanel.type === 'custom' && currentPanel.configFields">
          <div class="custom-panel">
            <ConfigRenderer
              :fields="currentPanel.configFields"
              v-model="customConfig"
            />
            <div class="actions">
              <k-button type="primary" @click="saveCustomConfig">
                <template #icon><k-icon name="save"></k-icon></template>
                保存
              </k-button>
            </div>
          </div>
        </template>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { message } from '@koishijs/client'
import { settingsApi, SettingsPanelInfo } from '../api'
import ConfigRenderer from './ConfigRenderer.vue'
import MiddlewaresPanel from './settings/MiddlewaresPanel.vue'
import PluginsPanel from './settings/PluginsPanel.vue'

// 状态
const loading = ref(true)
const panels = ref<SettingsPanelInfo[]>([])
const activePanel = ref('')
const customConfig = ref<Record<string, any>>({})

// 当前面板
const currentPanel = computed(() =>
  panels.value.find(p => p.id === activePanel.value)
)

// 加载面板列表
const loadPanels = async () => {
  try {
    panels.value = await settingsApi.panels()
    if (panels.value.length && !activePanel.value) {
      activePanel.value = panels.value[0].id
    }
  } catch (e) {
    message.error('加载设置面板失败')
  }
}

// 加载自定义面板配置
const loadCustomConfig = () => {
  if (currentPanel.value?.type === 'custom') {
    customConfig.value = { ...(currentPanel.value.config || {}) }
    // 填充默认值
    for (const field of currentPanel.value.configFields || []) {
      if (customConfig.value[field.key] === undefined && field.default !== undefined) {
        customConfig.value[field.key] = field.default
      }
    }
  }
}

// 保存自定义面板配置
const saveCustomConfig = async () => {
  if (!currentPanel.value) return
  try {
    await settingsApi.update(currentPanel.value.id, customConfig.value)
    message.success('保存成功')
    await loadPanels()
  } catch (e) {
    message.error('保存失败')
  }
}

// 监听面板切换
watch(activePanel, () => {
  if (currentPanel.value?.type === 'custom') {
    loadCustomConfig()
  }
})

onMounted(async () => {
  await loadPanels()
  loading.value = false
})
</script>

<style scoped>
.settings-view {
  display: flex;
  gap: 2rem;
  height: 100%;
  min-height: 0;
}

.sidebar {
  width: 180px;
  flex-shrink: 0;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--k-color-bg-2);
  border-radius: 12px;
  padding: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--k-color-text-description);
  font-size: 14px;
  transition: all 0.2s;
}

.nav-item:hover {
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
}

.nav-item.active {
  background: var(--k-card-bg);
  color: var(--k-color-active);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.main-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* 隐藏式滚动条 */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.main-content:hover {
  scrollbar-color: var(--k-color-border) transparent;
}

/* Webkit 隐藏式滚动条 */
.main-content::-webkit-scrollbar {
  width: 6px;
}

.main-content::-webkit-scrollbar-track {
  background: transparent;
}

.main-content::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.main-content:hover::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 4rem;
  color: var(--k-color-text-description);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.panel-header {
  margin-bottom: 1.5rem;
}

.panel-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0 0 0.5rem 0;
}

.panel-header p {
  color: var(--k-color-text-description);
  font-size: 14px;
  margin: 0;
}

.custom-panel {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
  padding: 1.5rem;
}

.actions {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--k-color-border);
}
</style>
