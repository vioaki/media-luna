<template>
  <div class="setup-storage">
    <h3>存储配置</h3>
    <p class="step-desc">选择生成图片的存储方式。推荐使用本地存储或 S3 兼容存储。</p>

    <div v-if="loading" class="loading-state">
      <k-icon name="sync" class="spin" />
      <span>加载配置中...</span>
    </div>

    <template v-else>
      <!-- 使用 ConfigRenderer 渲染配置字段 -->
      <ConfigRenderer
        :fields="fields"
        v-model="localConfig"
      />

      <!-- 警告提示（当选择不使用时） -->
      <div v-if="localConfig.backend === 'none'" class="warning-box">
        <k-icon name="warning" />
        <div>
          <strong>注意</strong>
          <p>选择"不使用"将保留生成服务返回的原始 URL，这些 URL 可能会过期或无法访问。建议配置存储后端以确保图片长期可用。</p>
        </div>
      </div>
    </template>

    <!-- 操作按钮 -->
    <div class="step-actions">
      <k-button type="primary" :loading="saving" :disabled="loading" @click="handleNext">
        下一步
      </k-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { setupApi } from '../../api'
import type { ConfigField } from '../../types'
import ConfigRenderer from '../ConfigRenderer.vue'

const props = defineProps<{
  modelValue: Record<string, any>
  saving: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
  (e: 'next'): void
}>()

const loading = ref(true)
const fields = ref<ConfigField[]>([])
const localConfig = ref<Record<string, any>>({})

// 同步 localConfig 到父组件
watch(localConfig, (newVal) => {
  emit('update:modelValue', { ...newVal })
}, { deep: true })

// 加载配置字段和当前值
const loadConfig = async () => {
  try {
    loading.value = true
    // 并行获取字段定义和当前配置
    const [fieldsResult, configResult] = await Promise.all([
      setupApi.getStorageFields(),
      setupApi.getStorageConfig()
    ])

    fields.value = fieldsResult

    // 合并当前配置（填充默认值）
    const newConfig: Record<string, any> = { ...props.modelValue }
    for (const field of fieldsResult) {
      if (configResult[field.key] !== undefined) {
        newConfig[field.key] = configResult[field.key]
      } else if (newConfig[field.key] === undefined && field.default !== undefined) {
        newConfig[field.key] = field.default
      }
    }
    localConfig.value = newConfig
  } catch (e) {
    console.error('Failed to load storage config:', e)
  } finally {
    loading.value = false
  }
}

const handleNext = () => {
  emit('next')
}

onMounted(loadConfig)
</script>

<style scoped>
.setup-storage h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0 0 0.5rem 0;
}

.step-desc {
  color: var(--k-color-text-description);
  margin: 0 0 1.5rem 0;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem;
  color: var(--k-color-text-description);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 警告框 */
.warning-box {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  margin-top: 1rem;
  background: color-mix(in srgb, var(--k-color-warning) 10%, transparent);
  border: 1px solid var(--k-color-warning);
  border-radius: 8px;
  color: var(--k-color-warning);
}

.warning-box strong {
  display: block;
  margin-bottom: 0.25rem;
}

.warning-box p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--k-color-text);
}

/* 操作按钮 */
.step-actions {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--k-color-border);
  display: flex;
  justify-content: flex-end;
}
</style>
