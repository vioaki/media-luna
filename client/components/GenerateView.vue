<template>
  <div class="view-container">
    <div class="view-content">
      <div class="generate-layout">
        <!-- 左侧配置区 -->
        <div class="config-panel">
          <k-card class="config-card">
            <div class="form-section">
              <div class="section-title">
                <k-icon name="settings"></k-icon> 基础配置
              </div>

              <div class="form-item">
                <div class="label">生成渠道</div>
                <el-select v-model="form.channel" placeholder="选择生成渠道" style="width: 100%">
                  <el-option
                    v-for="channel in channels"
                    :key="channel.id"
                    :label="channel.name"
                    :value="channel.id"
                  />
                </el-select>
              </div>

              <div class="form-item">
                <div class="label">预设模板</div>
                <PresetPicker v-model="presetId" :presets="presets" />
              </div>
            </div>

            <div class="form-section flex-grow">
              <div class="section-title">
                 <k-icon name="edit"></k-icon> 提示词
              </div>
              <el-input
                v-model="form.prompt"
                type="textarea"
                :rows="8"
                placeholder="输入提示词，支持自然语言描述..."
                resize="none"
                class="prompt-input"
              ></el-input>
            </div>

            <!-- 文件上传区域 -->
            <div class="form-section">
              <div class="section-title">
                <k-icon name="image"></k-icon> 参考图片
              </div>
              <div class="upload-area">
                <!-- 已上传的图片列表 -->
                <div class="upload-list" v-if="fileList.length > 0">
                  <div v-for="(file, index) in fileList" :key="file.uid" class="upload-item">
                    <img :src="file.url" class="upload-thumb" />
                    <div class="upload-overlay" @click="removeFile(index)">
                      <k-icon name="delete"></k-icon>
                    </div>
                  </div>
                </div>
                <!-- 上传按钮 -->
                <div
                  v-if="fileList.length < 4"
                  class="upload-trigger"
                  @click="triggerUpload"
                  @dragover.prevent
                  @drop.prevent="handleDrop"
                >
                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    multiple
                    style="display: none"
                    @change="handleFileSelect"
                  />
                  <k-icon name="add" class="upload-icon"></k-icon>
                </div>
                <div class="upload-tip">点击或拖拽上传，最多 4 张</div>
              </div>
            </div>

            <div class="form-actions">
              <k-button solid type="primary" :loading="generating" @click="generate" class="generate-btn">
                <template #icon><k-icon name="magic"></k-icon></template>
                生成图片
              </k-button>
            </div>
          </k-card>
        </div>

        <!-- 右侧预览区 -->
        <div class="preview-panel">
          <!-- 生成中状态 -->
          <div v-if="generating" class="generating-state">
            <div class="generating-content">
              <div class="loader"></div>
              <div class="generating-info">
                <p class="generating-title">正在生成中...</p>
                <p class="generating-timer">
                  <k-icon name="stopwatch"></k-icon>
                  已用时间: {{ formatElapsedTime(elapsedTime) }}
                </p>
                <p class="generating-hint" v-if="currentTaskId">任务 ID: {{ currentTaskId }}</p>
              </div>
            </div>
          </div>

          <!-- 有结果 -->
          <div v-else-if="result" class="result-container">
            <!-- 成功状态 -->
            <div v-if="result.success && result.output && result.output.length" class="success-result">
              <div class="output-grid">
                <div v-for="(asset, idx) in result.output" :key="idx" class="output-wrapper">
                  <!-- 图片 -->
                  <template v-if="asset.kind === 'image'">
                    <img :src="asset.url" @click="openImagePreview(idx)" class="clickable-image" />
                    <div class="output-actions">
                      <a :href="asset.url" target="_blank" class="action-btn" download>
                        <k-icon name="download"></k-icon>
                      </a>
                    </div>
                  </template>
                  <!-- 视频 -->
                  <template v-else-if="asset.kind === 'video'">
                    <video :src="asset.url" controls class="output-video" />
                  </template>
                  <!-- 音频 -->
                  <template v-else-if="asset.kind === 'audio'">
                    <audio :src="asset.url" controls class="output-audio" />
                  </template>
                  <!-- 其他文件 -->
                  <template v-else-if="asset.kind === 'file'">
                    <a :href="asset.url" target="_blank" class="file-link">
                      <k-icon name="file"></k-icon>
                      {{ asset.meta?.filename || '下载文件' }}
                    </a>
                  </template>
                  <!-- 文本 -->
                  <template v-else-if="asset.kind === 'text'">
                    <div class="text-output">{{ asset.content }}</div>
                  </template>
                  <!-- 兜底：有 url 则显示链接 -->
                  <template v-else-if="asset.url">
                    <a :href="asset.url" target="_blank">{{ asset.url }}</a>
                  </template>
                </div>
              </div>
              <div class="result-meta">
                <span class="meta-item success-badge">
                  <k-icon name="check-circle"></k-icon> 生成成功
                </span>
                <span class="meta-item" v-if="result.duration">
                  <k-icon name="stopwatch"></k-icon> 耗时: {{ formatElapsedTime(result.duration) }}
                </span>
                <span class="meta-item" v-if="result.taskId">
                  <k-icon name="list-alt"></k-icon> 任务 ID: {{ result.taskId }}
                </span>
              </div>
            </div>

            <!-- 失败状态 -->
            <div v-else class="error-result">
              <div class="error-content">
                <k-icon name="exclamation-triangle" class="error-icon"></k-icon>
                <div class="error-info">
                  <p class="error-title">生成失败</p>
                  <p class="error-msg">{{ result.error || '未知错误' }}</p>
                  <p class="error-meta" v-if="result.taskId">任务 ID: {{ result.taskId }}</p>
                  <p class="error-meta" v-if="result.duration">耗时: {{ formatElapsedTime(result.duration) }}</p>
                </div>
              </div>
              <k-button class="retry-btn" @click="generate">
                <template #icon><k-icon name="refresh"></k-icon></template>
                重新生成
              </k-button>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="empty-state">
            <k-icon name="image" class="empty-icon"></k-icon>
            <p>在左侧配置并点击生成</p>
          </div>
        </div>

        <!-- 右侧历史画廊 -->
        <HistoryGallery ref="historyGalleryRef" @select="handleHistorySelect" />
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <ImageLightbox
      v-model:visible="lightboxVisible"
      :images="lightboxImages"
      :initial-index="lightboxIndex"
      :prompt="lightboxPrompt"
      :duration="result?.duration"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { message } from '@koishijs/client'
