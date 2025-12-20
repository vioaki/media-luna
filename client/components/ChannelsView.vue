<template>
  <div class="ml-view-container">
    <div class="ml-view-header">
      <div class="ml-header-left">
        <k-button solid type="primary" @click="openCreateDialog">
          <template #icon><k-icon name="add"></k-icon></template>
          新建渠道
        </k-button>
        <TagFilter
          v-model="selectedTags"
          :all-tags="allTags"
          :preset-tags="presetTags"
        />
      </div>
      <div class="ml-header-right">
        <ViewModeSwitch v-model="viewMode" />
      </div>
    </div>

    <div class="ml-view-content">
      <LoadingState v-if="loading" />

      <!-- 卡片视图 -->
      <div v-else-if="viewMode === 'card'" class="ml-grid">
        <div v-for="channel in filteredChannels" :key="channel.id">
          <div class="ml-card ml-card--clickable" @click="openEditDialog(channel)">
            <div class="card-header">
              <div class="header-main">
                <div class="channel-name">
                  {{ channel.name }}
                </div>
                <el-switch v-model="channel.enabled" size="small" @change="toggleEnable(channel)" @click.stop />
              </div>
              <div class="header-meta">
                <span class="connector-badge">
                  <k-icon name="link"></k-icon> {{ getConnectorName(channel.connectorId) }}
                </span>
                <!-- 中间件字段（如费用）显示在标题旁 -->
                <template v-for="field in middlewareCardFields" :key="`mw-${field.key}`">
                  <span class="cost-badge" v-if="field.key === 'cost'">
                    {{ formatFieldValue(getCardFieldValue(channel, field), field.format, getCurrencySuffix(channel, field)) }}
                  </span>
                </template>
              </div>
            </div>

            <div class="card-body">
              <!-- 配置字段列表 -->
              <div class="field-list" v-if="getCardFields(channel).length">
                <div v-for="field in getCardFields(channel)" :key="field.key" class="field-item">
                  <span class="field-label">{{ field.label }}</span>
                  <span class="field-value">{{ formatFieldValue(channel.connectorConfig[field.key], field.format) }}</span>
                </div>
              </div>

              <!-- 标签 -->
              <div class="tags-list" v-if="channel.tags && channel.tags.length">
                <span v-for="tag in channel.tags" :key="tag" class="tag-pill">{{ tag }}</span>
              </div>
            </div>

            <div class="card-footer" @click.stop>
              <k-button size="mini" class="ml-btn-outline-primary" @click="copyChannel(channel)">
                <template #icon><k-icon name="copy"></k-icon></template>
                复制
              </k-button>
              <div class="spacer"></div>
              <k-button size="mini" class="ml-btn-outline-danger" @click="confirmDelete(channel)">
                 <template #icon><k-icon name="delete"></k-icon></template>
                 删除
              </k-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-else class="ml-table-container">
        <table class="ml-table">
          <thead>
            <tr>
              <th class="col-name">名称</th>
              <th class="col-connector">连接器</th>
              <th class="col-tags">标签</th>
              <th class="col-cost">费用</th>
              <th class="col-status">状态</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="channel in filteredChannels"
              :key="channel.id"
              @click="openEditDialog(channel)"
            >
              <td class="col-name">
                <span class="name-text">{{ channel.name }}</span>
              </td>
              <td class="col-connector">
                <span class="connector-badge">{{ getConnectorName(channel.connectorId) }}</span>
              </td>
              <td class="col-tags">
                <div class="tags-wrapper">
                  <span v-for="tag in (channel.tags || []).slice(0, 2)" :key="tag" class="mini-tag">{{ tag }}</span>
                  <span v-if="channel.tags && channel.tags.length > 2" class="mini-tag more">+{{ channel.tags.length - 2 }}</span>
                </div>
              </td>
              <td class="col-cost">
                <template v-for="field in middlewareCardFields" :key="`mw-${field.key}`">
                  <span v-if="field.key === 'cost'" class="cost-value">
                    {{ formatFieldValue(getCardFieldValue(channel, field), field.format, getCurrencySuffix(channel, field)) }}
                  </span>
                </template>
              </td>
              <td class="col-status" @click.stop>
                <el-switch v-model="channel.enabled" size="small" @change="toggleEnable(channel)" />
              </td>
              <td class="col-actions" @click.stop>
                <div class="action-btns">
                  <k-button size="mini" class="ml-btn-outline-primary" @click="copyChannel(channel)">
                    <template #icon><k-icon name="copy"></k-icon></template>
                    复制
                  </k-button>
                  <k-button size="mini" class="ml-btn-outline-danger" @click="confirmDelete(channel)">
                    <template #icon><k-icon name="delete"></k-icon></template>
                    删除
                  </k-button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 编辑/创建对话框 -->
    <ChannelConfigDialog
      v-model="dialogVisible"
      :channel="editingChannel"
      @saved="handleDialogSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from '@koishijs/client'
