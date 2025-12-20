<template>
  <teleport to="body">
    <transition name="lightbox-fade">
      <div v-if="visible" class="lightbox-overlay" @click.self="close">
        <div class="lightbox-container">
          <div class="lightbox-content">
            <!-- 左侧图片区域 -->
            <div class="lightbox-image-area" @click.self="close">
              <!-- 关闭按钮 -->
              <button class="close-btn" @click="close" title="关闭 (Esc)">
                <k-icon name="times"></k-icon>
              </button>

              <!-- 多图时的导航 -->
              <button v-if="images.length > 1" class="nav-btn prev" @click.stop="prevImage" title="上一张">
                <k-icon name="chevron-left"></k-icon>
              </button>

              <img :src="currentImage" class="lightbox-image" alt="Preview" />

              <button v-if="images.length > 1" class="nav-btn next" @click.stop="nextImage" title="下一张">
                <k-icon name="chevron-right"></k-icon>
              </button>

              <!-- 图片计数器 -->
              <div v-if="images.length > 1" class="image-counter">
                {{ currentIndex + 1 }} / {{ images.length }}
              </div>
            </div>

            <!-- 右侧信息栏 -->
            <div class="lightbox-sidebar" v-if="showSidebar">
              <div class="sidebar-header">
                <div class="info-title">图片详情</div>
                <button class="header-close-btn" @click="close" title="关闭">
                  <k-icon name="times"></k-icon>
                </button>
              </div>

              <div class="sidebar-body">
                <!-- 提示词 -->
                <div class="info-block">
                  <div class="block-header">
                    <span>提示词</span>
                    <button v-if="prompt" class="copy-btn" @click="copyPrompt">
                      复制
                    </button>
                  </div>
                  <div class="prompt-content" :class="{ empty: !prompt }">
                    {{ prompt || '无提示词' }}
                  </div>
                </div>

                <!-- 创建时间 -->
                <div class="info-block" v-if="createdAt">
                  <div class="block-header">
                    <span>创建时间</span>
                  </div>
                  <div class="info-value">{{ formatDate(createdAt) }}</div>
                </div>

                <!-- 生成耗时 -->
                <div class="info-block" v-if="duration">
                  <div class="block-header">
                    <span>生成耗时</span>
                  </div>
                  <div class="info-value">{{ formatDuration(duration) }}</div>
                </div>
              </div>

              <div class="sidebar-footer">
                <button class="action-btn primary" @click="openOriginal">
                  <k-icon name="external-link"></k-icon>
                  查看原图
                </button>
                <button class="action-btn secondary" @click="downloadImage">
                  <k-icon name="download"></k-icon>
                  下载
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { message } from '@koishijs/client'

interface Props {
  visible: boolean
  images: string[]
  initialIndex?: number
  prompt?: string
  createdAt?: Date | string
  duration?: number
  showSidebar?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  initialIndex: 0,
  showSidebar: true
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}>()

const currentIndex = ref(props.initialIndex)

const currentImage = computed(() => props.images[currentIndex.value] || '')

// 监听 visible 变化，重置索引
watch(() => props.visible, (val) => {
  if (val) {
    currentIndex.value = props.initialIndex
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// 监听 initialIndex 变化
watch(() => props.initialIndex, (val) => {
  currentIndex.value = val
})

const close = () => {
  emit('update:visible', false)
  emit('close')
}

const prevImage = () => {
  currentIndex.value = (currentIndex.value - 1 + props.images.length) % props.images.length
}

const nextImage = () => {
  currentIndex.value = (currentIndex.value + 1) % props.images.length
}

const copyPrompt = () => {
  if (props.prompt) {
    navigator.clipboard.writeText(props.prompt)
    message.success('已复制提示词')
  }
}

const openOriginal = () => {
  window.open(currentImage.value, '_blank')
}

const downloadImage = () => {
  const link = document.createElement('a')
  link.href = currentImage.value
  link.download = `image-${Date.now()}.png`
  link.click()
}

const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString()
}

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// 键盘导航
const handleKeydown = (e: KeyboardEvent) => {
  if (!props.visible) return

  if (e.key === 'Escape') {
    close()
  } else if (e.key === 'ArrowLeft') {
    prevImage()
  } else if (e.key === 'ArrowRight') {
    nextImage()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.lightbox-container {
  width: 100%;
  max-width: 1100px;
  height: 90vh;
  max-height: 850px;
  background: var(--k-card-bg);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
}

.lightbox-content {
  display: flex;
  height: 100%;
}

/* 图片区域 */
.lightbox-image-area {
  flex: 1;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: zoom-out;
  min-width: 0;
}

.lightbox-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

/* 关闭按钮 - 图片区域左上角 */
.close-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 1.1rem;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

/* 导航按钮 */
.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: white;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 1.5rem;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-50%) scale(1.08);
}

.nav-btn.prev {
  left: 16px;
}

.nav-btn.next {
  right: 16px;
}

.image-counter {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
}

/* 侧边栏 */
.lightbox-sidebar {
  width: 280px;
  background: var(--k-card-bg);
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--k-color-border);
  flex-shrink: 0;
}

.sidebar-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--k-color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.info-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--k-color-text);
}

.header-close-btn {
  background: transparent;
  border: none;
  color: var(--k-color-text-description);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.header-close-btn:hover {
  background: var(--k-color-bg-2);
  color: var(--k-color-text);
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.info-block {
  margin-bottom: 16px;
}

.info-block:last-child {
  margin-bottom: 0;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--k-color-text-description);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.copy-btn {
  background: transparent;
  border: none;
  color: var(--k-color-active);
  cursor: pointer;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background 0.2s;
  font-weight: 500;
}

.copy-btn:hover {
  background: var(--k-color-bg-2);
}

.prompt-content {
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--k-color-text);
  background: var(--k-color-bg-2);
  padding: 10px 12px;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

.prompt-content.empty {
  color: var(--k-color-text-description);
  font-style: italic;
}

.info-value {
  font-size: 0.85rem;
  color: var(--k-color-text);
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--k-color-border);
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.action-btn.primary {
  background: var(--k-color-active);
  color: white;
}

.action-btn.primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.action-btn.secondary {
  background: var(--k-color-bg-2);
  color: var(--k-color-text);
  border: 1px solid var(--k-color-border);
}

.action-btn.secondary:hover {
  background: var(--k-color-bg-1);
  border-color: var(--k-color-active);
  color: var(--k-color-active);
}

/* 过渡动画 */
.lightbox-fade-enter-active,
.lightbox-fade-leave-active {
  transition: opacity 0.25s ease;
}

.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .lightbox-overlay {
    padding: 0;
  }

  .lightbox-container {
    height: 100%;
    max-height: none;
    border-radius: 0;
  }

  .lightbox-content {
    flex-direction: column;
  }

  .lightbox-image-area {
    min-height: 50vh;
  }

  .lightbox-sidebar {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--k-color-border);
  }

  .close-btn {
    top: 12px;
    left: 12px;
  }
}
</style>