import { ChannelConfig, PresetData, GenerationResult, ClientFileData } from '../types'
import { channelApi, presetApi, generateApi, taskApi } from '../api'
import HistoryGallery from './HistoryGallery.vue'
import ImageLightbox from './ImageLightbox.vue'
import PresetPicker from './PresetPicker.vue'

/** 本地文件项 */
interface LocalFile {
  uid: number
  url: string
  raw: File
}

const channels = ref<ChannelConfig[]>([])
const presets = ref<PresetData[]>([])
const generating = ref(false)
const result = ref<GenerationResult | null>(null)
const fileList = ref<LocalFile[]>([])
const uploadedFiles = ref<ClientFileData[]>([])
const fileInput = ref<HTMLInputElement>()
const historyGalleryRef = ref<InstanceType<typeof HistoryGallery>>()
let fileUid = 0

// 计时器相关
const elapsedTime = ref(0)
const currentTaskId = ref<number | null>(null)
let timerInterval: ReturnType<typeof setInterval> | null = null
let startTime = 0

const form = ref({
  channel: undefined as number | undefined,
  prompt: '',
  parameters: {}
})

const presetId = ref<number | undefined>(undefined)

// Lightbox 状态
const lightboxVisible = ref(false)
const lightboxImages = ref<string[]>([])
const lightboxIndex = ref(0)
const lightboxPrompt = ref('')  // 存储最终提示词

// 格式化耗时
const formatElapsedTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = (seconds % 60).toFixed(0)
  return `${minutes}m ${remainingSeconds}s`
}

