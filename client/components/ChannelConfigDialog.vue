<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑渠道' : '创建渠道'"
    width="800px"
    :close-on-click-modal="false"
    class="channel-config-dialog"
    @closed="handleClosed"
  >
    <div class="dialog-layout">
      <!-- 左侧 Tab 导航 -->
      <div class="tab-nav">
        <div
          v-for="tab in availableTabs"
          :key="tab.id"
          class="tab-item"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <k-icon :name="tab.icon" />
          <span>{{ tab.label }}</span>
          <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
        </div>
      </div>

      <!-- 右侧内容区 -->
      <div class="tab-content">
        <!-- 基本信息 -->
        <div v-show="activeTab === 'basic'" class="content-section">
          <div class="section-header">
            <h4>基本信息</h4>
            <p>设置渠道的名称、连接器和标签</p>
          </div>

          <div class="form-group">
            <label class="form-label required">渠道名称</label>
            <el-input
              v-model="form.name"
              placeholder="如 OpenAI DALL-E"
            />
            <div class="form-hint">用户可见的渠道名称，冲突时会自动添加后缀</div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label required">连接器</label>
              <el-select
                v-model="form.connectorId"
                placeholder="选择连接器"
                @change="handleConnectorChange"
                style="width: 100%"
              >
                <el-option
                  v-for="connector in connectors"
                  :key="connector.id"
                  :label="connector.name"
                  :value="connector.id"
                />
              </el-select>
            </div>
            <div class="form-group">
              <label class="form-label">启用状态</label>
              <div class="switch-wrapper">
                <el-switch v-model="form.enabled" />
                <span class="switch-label">{{ form.enabled ? '启用' : '禁用' }}</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">标签</label>
            <TagInput v-model="form.tags!" placeholder="输入标签后按回车..." />
            <div class="form-hint">用于分类和筛选渠道</div>
          </div>

          <!-- 连接器配置（内嵌） -->
          <template v-if="currentConnectorFields.length > 0">
            <div class="section-divider">
              <span>{{ currentConnectorName }} 配置</span>
            </div>
            <ConfigRenderer
              :fields="currentConnectorFields"
              v-model="form.connectorConfig!"
            />
          </template>
        </div>

        <!-- 中间件流程 -->
        <div v-show="activeTab === 'middlewares'" class="content-section">
          <div class="section-header">
            <h4>中间件流程</h4>
            <p>控制此渠道的中间件启用状态</p>
          </div>

          <div class="override-hint-bar">
            <k-icon name="info-circle" />
            <span>留空表示跟随全局配置</span>
          </div>

          <div class="pipeline-flow">
            <div
              v-for="(phase, phaseIndex) in phases"
              :key="phase.id"
              class="phase-section"
            >
              <!-- 阶段标题 -->
              <div class="phase-header" :class="phase.colorClass">
                <div class="phase-icon">
                  <k-icon :name="phase.icon" />
                </div>
                <div class="phase-info">
                  <span class="phase-name">{{ phase.label }}</span>
                  <span class="phase-desc">{{ phase.description }}</span>
                </div>
                <span class="phase-badge">{{ getPhaseMiddlewares(phase.id).length }}</span>
              </div>

              <!-- 中间件列表 -->
              <div class="phase-middlewares" v-if="getPhaseMiddlewares(phase.id).length > 0">
                <div
                  v-for="mw in getPhaseMiddlewares(phase.id)"
                  :key="mw.name"
                  class="mw-item"
                  :class="{ 'has-override': getMiddlewareEnabled(mw.configGroup || mw.name, mw.name) !== undefined }"
                >
                  <div class="mw-card">
                    <div class="mw-status" :class="getMiddlewareStatusClass(mw)"></div>
                    <div class="mw-content">
                      <span class="mw-name">{{ mw.displayName }}</span>
                      <span class="mw-desc">{{ mw.description || categoryLabels[mw.category] || mw.category }}</span>
                    </div>
                    <el-select
                      :model-value="getMiddlewareEnabled(mw.configGroup || mw.name, mw.name)"
                      @update:model-value="setMiddlewareEnabled(mw.configGroup || mw.name, mw.name, $event)"
                      :placeholder="mw.enabled ? '全局: 启用' : '全局: 禁用'"
                      clearable
                      size="small"
                      class="mw-switch"
                    >
                      <el-option label="启用" :value="true" />
                      <el-option label="禁用" :value="false" />
                    </el-select>
                  </div>
                </div>
              </div>

              <!-- 空状态 -->
              <div v-else class="empty-phase">
                <span>无中间件</span>
              </div>

              <!-- 阶段间连接箭头 -->
              <div v-if="phaseIndex < phases.length - 1" class="phase-connector">
                <div class="connector-line"></div>
                <div class="connector-arrow">
                  <k-icon name="chevron-down" />
                </div>
                <div class="connector-line"></div>
              </div>
            </div>
          </div>

          <!-- 底部说明 -->
          <div class="pipeline-footer">
            <div class="footer-item">
              <span class="dot active"></span>
              <span>启用 - 中间件将在请求中执行</span>
            </div>
            <div class="footer-item">
              <span class="dot"></span>
              <span>禁用 - 中间件将被跳过</span>
            </div>
            <div class="footer-item">
              <span class="dot override"></span>
              <span>已覆盖 - 与全局配置不同</span>
            </div>
          </div>
        </div>

        <!-- 插件配置 -->
        <div v-show="activeTab === 'plugins'" class="content-section">
          <div class="section-header">
            <h4>插件配置覆盖</h4>
            <p>为此渠道单独配置插件参数</p>
          </div>

          <div class="override-hint-bar">
            <k-icon name="info-circle" />
            <span>留空使用全局配置，填写后将覆盖全局设置</span>
          </div>

          <div v-if="pluginsWithConfig.length > 0" class="plugins-override-list">
            <div
              v-for="plugin in pluginsWithConfig"
              :key="plugin.id"
              class="plugin-override-card"
              :class="{ expanded: expandedPlugins.has(plugin.id) }"
            >
              <div class="plugin-header" @click="togglePluginExpand(plugin.id)">
                <div class="plugin-info">
                  <span class="plugin-name">{{ plugin.name }}</span>
                  <span v-if="hasPluginOverride(plugin.id)" class="override-badge">已覆盖</span>
                </div>
                <div class="plugin-actions">
                  <k-button
                    v-if="hasPluginOverride(plugin.id)"
                    size="mini"
                    @click.stop="clearPluginOverride(plugin.id)"
                  >
                    清除
                  </k-button>
                  <k-icon :name="expandedPlugins.has(plugin.id) ? 'chevron-up' : 'chevron-down'" />
                </div>
              </div>

              <div v-show="expandedPlugins.has(plugin.id)" class="plugin-config-fields">
                <template v-for="field in plugin.configFields" :key="field.key">
                  <div v-if="shouldShowOverrideField(plugin, field)" class="override-field-row">
                    <label class="field-label">{{ field.label }}</label>
                    <div class="field-input">
                      <!-- Boolean 类型 -->
                      <template v-if="field.type === 'boolean'">
                        <el-select
                          :model-value="getOverrideValue(plugin.id, field.key)"
                          @update:model-value="setOverrideValue(plugin.id, field.key, $event)"
                          placeholder="使用全局配置"
                          clearable
                        >
                          <el-option label="是" :value="true" />
                          <el-option label="否" :value="false" />
                        </el-select>
                      </template>

                      <!-- Select 类型 -->
                      <template v-else-if="field.type === 'select'">
                        <el-select
                          :model-value="getOverrideValue(plugin.id, field.key)"
                          @update:model-value="setOverrideValue(plugin.id, field.key, $event)"
                          :placeholder="`全局: ${plugin.config[field.key] ?? '未设置'}`"
                          clearable
                        >
                          <el-option
                            v-for="opt in field.options"
                            :key="String(opt.value)"
                            :label="opt.label"
                            :value="opt.value"
                          />
                        </el-select>
                      </template>

                      <!-- Number 类型 -->
                      <template v-else-if="field.type === 'number'">
                        <el-input-number
                          :model-value="getOverrideValue(plugin.id, field.key)"
                          @update:model-value="setOverrideValue(plugin.id, field.key, $event)"
                          :placeholder="`全局: ${plugin.config[field.key] ?? ''}`"
                        />
                      </template>

                      <!-- Text/String 类型 (默认) -->
                      <template v-else>
                        <el-input
                          :model-value="getOverrideValue(plugin.id, field.key)"
                          @update:model-value="setOverrideValue(plugin.id, field.key, $event)"
                          :placeholder="`全局: ${plugin.config[field.key] ?? '未设置'}`"
                          clearable
                        />
                      </template>
                    </div>
                    <div v-if="field.description" class="field-hint">{{ field.description }}</div>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div v-else class="empty-hint">
            <k-icon name="apps" />
            <span>暂无可配置的插件</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <k-button @click="visible = false">取消</k-button>
        <k-button type="primary" @click="handleSave" :loading="saving">
          {{ isEdit ? '保存' : '创建' }}
        </k-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from '@koishijs/client'