import { ChannelConfig, ConfigField, ConnectorDefinition, CardField } from '../types'
import { channelApi, connectorApi, middlewareApi } from '../api'
import TagFilter from './TagFilter.vue'
import ViewModeSwitch, { type ViewMode } from './ViewModeSwitch.vue'
import ChannelConfigDialog from './ChannelConfigDialog.vue'
import LoadingState from './LoadingState.vue'

// 预置标签
const presetTags = ['text2img', 'img2img', 'NSFW']

// 状态
const loading = ref(false)
const viewMode = ref<ViewMode>('card')
const channels = ref<ChannelConfig[]>([])
const connectors = ref<ConnectorDefinition[]>([])
const middlewareCardFields = ref<CardField[]>([])
const middlewareGlobalConfigs = ref<Record<string, Record<string, any>>>({})
const dialogVisible = ref(false)
const editingChannel = ref<ChannelConfig | null>(null)
const selectedTags = ref<string[]>([])

// 从所有渠道中提取标签
const allTags = computed(() => {
  const tagSet = new Set<string>()
  channels.value.forEach(c => {
    (c.tags || []).forEach(t => tagSet.add(t))
  })
  return Array.from(tagSet).sort()
})

// 计算属性
const filteredChannels = computed(() => {
  if (selectedTags.value.length === 0) return channels.value
  return channels.value.filter(c =>
    selectedTags.value.every(tag => (c.tags || []).includes(tag))
  )
})

// 方法
const getConnectorName = (id: string) => {
  const c = connectors.value.find(x => x.id === id)
  return c ? c.name : id
}

/** 获取渠道卡片需要展示的字段 */
const getCardFields = (channel: ChannelConfig) => {
  const connector = connectors.value.find(c => c.id === channel.connectorId)
  if (!connector?.cardFields?.length) return []

  return connector.cardFields.map(cf => {
    const fieldDef = connector.fields.find(f => f.key === cf.key)
    return {
      key: cf.key,
      label: cf.label || fieldDef?.label || cf.key,
      format: cf.format || 'text'
    }
  })
}

/** 获取卡片展示字段的值 */
const getCardFieldValue = (channel: ChannelConfig, field: CardField): any => {
  const groupId = field.configGroup

  switch (field.source) {
    case 'channel':
      if (groupId) {
        const overrideValue = channel.pluginOverrides?.[groupId]?.[field.key]
        if (overrideValue !== undefined) {
          return overrideValue
        }
      }
      return (channel as any)[field.key]

    case 'connectorConfig':
      return channel.connectorConfig?.[field.key]

    case 'pluginOverride':
      if (groupId) {
        return channel.pluginOverrides?.[groupId]?.[field.key]
      }
      return undefined

    default:
      return undefined
  }
}

/** 获取货币后缀 */
const getCurrencySuffix = (channel: ChannelConfig, field: CardField): string => {
  const groupId = field.configGroup
  if (!groupId) return field.suffix || ''

  const overrideLabel = channel.pluginOverrides?.[groupId]?.currencyLabel
  if (overrideLabel) {
    return ` ${overrideLabel}${field.suffix || ''}`
  }

  const globalLabel = middlewareGlobalConfigs.value[groupId]?.currencyLabel
  if (globalLabel) {
    return ` ${globalLabel}${field.suffix || ''}`
  }

  return ` 积分${field.suffix || ''}`
}

