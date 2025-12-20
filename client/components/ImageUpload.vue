<template>
  <div class="image-upload">
    <!-- 已上传的图片列表 -->
    <div class="image-list" v-if="images.length > 0">
      <div v-for="(img, index) in images" :key="img.url || index" class="image-item">
        <div class="image-preview">
          <img :src="img.previewUrl" :alt="img.filename" />
          <div class="image-overlay">
            <k-button size="mini" class="remove-btn" @click="removeImage(index)">
              <template #icon><k-icon name="delete"></k-icon></template>
            </k-button>
          </div>
        </div>
        <div class="image-name">{{ img.filename }}</div>
      </div>
    </div>

    <!-- 上传按钮 -->
    <div class="upload-area" @click="triggerUpload" @dragover.prevent @drop.prevent="handleDrop">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        style="display: none"
        @change="handleFileSelect"
      />
      <div class="upload-content">
        <k-icon name="add" class="upload-icon"></k-icon>
        <span class="upload-text">点击或拖拽上传图片</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="uploading" class="upload-loading">
      <k-icon name="sync" class="loading-icon"></k-icon>
      上传中...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { message } from '@koishijs/client'
import { cacheApi } from '../api'

export interface UploadedImage {
  url: string       // 缓存 URL（用于存储和 emit）
  filename: string
  mime: string
  previewUrl: string  // 预览 URL（可能与 url 相同，或是 data URL）
}

const props = defineProps<{
  modelValue: string[]  // 缓存 URL 列表
  maxCount?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const images = ref<UploadedImage[]>([])

// 加载已有图片（从 URL 列表）
const loadImages = async () => {
  const newImages: UploadedImage[] = []

  for (const url of props.modelValue) {
    // 跳过空值
    if (!url) continue

    // 所有非空 URL 都应该可用（包括相对路径、http/https）
    newImages.push({
      url,
      filename: url.split('/').pop()?.split('?')[0] || 'image',
      mime: 'image/png',
      previewUrl: url
    })
  }

  images.value = newImages
}

// 监听 modelValue 变化
watch(() => props.modelValue, () => {
  loadImages()
}, { immediate: true })

// 触发文件选择
const triggerUpload = () => {
  fileInput.value?.click()
}

// 处理文件选择
const handleFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  await uploadFiles(Array.from(input.files))
  input.value = '' // 清空以便再次选择同一文件
}

// 处理拖拽
const handleDrop = async (e: DragEvent) => {
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  await uploadFiles(Array.from(files).filter(f => f.type.startsWith('image/')))
}

// 上传文件
const uploadFiles = async (files: File[]) => {
  if (files.length === 0) return

  const maxCount = props.maxCount || 10
  if (images.value.length + files.length > maxCount) {
    message.warning(`最多上传 ${maxCount} 张图片`)
    files = files.slice(0, maxCount - images.value.length)
  }

  uploading.value = true

  try {
    for (const file of files) {
      // 读取文件为 base64
      const base64 = await fileToBase64(file)

      // 上传到缓存，获取 URL
      const result = await cacheApi.upload(base64, file.type, file.name)

      if (!result.url) {
        message.error('缓存服务未配置 selfUrl，无法获取图片 URL')
        continue
      }

      images.value.push({
        url: result.url,
        filename: result.filename,
        mime: result.mime,
        previewUrl: result.url  // 使用缓存 URL 作为预览
      })
    }

    // 更新 modelValue（emit URL 列表）
    emit('update:modelValue', images.value.map(img => img.url))

  } catch (e) {
    message.error('上传失败')
    console.error(e)
  } finally {
    uploading.value = false
  }
}

// 文件转 base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // 移除 data:xxx;base64, 前缀
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 删除图片
const removeImage = (index: number) => {
  images.value.splice(index, 1)
  emit('update:modelValue', images.value.map(img => img.url))
}

onMounted(() => {
  loadImages()
})
</script>

<style scoped>
.image-upload {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.image-item {
  width: 80px;
}

.image-preview {
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--k-color-border);
  background-color: var(--k-color-bg-2);
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-preview:hover .image-overlay {
  opacity: 1;
}

.remove-btn {
  background-color: var(--k-color-error, #f56c6c) !important;
  color: white !important;
  border: none !important;
}

.image-name {
  font-size: 0.7rem;
  color: var(--k-color-text-description);
  margin-top: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.upload-area {
  border: 2px dashed var(--k-color-border);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--k-color-bg-2);
}

.upload-area:hover {
  border-color: var(--k-color-active);
  background-color: var(--k-color-bg-1);
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--k-color-text-description);
}

.upload-icon {
  font-size: 1.5rem;
  color: var(--k-color-active);
}

.upload-text {
  font-size: 0.85rem;
}

.upload-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--k-color-text-description);
  font-size: 0.85rem;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