import { ChannelConfig, ConfigField, ConnectorDefinition, MiddlewareInfo, FieldDefinition } from '../types'
import { channelApi, connectorApi, middlewareApi, pluginApi, PluginInfo } from '../api'
import TagInput from './TagInput.vue'
import ConfigRenderer from './ConfigRenderer.vue'

interface Props {
  modelValue: boolean
  channel?: ChannelConfig | null
}

const props = withDefaults(defineProps<Props>(), {
  channel: null
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

// 状态
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const isEdit = computed(() => !!props.channel?.id)
const activeTab = ref('basic')
const saving = ref(false)
const expandedPlugins = ref(new Set<string>())

// 数据
const connectors = ref<ConnectorDefinition[]>([])
const connectorFields = ref<Record<string, ConfigField[]>>({})
const allMiddlewares = ref<MiddlewareInfo[]>([])
const allPlugins = ref<PluginInfo[]>([])

// 表单
const form = ref<Partial<ChannelConfig>>({
  name: '',
  enabled: true,
  connectorId: '',
  connectorConfig: {},
  pluginOverrides: {},
  tags: []
})

// Tab 定义
const tabs = [
  { id: 'basic', label: '基本信息', icon: 'file-text' },
  { id: 'middlewares', label: '中间件流程', icon: 'git-branch' },
  { id: 'plugins', label: '插件配置', icon: 'puzzle' }
]

// 阶段定义
const phases = [
  { id: 'lifecycle-prepare', label: '准备', description: '验证、权限检查', icon: 'clipboard-check', colorClass: 'phase-prepare' },
  { id: 'lifecycle-pre-request', label: '预处理', description: '预设应用、参数处理', icon: 'settings', colorClass: 'phase-pre' },
  { id: 'lifecycle-request', label: '执行', description: '调用连接器生成', icon: 'play', colorClass: 'phase-request' },
  { id: 'lifecycle-post-request', label: '后处理', description: '结果缓存、格式转换', icon: 'package', colorClass: 'phase-post' },
  { id: 'lifecycle-finalize', label: '完成', description: '计费结算、记录保存', icon: 'check-circle', colorClass: 'phase-finalize' }
]

const categoryLabels: Record<string, string> = {
  billing: '计费模块',
  transform: '转换处理',
  validation: '验证检查',
  preset: '预设系统',
  cache: '缓存管理',
  recording: '任务记录',
  request: '请求执行',
  custom: '自定义'
}

// 计算属性
const currentConnectorFields = computed(() => {
  if (!form.value.connectorId) return []
  return connectorFields.value[form.value.connectorId] || []
})

const currentConnectorName = computed(() => {
  const connector = connectors.value.find(c => c.id === form.value.connectorId)
  return connector?.name || '连接器'
})

const availableTabs = computed(() => {
  return tabs.map(tab => {
    let badge = ''
    if (tab.id === 'middlewares') {
      badge = String(allMiddlewares.value.length)
    }
    if (tab.id === 'plugins' && pluginsWithConfig.value.length > 0) {
      badge = String(pluginsWithConfig.value.length)
    }
    return { ...tab, badge }
  })
})

const pluginsWithConfig = computed(() => {
  return allPlugins.value.filter(p => p.configFields && p.configFields.length > 0)
})

// 方法
const getPhaseMiddlewares = (phaseId: string) => {
  return allMiddlewares.value.filter(mw => mw.phase === phaseId)
}

const getMiddlewareEnabled = (pluginId: string, mwName: string) => {
  return form.value.pluginOverrides?.[pluginId]?.middlewares?.[mwName]
}

const setMiddlewareEnabled = (pluginId: string, mwName: string, value: boolean | undefined | null) => {
  if (!form.value.pluginOverrides) {
    form.value.pluginOverrides = {}
  }
  if (!form.value.pluginOverrides[pluginId]) {
    form.value.pluginOverrides[pluginId] = {}
  }
  if (!form.value.pluginOverrides[pluginId].middlewares) {
    form.value.pluginOverrides[pluginId].middlewares = {}
  }

  if (value === undefined || value === null) {
    delete form.value.pluginOverrides[pluginId].middlewares[mwName]
    if (Object.keys(form.value.pluginOverrides[pluginId].middlewares).length === 0) {
      delete form.value.pluginOverrides[pluginId].middlewares
    }
    if (Object.keys(form.value.pluginOverrides[pluginId]).length === 0) {
      delete form.value.pluginOverrides[pluginId]
    }
  } else {
    form.value.pluginOverrides[pluginId].middlewares[mwName] = value
  }
}

const getMiddlewareStatusClass = (mw: MiddlewareInfo) => {
  const override = getMiddlewareEnabled(mw.configGroup || mw.name, mw.name)
  if (override !== undefined) {
    return override ? 'active override' : 'override'
  }
  return mw.enabled ? 'active' : ''
}

const getOverrideValue = (groupId: string, fieldKey: string) => {
  return form.value.pluginOverrides?.[groupId]?.[fieldKey]
}

const setOverrideValue = (groupId: string, fieldKey: string, value: any) => {
  if (!form.value.pluginOverrides) {
    form.value.pluginOverrides = {}
  }
  if (!form.value.pluginOverrides[groupId]) {
    form.value.pluginOverrides[groupId] = {}
  }
  if (value === undefined || value === null || value === '') {
    delete form.value.pluginOverrides[groupId][fieldKey]
    if (Object.keys(form.value.pluginOverrides[groupId]).length === 0) {
      delete form.value.pluginOverrides[groupId]
    }
  } else {
    form.value.pluginOverrides[groupId][fieldKey] = value
  }
}

const hasPluginOverride = (pluginId: string) => {
  const override = form.value.pluginOverrides?.[pluginId]
  return override && Object.keys(override).length > 0
}

const clearPluginOverride = (pluginId: string) => {
  if (form.value.pluginOverrides) {
    delete form.value.pluginOverrides[pluginId]
  }
}

const togglePluginExpand = (pluginId: string) => {
  if (expandedPlugins.value.has(pluginId)) {
    expandedPlugins.value.delete(pluginId)
  } else {
    expandedPlugins.value.add(pluginId)
  }
}

const shouldShowOverrideField = (plugin: PluginInfo, field: FieldDefinition) => {
  if (!field.showWhen) return true
  const { field: dependField, value } = field.showWhen
  const overrideValue = form.value.pluginOverrides?.[plugin.id]?.[dependField]
  const globalValue = plugin.config[dependField]
  const effectiveValue = overrideValue !== undefined ? overrideValue : globalValue
  return effectiveValue === value
}

const handleConnectorChange = async (connectorId: string) => {
  form.value.connectorConfig = {}
  if (connectorId && !connectorFields.value[connectorId]) {
    try {
      const fields = await connectorApi.fields(connectorId)
      connectorFields.value[connectorId] = fields
    } catch (e) {
      console.error('Failed to load connector fields:', e)
    }
  }
}

const handleSave = async () => {
  if (!form.value.name) {
    message.error('请输入渠道名称')
    return
  }
  if (!form.value.connectorId) {
    message.error('请选择连接器')
    return
  }

  saving.value = true
  try {
    if (isEdit.value && props.channel?.id) {
      await channelApi.update(props.channel.id, form.value)
      message.success('保存成功')
    } else {
      await channelApi.create(form.value as Omit<ChannelConfig, 'id'>)
      message.success('创建成功')
    }
    emit('saved')
    visible.value = false
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    saving.value = false
  }
}

const handleClosed = () => {
  activeTab.value = 'basic'
  expandedPlugins.value.clear()
}

// 加载数据
const loadData = async () => {
  try {
    const [connectorsData, mwData, pluginsData] = await Promise.all([
      connectorApi.list(),
      middlewareApi.list(),
      pluginApi.list()
    ])
    connectors.value = connectorsData
    allMiddlewares.value = mwData
    allPlugins.value = pluginsData.filter(p =>
      (p.configFields && p.configFields.length > 0) ||
      (p.middlewares && p.middlewares.length > 0)
    )
  } catch (e) {
    console.error('Failed to load data:', e)
  }
}

// 监听
watch(() => props.modelValue, async (newVal) => {
  if (newVal) {
    await loadData()

    if (props.channel) {
      form.value = JSON.parse(JSON.stringify(props.channel))
      if (!form.value.pluginOverrides) {
        form.value.pluginOverrides = {}
      }
      if (!form.value.connectorConfig) {
        form.value.connectorConfig = {}
      }
      // 加载连接器字段（但不清空现有配置）
      if (form.value.connectorId && !connectorFields.value[form.value.connectorId]) {
        try {
          const fields = await connectorApi.fields(form.value.connectorId)
          connectorFields.value[form.value.connectorId] = fields
        } catch (e) {
          console.error('Failed to load connector fields:', e)
        }
      }
      // 默认展开有覆盖的插件
      for (const pluginId of Object.keys(form.value.pluginOverrides)) {
        expandedPlugins.value.add(pluginId)
      }
    } else {
      form.value = {
        name: '',
        enabled: true,
        connectorId: '',
        connectorConfig: {},
        pluginOverrides: {},
        tags: []
      }
    }
  }
})
</script>

<style scoped>
.channel-config-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.dialog-layout {
  display: flex;
  height: 560px;
}

/* Tab 导航 */
.tab-nav {
  width: 180px;
  flex-shrink: 0;
  background: var(--k-color-bg-2);
  border-right: 1px solid var(--k-color-border);
  padding: 1rem 0;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  cursor: pointer;
  color: var(--k-color-text-description);
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.tab-item:hover {
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
}

.tab-item.active {
  background: var(--k-card-bg);
  color: var(--k-color-active);
  border-left-color: var(--k-color-active);
}

.tab-item .k-icon {
  font-size: 16px;
}

.tab-badge {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--k-color-bg-1);
  border-radius: 10px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-item.active .tab-badge {
  background: var(--k-color-active);
  color: white;
}

/* 内容区 */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background: var(--k-card-bg);
}

.content-section {
  max-width: 560px;
}

.section-header {
  margin-bottom: 1.5rem;
}

.section-header h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--k-color-text);
}