// 开始计时
const startTimer = () => {
  startTime = Date.now()
  elapsedTime.value = 0
  timerInterval = setInterval(() => {
    elapsedTime.value = Date.now() - startTime
  }, 100)
}

// 停止计时
const stopTimer = () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

// 打开图片预览
const openImagePreview = (index: number) => {
  if (result.value?.output) {
    // 只获取图片类型的资源
    lightboxImages.value = result.value.output
      .filter(a => a.kind === 'image' && a.url)
      .map(a => a.url!)
    lightboxIndex.value = index
    lightboxVisible.value = true
  }
}

const fetchData = async () => {
  try {
    const [channelsData, presetsData] = await Promise.all([
      channelApi.list(),
      presetApi.list()
    ])
    channels.value = channelsData
    presets.value = presetsData
  } catch (e) {
    console.error(e)
  }
}

// 文件转 base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // 提取 base64 部分 (去掉 data:xxx;base64, 前缀)
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 触发文件选择
const triggerUpload = () => {
  fileInput.value?.click()
}

// 处理文件选择
const handleFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  await addFiles(Array.from(input.files))
  input.value = '' // 清空以便再次选择同一文件
}

// 处理拖拽
const handleDrop = async (e: DragEvent) => {
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  await addFiles(Array.from(files).filter(f => f.type.startsWith('image/')))
}

// 添加文件
const addFiles = async (files: File[]) => {
  const remaining = 4 - fileList.value.length
  if (remaining <= 0) {
    message.warning('最多上传 4 张图片')
    return
  }

  const toAdd = files.slice(0, remaining)

  for (const file of toAdd) {
    const url = URL.createObjectURL(file)
    fileList.value.push({
      uid: ++fileUid,
      url,
      raw: file
    })

    try {
      const base64 = await fileToBase64(file)
      uploadedFiles.value.push({
        type: 'image',
        base64,
        mimeType: file.type,
        filename: file.name
      })
    } catch (e) {
      console.error('Failed to read file:', file.name, e)
    }
  }
}

// 移除文件
const removeFile = (index: number) => {
  const file = fileList.value[index]
  if (file) {
    URL.revokeObjectURL(file.url)
    fileList.value.splice(index, 1)
    uploadedFiles.value.splice(index, 1)
  }
}

// 尝试通过 taskId 获取结果
const fetchTaskResult = async (taskId: number): Promise<GenerationResult | null> => {
  try {
    const task = await taskApi.get(taskId)

    // 获取最终提示词
    lightboxPrompt.value = (task.middlewareLogs as any)?.preset?.transformedPrompt
      || task.requestSnapshot?.prompt
      || ''

    if (task.status === 'success' && task.responseSnapshot && task.responseSnapshot.length > 0) {
      return {
        success: true,
        output: task.responseSnapshot,
        taskId: task.id,
        duration: task.duration || undefined
      }
    } else if (task.status === 'failed') {
      const errorInfo = (task.middlewareLogs as any)?._error
      return {
        success: false,
        error: errorInfo?.message || '生成失败',
        taskId: task.id,
        duration: task.duration || undefined
      }
    }
    return null
  } catch {
    return null
  }
}

