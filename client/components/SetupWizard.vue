<template>
  <div class="setup-wizard">
    <div class="wizard-container">
      <!-- 头部 -->
      <div class="wizard-header">
        <h1>欢迎使用 Media Luna</h1>
        <p>在开始使用前，请完成以下基础配置</p>
      </div>

      <!-- 步骤指示器 -->
      <div class="steps-indicator">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="step-item"
          :class="{
            active: currentStep === index,
            completed: currentStep > index
          }"
        >
          <div class="step-number">
            <k-icon v-if="currentStep > index" name="check" />
            <span v-else>{{ index + 1 }}</span>
          </div>
          <span class="step-label">{{ step.label }}</span>
        </div>
      </div>

      <!-- 步骤内容 -->
      <div class="wizard-content">
        <transition name="fade" mode="out-in">
          <!-- 存储配置步骤 -->
          <SetupStorage
            v-if="currentStep === 0"
            key="storage"
            v-model="storageConfig"
            :saving="saving"
            @next="handleStorageNext"
          />

          <!-- 用户绑定步骤 -->
          <SetupAuth
            v-else-if="currentStep === 1"
            key="auth"
            :saving="saving"
            @complete="handleComplete"
            @skip="handleSkip"
          />

          <!-- 完成步骤 -->
          <div v-else-if="currentStep === 2" key="complete" class="step-complete">
            <div class="complete-icon">
              <k-icon name="check-circle" />
            </div>
            <h2>配置完成</h2>
            <p>您已完成 Media Luna 的初始设置，现在可以开始使用了。</p>
            <k-button type="primary" size="large" @click="finishSetup">
              开始使用
            </k-button>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from '@koishijs/client'
import { setupApi } from '../api'
import SetupStorage from './setup/SetupStorage.vue'
import SetupAuth from './setup/SetupAuth.vue'

const emit = defineEmits<{
  (e: 'complete'): void
}>()

// 步骤定义
const steps = [
  { id: 'storage', label: '存储配置' },
  { id: 'auth', label: '用户绑定' },
  { id: 'complete', label: '完成' }
]

// 当前步骤
const currentStep = ref(0)
const saving = ref(false)

// 存储配置（由 SetupStorage 组件动态加载和管理）
const storageConfig = ref<Record<string, any>>({})

// 处理存储配置完成
const handleStorageNext = async () => {
  saving.value = true
  try {
    await setupApi.updateStorageConfig(storageConfig.value)
    message.success('存储配置已保存')
    currentStep.value = 1
  } catch (e) {
    message.error('保存失败: ' + (e instanceof Error ? e.message : '未知错误'))
  } finally {
    saving.value = false
  }
}

// 处理用户绑定完成
const handleComplete = () => {
  currentStep.value = 2
}

// 跳过用户绑定
const handleSkip = () => {
  currentStep.value = 2
}

// 完成设置
const finishSetup = async () => {
  try {
    await setupApi.complete()
    emit('complete')
  } catch (e) {
    // 忽略错误，直接完成
    emit('complete')
  }
}
</script>

<style scoped>
.setup-wizard {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--k-color-bg-1);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}

.wizard-container {
  width: 100%;
  max-width: 640px;
  padding: 2rem;
}

.wizard-header {
  text-align: center;
  margin-bottom: 2rem;
}

.wizard-header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0 0 0.5rem 0;
}

.wizard-header p {
  color: var(--k-color-text-description);
  margin: 0;
}

/* 步骤指示器 */
.steps-indicator {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.step-item:not(:last-child)::after {
  content: '';
  position: absolute;
  left: calc(50% + 20px);
  top: 16px;
  width: calc(2rem + 20px);
  height: 2px;
  background: var(--k-color-border);
}

.step-item.completed:not(:last-child)::after {
  background: var(--k-color-success);
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  background: var(--k-color-bg-2);
  color: var(--k-color-text-description);
  border: 2px solid var(--k-color-border);
  transition: all 0.2s;
}

.step-item.active .step-number {
  background: var(--k-color-active);
  color: white;
  border-color: var(--k-color-active);
}

.step-item.completed .step-number {
  background: var(--k-color-success);
  color: white;
  border-color: var(--k-color-success);
}

.step-label {
  font-size: 0.85rem;
  color: var(--k-color-text-description);
}

.step-item.active .step-label {
  color: var(--k-color-text);
  font-weight: 500;
}

.step-item.completed .step-label {
  color: var(--k-color-success);
}

/* 步骤内容 */
.wizard-content {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
  padding: 2rem;
  min-height: 400px;
}

/* 完成步骤 */
.step-complete {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 0;
}

.complete-icon {
  font-size: 4rem;
  color: var(--k-color-success);
  margin-bottom: 1.5rem;
}

.step-complete h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0 0 0.75rem 0;
}

.step-complete p {
  color: var(--k-color-text-description);
  margin: 0 0 2rem 0;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