.section-header p {
  margin: 0;
  font-size: 13px;
  color: var(--k-color-text-description);
}

/* 表单 */
.form-group {
  margin-bottom: 1.25rem;
}

.form-row {
  display: flex;
  gap: 1.5rem;
}

.flex-1 {
  flex: 1;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--k-color-text);
  font-weight: 500;
}

.form-label.required::after {
  content: '*';
  color: var(--k-color-error, #f56c6c);
  margin-left: 4px;
}

.form-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--k-color-text-description);
}

.switch-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
}

.switch-label {
  font-size: 13px;
  color: var(--k-color-text-description);
}

/* 分隔线 */
.section-divider {
  display: flex;
  align-items: center;
  margin: 1.5rem 0 1rem;
  font-size: 13px;
  font-weight: 500;
  color: var(--k-color-text);
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--k-color-border);
}

.section-divider::before {
  margin-right: 12px;
}

.section-divider::after {
  margin-left: 12px;
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 3rem;
  color: var(--k-color-text-description);
}

.empty-hint .k-icon {
  font-size: 2rem;
  opacity: 0.5;
}

/* 覆盖提示栏 */
.override-hint-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--k-color-bg-2);
  border-radius: 8px;
  font-size: 13px;
  color: var(--k-color-text-description);
  margin-bottom: 1.5rem;
}