const generate = async () => {
  if (!form.value.channel) {
    message.warning('请选择渠道')
    return
  }

  generating.value = true
  result.value = null
  currentTaskId.value = null
  startTimer()

  try {
    const params: any = {
      channelId: form.value.channel,
      prompt: form.value.prompt || '',
      parameters: { ...form.value.parameters }
    }

    // 添加文件
    if (uploadedFiles.value.length > 0) {
      params.files = uploadedFiles.value
    }

    if (presetId.value) {
      const preset = presets.value.find(p => p.id === presetId.value)
      if (preset) {
        params.parameters.preset = preset.name
      }
    }

    const res = await generateApi.generate(params)

    // 更新 taskId
    if (res.taskId) {
      currentTaskId.value = res.taskId
    }

    // 如果成功，直接使用结果
    if (res.success) {
      result.value = res
      historyGalleryRef.value?.refresh()

      // 获取最终提示词
      if (res.taskId) {
        try {
          const task = await taskApi.get(res.taskId)
          lightboxPrompt.value = (task.middlewareLogs as any)?.preset?.transformedPrompt
            || task.requestSnapshot?.prompt
            || ''
        } catch {
          lightboxPrompt.value = form.value.prompt
        }
      } else {
        lightboxPrompt.value = form.value.prompt
      }
    } else {
      // API 返回失败，但可能任务实际成功了，尝试通过 taskId 获取
      if (res.taskId) {
        // 等待一小段时间让后端完成处理
        await new Promise(resolve => setTimeout(resolve, 500))
        const taskResult = await fetchTaskResult(res.taskId)
        if (taskResult && taskResult.success) {
          result.value = taskResult
          historyGalleryRef.value?.refresh()
        } else {
          result.value = res
        }
      } else {
        result.value = res
      }
    }
  } catch (e: any) {
    // 请求异常，尝试通过 taskId 恢复
    if (currentTaskId.value) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const taskResult = await fetchTaskResult(currentTaskId.value)
      if (taskResult) {
        result.value = taskResult
        if (taskResult.success) {
          historyGalleryRef.value?.refresh()
        }
      } else {
        result.value = { success: false, error: e.message || '请求失败' }
      }
    } else {
      result.value = { success: false, error: e.message || '请求失败' }
    }
  } finally {
    stopTimer()
    generating.value = false
  }
}

// 处理历史记录选择（点击历史任务时填充提示词）
const handleHistorySelect = (task: { prompt: string }) => {
  if (task.prompt) {
    form.value.prompt = task.prompt
  }
}

onMounted(() => {
  fetchData()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.view-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.view-content {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  padding: 0.5rem;
}

.generate-layout {
  display: flex;
  gap: 1rem;
  height: 100%;
  min-height: 0;
}

.config-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.config-card {
  padding: 1.25rem;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background-color: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: border-color 0.2s, box-shadow 0.2s;
  /* 隐藏式滚动条 */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.config-card:hover {
  border-color: var(--k-color-active);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  scrollbar-color: var(--k-color-border) transparent;
}

/* Webkit 隐藏式滚动条 */
.config-card::-webkit-scrollbar {
  width: 6px;
}
.config-card::-webkit-scrollbar-track {
  background: transparent;
}
.config-card::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 3px;
  transition: background-color 0.2s;
}
.config-card:hover::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
}

.form-section {
  margin-bottom: 1.25rem;
}

.form-section:last-of-type {
  margin-bottom: 0;
}

.form-section.flex-grow {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.form-section.flex-grow :deep(.el-textarea) {
  flex-grow: 1;
}

.form-section.flex-grow :deep(.el-textarea__inner) {
  height: 100% !important;
}

.section-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--k-color-text);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.section-title .k-icon {
  color: var(--k-color-active);
}

.form-item {
  margin-bottom: 0.75rem;
}

.form-item:last-child {
  margin-bottom: 0;
}

.label {
  font-size: 0.8rem;
  color: var(--k-color-text-description);
  margin-bottom: 0.25rem;
}

.form-actions {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--k-color-border);
}

.generate-btn {
  width: 100%;
  height: 40px;
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.2s;
  background: linear-gradient(135deg, var(--k-color-primary) 0%, var(--k-color-primary-dark, var(--k-color-primary)) 100%);
  border: none;
}

.generate-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(var(--k-color-primary-rgb), 0.4);
  filter: brightness(1.1);
}

.preview-panel {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  background-color: var(--k-card-bg);
  border-radius: 12px;
  border: 1px solid var(--k-color-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  overflow-y: auto;
  transition: border-color 0.2s, box-shadow 0.2s;
  /* 隐藏式滚动条 */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.preview-panel:hover {
  border-color: var(--k-color-active);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  scrollbar-color: var(--k-color-border) transparent;
}

/* Webkit 隐藏式滚动条 */
.preview-panel::-webkit-scrollbar {
  width: 6px;
}
.preview-panel::-webkit-scrollbar-track {
  background: transparent;
}
.preview-panel::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 3px;
  transition: background-color 0.2s;
}
.preview-panel:hover::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
}

