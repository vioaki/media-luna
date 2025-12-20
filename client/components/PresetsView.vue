<template>
  <div class="ml-view-container">
    <div class="ml-view-header">
      <div class="ml-header-left">
        <k-button solid type="primary" @click="openCreateDialog">
          <template #icon><k-icon name="add"></k-icon></template>
          新建预设
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
      <div v-if="loading" class="loading-state">
        <k-icon name="sync" class="ml-spin"></k-icon> 加载中...
      </div>

      <!-- 卡片视图 (瀑布流) -->
      <div v-else-if="viewMode === 'card'" class="ml-masonry">
        <div v-for="preset in filteredPresets" :key="preset.id" class="ml-masonry-item">
          <div class="preset-card" @click="openEditDialog(preset)">
            <!-- 缩略图 -->
            <div class="card-thumbnail" v-if="preset.thumbnail">
              <img :src="preset.thumbnail" :alt="preset.name" loading="lazy" />
              <div class="thumbnail-overlay">
                <span class="ref-count" v-if="preset.referenceImages?.length">
                  <k-icon name="image"></k-icon> {{ preset.referenceImages.length }}
                </span>
              </div>
            </div>
            <div class="card-thumbnail placeholder" v-else>
              <k-icon name="image" class="placeholder-icon"></k-icon>
            </div>

            <!-- 内容 -->
            <div class="card-content">
              <div class="card-title">{{ preset.name }}</div>
              <div class="card-tags" v-if="preset.tags?.length">
                <span v-for="tag in preset.tags.slice(0, 4)" :key="tag" class="mini-tag">
                  {{ tag }}
                </span>
                <span v-if="preset.tags.length > 4" class="mini-tag more">+{{ preset.tags.length - 4 }}</span>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="card-actions" @click.stop>
              <el-switch
                v-model="preset.enabled"
                size="small"
                @change="toggleEnable(preset)"
              />
              <k-button size="mini" class="ml-btn-outline-primary" @click="copyPreset(preset)">
                <template #icon><k-icon name="copy"></k-icon></template>
                复制
              </k-button>
              <k-button
                v-if="preset.source === 'user'"
                size="mini"
                class="ml-btn-outline-danger"
                @click="confirmDelete(preset)"
              >
                <template #icon><k-icon name="delete"></k-icon></template>
                删除
              </k-button>
            </div>

            <!-- 来源标记 -->
            <div class="source-indicator" :class="preset.source">
              {{ preset.source === 'api' ? '远程' : '本地' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-else class="ml-table-container">
        <table class="ml-table">
          <thead>
            <tr>
              <th class="col-thumb">缩略图</th>
              <th class="col-name">名称</th>
              <th class="col-template">Prompt 模板</th>
              <th class="col-refs">参考图</th>
              <th class="col-source">来源</th>
              <th class="col-status">状态</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="preset in filteredPresets"
              :key="preset.id"
              @click="openEditDialog(preset)"
            >
              <td class="col-thumb">
                <div class="thumb-wrapper">
                  <img v-if="preset.thumbnail" :src="preset.thumbnail" :alt="preset.name" />
                  <div v-else class="thumb-placeholder">
                    <k-icon name="image"></k-icon>
                  </div>
                </div>
              </td>
              <td class="col-name">
                <span class="name-text">{{ preset.name }}</span>
              </td>
              <td class="col-template">
                <span class="template-preview">{{ truncateTemplate(preset.promptTemplate) }}</span>
              </td>
              <td class="col-refs">
                <span v-if="preset.referenceImages?.length" class="ref-badge">
                  <k-icon name="image"></k-icon>
                  {{ preset.referenceImages.length }}
                </span>
                <span v-else class="no-data">-</span>
              </td>
              <td class="col-source">
                <span class="source-badge" :class="preset.source">
                  {{ preset.source === 'api' ? '远程' : '本地' }}
                </span>
              </td>
              <td class="col-status" @click.stop>
                <el-switch v-model="preset.enabled" size="small" @change="toggleEnable(preset)" />
              </td>
              <td class="col-actions" @click.stop>
                <div class="action-btns">
                  <k-button size="mini" class="ml-btn-outline-primary" @click="copyPreset(preset)">
                    <template #icon><k-icon name="copy"></k-icon></template>
                    复制
                  </k-button>
                  <k-button
                    v-if="preset.source === 'user'"
                    size="mini"
                    class="ml-btn-outline-danger"
                    @click="confirmDelete(preset)"
                  >
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
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑预设' : '创建预设'"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" label-width="100px" v-if="dialogVisible">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" :disabled="isEdit && form.source === 'api'" placeholder="如 二次元少女"></el-input>
          <div class="form-tip">用于指令调用和展示，冲突时会自动添加后缀</div>
        </el-form-item>

        <el-form-item label="Prompt 模板" required>
          <el-input
            v-model="form.promptTemplate"
            type="textarea"
            :rows="4"
            placeholder="输入提示词模板，支持变量如 {prompt}"
          ></el-input>
          <div class="form-tip">默认将用户输入附加在最后，也可使用 {prompt} 指定位置</div>
        </el-form-item>

        <el-form-item label="缩略图" v-if="form.source === 'user'">
          <ImageUpload v-model="thumbnailImages" :max-count="1" />
          <div class="form-tip">用于在卡片视图中展示预设的预览图</div>
        </el-form-item>

        <el-form-item label="参考图">
          <ImageUpload v-model="form.referenceImages!" :max-count="5" />
          <div class="form-tip">生成时会自动附加这些参考图片</div>
        </el-form-item>

        <el-divider content-position="left">高级设置</el-divider>

        <el-form-item label="标签">
          <TagInput v-model="form.tags!" placeholder="输入标签..." />
          <div class="form-tip">与渠道标签匹配时会自动关联</div>
        </el-form-item>

        <el-form-item label="参数覆盖">
           <JsonEditor v-model="form.parameterOverrides" :rows="3" />
        </el-form-item>

        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled"></el-switch>
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <k-button @click="dialogVisible = false">取消</k-button>
          <k-button type="primary" @click="submitForm">保存</k-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { message } from '@koishijs/client'
import { PresetData } from '../types'
import { presetApi, cacheApi } from '../api'
import TagInput from './TagInput.vue'
import JsonEditor from './JsonEditor.vue'
import TagFilter from './TagFilter.vue'
import ViewModeSwitch, { type ViewMode } from './ViewModeSwitch.vue'
import ImageUpload from './ImageUpload.vue'

// 预置标签（包含来源虚拟标签）
const presetTags = ['本地', '远程', 'text2img', 'img2img', 'NSFW']

// 状态
const loading = ref(false)
const presets = ref<PresetData[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const selectedTags = ref<string[]>([])
const viewMode = ref<ViewMode>('card')

// 从所有预设中提取标签
const allTags = computed(() => {
  const tagSet = new Set<string>()
  presets.value.forEach(p => {
    (p.tags || []).forEach(t => tagSet.add(t))
  })
  return Array.from(tagSet).sort()
})

// 表单数据
const form = ref<Partial<PresetData>>({
  name: '',
  promptTemplate: '',
  referenceImages: [],
  tags: [],
  parameterOverrides: {},
  enabled: true,
  source: 'user'
})

// 缩略图作为数组处理（兼容 ImageUpload 组件）
const thumbnailImages = ref<string[]>([])

// 监听表单变化，同步缩略图
watch(() => form.value.thumbnail, (newVal) => {
  thumbnailImages.value = newVal ? [newVal] : []
}, { immediate: true })

// 监听缩略图数组变化，同步到表单
watch(thumbnailImages, (newVal) => {
  form.value.thumbnail = newVal.length > 0 ? newVal[0] : ''
})

// 计算属性
const filteredPresets = computed(() => {
  if (selectedTags.value.length === 0) return presets.value

  return presets.value.filter(p => {
    return selectedTags.value.every(tag => {
      // 虚拟标签：本地/远程
      if (tag === '本地') return p.source === 'user'
      if (tag === '远程') return p.source === 'api'
      // 普通标签匹配
      return (p.tags || []).includes(tag)
    })
  })
})

// 方法
const fetchData = async () => {
  loading.value = true
  try {
    presets.value = await presetApi.list()
  } catch (e) {
    message.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  isEdit.value = false
  form.value = {
    name: '',
    promptTemplate: '',
    referenceImages: [],
    tags: [],
    parameterOverrides: {},
    enabled: true,
    source: 'user'
  }
  dialogVisible.value = true
}

const openEditDialog = (preset: PresetData) => {
  isEdit.value = true
  form.value = JSON.parse(JSON.stringify(preset))
  dialogVisible.value = true
}

// 复制预设 - 打开新建对话框并填充已有配置
const copyPreset = (preset: PresetData) => {
  isEdit.value = false
  // 复制配置但不复制 id，并重命名，标记为用户创建
  const copied = JSON.parse(JSON.stringify(preset))
  delete copied.id
  copied.name = `${preset.name} (副本)`
  copied.source = 'user'  // 复制的预设归为用户预设
  form.value = copied
  dialogVisible.value = true
}

const toggleEnable = async (preset: PresetData) => {
  try {
    await presetApi.toggle(preset.id, preset.enabled)
  } catch (e) {
    preset.enabled = !preset.enabled
    message.error('操作失败')
  }
}

// 截断模板文本用于列表显示
const truncateTemplate = (template: string, maxLen = 50): string => {
  if (!template) return '-'
  const cleaned = template.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen) + '...'
}

const submitForm = async () => {
  if (!form.value.name || !form.value.promptTemplate) {
    message.warning('请填写必要信息')
    return
  }

  try {
    if (isEdit.value && form.value.id) {
      await presetApi.update(form.value.id, form.value)
      message.success('更新成功')
    } else {
      await presetApi.create(form.value as any)
      message.success('创建成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (e) {
    message.error('操作失败')
  }
}

const confirmDelete = async (preset: PresetData) => {
  if (!confirm(`确定要删除预设 "${preset.name}" 吗？`)) return
  try {
    await presetApi.delete(preset.id)
    message.success('删除成功')
    fetchData()
  } catch (e) {
    message.error('删除失败')
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
@import '../styles/shared.css';

/* ========== 预设卡片特有样式 ========== */

.preset-card {
  background-color: var(--k-color-bg-1);
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.preset-card:hover {
  border-color: var(--k-color-active);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-thumbnail {
  width: 100%;
  aspect-ratio: auto;
  position: relative;
  overflow: hidden;
  background-color: var(--k-color-bg-2);
}

.card-thumbnail img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

.card-thumbnail.placeholder {
  aspect-ratio: 4/3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 2rem;
  color: var(--k-color-text-description);
  opacity: 0.5;
}

.thumbnail-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.5rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  display: flex;
  justify-content: flex-end;
}

.ref-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 2px 6px;
  border-radius: 4px;
}

.card-content {
  padding: 0.75rem;
}

.card-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mini-tag {
  font-size: 0.7rem;
  padding: 2px 6px;
  background-color: var(--k-color-bg-2);
  color: var(--k-color-text-description);
  border-radius: 4px;
}

.mini-tag.more {
  background-color: var(--k-color-active);
  color: white;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--k-color-border);
  background-color: var(--k-color-bg-2);
}

.source-indicator {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.source-indicator.api {
  background-color: var(--k-color-active);
  color: white;
}

.source-indicator.user {
  background-color: var(--k-color-warning, #e6a23c);
  color: white;
}

/* ========== 列表视图特有样式 ========== */

/* 表格列宽定义 */
.col-thumb { width: 60px; }
.col-name { width: 15%; }
.col-template { width: auto; }
.col-refs { width: 10%; text-align: center !important; }
.col-source { width: 10%; }
.col-status { width: 8%; }
.col-actions { width: 15%; }

th.col-refs { text-align: center !important; }

.thumb-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--k-color-bg-2);
}

.thumb-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.name-text {
  font-weight: 600;
  color: var(--k-color-text);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-preview {
  font-size: 0.85rem;
  color: var(--k-color-text-description);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.action-btns {
  display: flex;
  gap: 0.5rem;
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--k-color-text-description);
  gap: 0.5rem;
}

/* 表单样式 */
.form-tip {
  font-size: 0.8rem;
  color: var(--k-color-text-description);
  margin-top: 0.25rem;
}

/* 表格内元素样式 */
.thumb-placeholder {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--k-color-bg-2);
  border-radius: 4px;
  color: var(--k-color-text-description);
}

.source-badge {
  display: inline-block;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
}

.source-badge.api {
  background-color: var(--k-color-active);
  color: white;
}

.source-badge.user {
  background-color: var(--k-color-warning, #e6a23c);
  color: white;
}

.no-data {
  color: var(--k-color-text-description);
  opacity: 0.5;
}

.ref-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--k-color-text-description);
  background-color: var(--k-color-bg-2);
  padding: 2px 8px;
  border-radius: 4px;
}
</style>