.override-hint-bar .k-icon {
  color: var(--k-color-active);
}

/* 中间件流程 */
.pipeline-flow {
  display: flex;
  flex-direction: column;
}

.phase-section {
  display: flex;
  flex-direction: column;
}

.phase-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 10px;
  transition: all 0.2s;
}

.phase-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 16px;
}

.phase-prepare .phase-icon { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.phase-pre .phase-icon { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.phase-request .phase-icon { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.phase-post .phase-icon { background: rgba(249, 115, 22, 0.15); color: #f97316; }
.phase-finalize .phase-icon { background: rgba(99, 102, 241, 0.15); color: #6366f1; }

.phase-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.phase-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--k-color-text);
}

.phase-desc {
  font-size: 11px;
  color: var(--k-color-text-description);
}

.phase-badge {
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background: var(--k-color-bg-2);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--k-color-text-description);
  display: flex;
  align-items: center;
  justify-content: center;
}

.phase-middlewares {
  display: flex;
  flex-direction: column;
  margin-left: 24px;
  padding-left: 24px;
  border-left: 2px solid var(--k-color-border);
}

.mw-item {
  position: relative;
}

.mw-item::before {
  content: '';
  position: absolute;
  left: -25px;
  top: 50%;
  width: 12px;
  height: 2px;
  background: var(--k-color-border);
}

.mw-item.has-override::before {
  background: var(--k-color-active);
}

.mw-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin: 6px 0;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  transition: all 0.2s;
}

.mw-item.has-override .mw-card {
  border-color: var(--k-color-active);
  background: var(--k-color-active-bg);
}

.mw-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--k-color-text-description);
  flex-shrink: 0;
}