/* States */
.empty-state {
  text-align: center;
  color: var(--k-color-text-description);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.empty-icon {
  font-size: 5rem;
  margin-bottom: 1.5rem;
  opacity: 0.2;
  color: var(--k-color-text);
}

/* 生成中状态 - 增强样式 */
.generating-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
}

.generating-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(var(--k-color-primary-rgb), 0.05) 0%, rgba(var(--k-color-primary-rgb), 0.02) 100%);
  border-radius: 16px;
  border: 1px solid rgba(var(--k-color-primary-rgb), 0.1);
}

.loader {
  border: 4px solid var(--k-color-bg-2);
  border-top: 4px solid var(--k-color-active);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.generating-info {
  text-align: center;
}

.generating-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0 0 0.75rem 0;
}

.generating-timer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--k-color-active);
  margin: 0 0 0.5rem 0;
  font-variant-numeric: tabular-nums;
}

.generating-hint {
  font-size: 0.85rem;
  color: var(--k-color-text-description);
  margin: 0;
}

/* Result */
.result-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.success-result {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.output-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  flex-grow: 1;
  align-content: start;
}

.output-wrapper {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--k-color-border);
  background-color: var(--k-card-bg);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.output-wrapper:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: transparent;
}

.output-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.output-wrapper img.clickable-image {
  cursor: zoom-in;
}

.output-wrapper video,
.output-wrapper audio {
  width: 100%;
  display: block;
}

.output-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.5rem;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.2s;
}

.output-wrapper:hover .output-actions {
  opacity: 1;
}

.action-btn {
  color: white;
  padding: 4px;
  cursor: pointer;
}

.result-meta {
  margin-top: 1.5rem;
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  color: var(--k-color-text-description);
  font-size: 0.9rem;
  border-top: 1px solid var(--k-color-border);
  padding-top: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.success-badge {
  color: var(--k-color-success, #67c23a);
  font-weight: 600;
}

/* 错误状态 - 增强样式 */
.error-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1.5rem;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(245, 108, 108, 0.08) 0%, rgba(245, 108, 108, 0.02) 100%);
  border-radius: 16px;
  border: 1px solid rgba(245, 108, 108, 0.2);
}

.error-icon {
  font-size: 3rem;
  color: var(--k-color-error, #f56c6c);
}

.error-info {
  text-align: center;
}

.error-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--k-color-error, #f56c6c);
  margin: 0 0 0.5rem 0;
}

.error-msg {
  color: var(--k-color-text);
  margin: 0 0 0.5rem 0;
  max-width: 400px;
  word-break: break-word;
}

.error-meta {
  font-size: 0.85rem;
  color: var(--k-color-text-description);
  margin: 0;
}

.retry-btn {
  margin-top: 0.5rem;
}

/* Upload Area */
.upload-area {
  margin-top: 0.25rem;
}

.upload-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.upload-item {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--k-color-border);
  background-color: var(--k-color-bg-2);
}

.upload-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;
  color: white;
}

.upload-item:hover .upload-overlay {
  opacity: 1;
}

.upload-trigger {
  width: 56px;
  height: 56px;
  border: 2px dashed var(--k-color-border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  background-color: var(--k-color-bg-2);
}

.upload-trigger:hover {
  border-color: var(--k-color-active);
  background-color: var(--k-color-bg-1);
}

.upload-icon {
  font-size: 1.25rem;
  color: var(--k-color-text-description);
  transition: color 0.2s;
}

.upload-trigger:hover .upload-icon {
  color: var(--k-color-active);
}

.upload-tip {
  font-size: 0.7rem;
  color: var(--k-color-text-description);
  margin-top: 0.35rem;
  opacity: 0.8;
}

/* Text output */
.text-output {
  padding: 1rem;
  background-color: var(--k-color-bg-2);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.6;
}

/* File link */
.file-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background-color: var(--k-color-bg-2);
  border-radius: 6px;
  color: var(--k-color-active);
  text-decoration: none;
  transition: background-color 0.2s;
}

.file-link:hover {
  background-color: var(--k-color-bg-3);
}
</style>