/** 格式化字段值用于展示 */
const formatFieldValue = (value: any, format?: string, suffix?: string): string => {
  if (value === undefined || value === null || value === '') {
    return '-'
  }

  let result: string
  switch (format) {
    case 'password-mask':
      result = '••••••'
      break
    case 'boolean':
      result = value ? '是' : '否'
      break
    case 'number':
      result = String(value)
      break
    case 'size':
      result = String(value)
      break
    case 'currency':
      result = value === 0 ? '免费' : String(value)
      break
    default:
      result = String(value)
  }

  return suffix ? `${result} ${suffix}` : result
}

const fetchData = async () => {
  loading.value = true
  try {
    const [channelsData, connectorsData, mwCardFieldsResponse] = await Promise.all([
      channelApi.list(),
      connectorApi.list(),
      middlewareApi.cardFields()
    ])
    channels.value = channelsData
    connectors.value = connectorsData
    middlewareCardFields.value = mwCardFieldsResponse.fields
    middlewareGlobalConfigs.value = mwCardFieldsResponse.globalConfigs
  } catch (e) {
    message.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  editingChannel.value = null
  dialogVisible.value = true
}

const openEditDialog = (channel: ChannelConfig) => {
  editingChannel.value = channel
  dialogVisible.value = true
}

const handleDialogSaved = () => {
  fetchData()
}

const confirmDelete = async (channel: ChannelConfig) => {
  if (!confirm(`确定要删除渠道 "${channel.name}" 吗？`)) return
  try {
    await channelApi.delete(channel.id)
    message.success('删除成功')
    fetchData()
  } catch (e) {
    message.error('删除失败')
  }
}

const toggleEnable = async (channel: ChannelConfig) => {
  try {
    await channelApi.toggle(channel.id, channel.enabled)
  } catch (e) {
    channel.enabled = !channel.enabled
    message.error('操作失败')
  }
}

const copyChannel = (channel: ChannelConfig) => {
  const copied = JSON.parse(JSON.stringify(channel))
  delete copied.id
  copied.name = `${channel.name} (副本)`
  editingChannel.value = copied
  dialogVisible.value = true
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
@import '../styles/shared.css';

/* ========== 渠道卡片特有样式 ========== */

/* 卡片内部布局 */
.card-header {
  padding: 1rem 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.header-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.channel-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--k-color-text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.connector-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 2px 8px;
  background-color: var(--k-color-bg-2);
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--k-color-text-description);
}

.cost-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background-color: var(--k-color-success-light, rgba(103, 194, 58, 0.1));
  color: var(--k-color-success, #67c23a);
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.card-body {
  flex-grow: 1;
  padding: 0 1.25rem 1rem;
  min-height: 40px;
}

/* 字段列表样式 */
.field-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.field-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  padding: 0.25rem 0;
  border-bottom: 1px dashed var(--k-color-border);
}

.field-item:last-child {
  border-bottom: none;
}

.field-label {
  color: var(--k-color-text-description);
}

.field-value {
  font-weight: 500;
  color: var(--k-color-text);
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-pill {
  font-size: 0.75rem;
  padding: 1px 6px;
  color: var(--k-color-text-description);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
  background-color: transparent;
}

.card-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--k-color-border);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: rgba(0, 0, 0, 0.02);
}

.spacer {
  flex-grow: 1;
}

/* ========== 列表视图特有样式 ========== */

/* 表格列宽定义 */
.col-name { width: 20%; }
.col-connector { width: 15%; }
.col-tags { width: auto; }
.col-cost { width: 12%; }
.col-status { width: 8%; }
.col-actions { width: 15%; }

.name-text {
  font-weight: 600;
  color: var(--k-color-text);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mini-tag {
  font-size: 0.7rem;
  padding: 1px 6px;
  color: var(--k-color-text-description);
  border: 1px solid var(--k-color-border);
  border-radius: 10px;
  background-color: transparent;
}

.mini-tag.more {
  background-color: var(--k-color-bg-2);
}

.cost-value {
  font-size: 0.85rem;
  color: var(--k-color-success, #67c23a);
  font-weight: 500;
}

.action-btns {
  display: flex;
  gap: 0.5rem;
}
</style>