.mw-status.active {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
}

.mw-status.override {
  background: var(--k-color-active);
  box-shadow: 0 0 8px var(--k-color-active);
}

.mw-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.mw-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--k-color-text);
}

.mw-desc {
  font-size: 11px;
  color: var(--k-color-text-description);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mw-switch {
  width: 120px;
  flex-shrink: 0;
}

.empty-phase {
  margin-left: 24px;
  padding: 12px 24px;
  border-left: 2px dashed var(--k-color-border);
  color: var(--k-color-text-description);
  font-size: 12px;
  font-style: italic;
}

.phase-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
}

.connector-line {
  width: 2px;
  height: 8px;
  background: var(--k-color-border);
}

.connector-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--k-color-text-description);
  font-size: 12px;
}

.pipeline-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 1.5rem;
  padding: 12px 16px;
  background: var(--k-color-bg-2);
  border-radius: 10px;
}

.footer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--k-color-text-description);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--k-color-text-description);
}

.dot.active {
  background: #22c55e;
}

.dot.override {
  background: var(--k-color-active);
}

/* 插件配置列表 */
.plugins-override-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plugin-override-card {
  border: 1px solid var(--k-color-border);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s;
}

.plugin-override-card.expanded {
  border-color: var(--k-color-active);
}

.plugin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--k-color-bg-2);
  cursor: pointer;
  transition: background 0.2s;
}

.plugin-header:hover {
  background: var(--k-color-bg-1);
}

.plugin-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plugin-name {
  font-weight: 500;
  color: var(--k-color-text);
}

.override-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--k-color-active);
  color: white;
  border-radius: 10px;
}

.plugin-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugin-config-fields {
  padding: 16px;
  background: var(--k-card-bg);
  border-top: 1px solid var(--k-color-border);
}

.override-field-row {
  margin-bottom: 1rem;
}

.override-field-row:last-child {
  margin-bottom: 0;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--k-color-text);
  font-weight: 500;
}

.field-input {
  width: 100%;
}

.field-input .el-select,
.field-input .el-input {
  width: 100%;
}

.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--k-color-text-description);
}

/* 底部按钮 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
