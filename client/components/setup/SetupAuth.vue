<template>
  <div class="setup-auth">
    <h3>用户绑定</h3>
    <p class="step-desc">
      将 WebUI 与 Koishi 用户绑定。你可以直接配置用户 ID，也可以通过验证码进行验证绑定。
    </p>

    <div class="config-panel">
      <!-- UID 输入 -->
      <div class="form-row">
        <div class="form-label">用户 ID (UID)</div>
        <div class="field-container">
          <el-input-number
            v-model="uid"
            :min="1"
            :controls="false"
            placeholder="Koishi 用户 ID"
            class="uid-input full-width"
            @input="handleUidChange"
          />
          <div class="field-desc">
            输入你的 Koishi <code>uid</code>，不是原神的。
          </div>
        </div>
      </div>

      <!-- 验证码显示区域 -->
      <div  class="verify-section">
        <div class="verify-card">
          <div class="code-display">
            <div class="code-label">验证码</div>
            <div class="code-value">{{ verifyCode }}</div>
            <div class="code-meta">有效期 {{ expiresIn }} 秒</div>
          </div>
          <div class="verify-guide">
            <p>请在聊天平台向机器人发送以下指令完成绑定：</p>
            <div class="command-box">
              <code>bindui</code>
            </div>
            <p class="small-hint">发送指令后，请根据提示输入左侧的验证码。</p>
          </div>
        </div>
      </div>
    </div>

    <div class="step-actions">
      <k-button @click="$emit('skip')">跳过</k-button>
      <k-button type="primary" :loading="saving" @click="handleSave">
        保存 / 完成
      </k-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { message, receive } from '@koishijs/client'
import { setupApi } from '../../api'

const emit = defineEmits<{
  (e: 'complete'): void
  (e: 'skip'): void
}>()

defineProps<{
  saving: boolean
}>()

const uid = ref<number | null>(null)
const generating = ref(false)
const verifyCode = ref('')
const expiresIn = ref(0)
const initialBoundUid = ref<number | null>(null)

let stopReceive: (() => void) | null = null
let pollTimer: number | null = null

// 加载当前状态
const loadStatus = async () => {
  try {
    const status = await setupApi.status()
    if (status.boundUid) {
      uid.value = status.boundUid
      initialBoundUid.value = status.boundUid
    }
  } catch (e) {
    console.error('Failed to load status:', e)
  }
}

// 生成验证码
const generateCode = async () => {
  if (generateTimer) clearTimeout(generateTimer)
  if (!uid.value) return

  try {
    generating.value = true
    const result = await setupApi.generateVerifyCode(uid.value)
    verifyCode.value = result.code
    expiresIn.value = result.expiresIn
    message.success('验证码已生成，请在聊天平台完成验证')
  } catch (e) {
    message.error('生成验证码失败: ' + (e instanceof Error ? e.message : '未知错误'))
  } finally {
    generating.value = false
  }
}

// 监听 UID 变化自动生成验证码
let generateTimer: number | null = null
const handleUidChange = () => {
  if (generateTimer) clearTimeout(generateTimer)
  verifyCode.value = ''
  
  if (uid.value) {
    generateTimer = window.setTimeout(generateCode, 1000)
  }
}

// 保存/直接绑定
const handleSave = async () => {
  if (!uid.value) {
    message.warning('请输入用户 ID')
    return
  }

  try {
    // 尝试直接更新配置（如果通过验证码流程绑定了，这里再次设置也是安全的）
    await setupApi.bindUid(uid.value)
    message.success('配置已保存')
    emit('complete')
  } catch (e) {
    message.error('保存失败: ' + (e instanceof Error ? e.message : '未知错误'))
  }
}

onMounted(() => {
  loadStatus()

  // 监听来自 QQ 的绑定请求
  stopReceive = (receive as any)('media-luna/webui-auth/bind-request', (data: { uid: number, code: string, expiresIn: number }) => {
    if (data.uid) {
      uid.value = data.uid
      
      if (data.code) {
        verifyCode.value = data.code
        expiresIn.value = data.expiresIn
        message.info('收到绑定请求，请在聊天平台完成验证')
      }
    }
  })

  // 轮询绑定状态
  pollTimer = window.setInterval(async () => {
    try {
      const status = await setupApi.status()
      if (status.boundUid) {
        // 只有当绑定的 UID 与当前（或请求的）UID 一致时才自动完成
        if (uid.value && status.boundUid !== uid.value) return

        // 如果绑定状态发生了变化（从无到有，或变更了用户），则自动完成
        // 如果是重新绑定同一个用户，由于状态未变，不自动完成（避免过早提示）
        if (status.boundUid !== initialBoundUid.value) {
          uid.value = status.boundUid
          message.success('检测到绑定成功！')
          emit('complete')
          if (pollTimer) clearInterval(pollTimer)
        }
      }
    } catch {}
  }, 3000)
})

onUnmounted(() => {
  if (stopReceive) stopReceive()
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.setup-auth h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0 0 0.5rem 0;
}

.step-desc {
  color: var(--k-color-text-description);
  margin: 0 0 1.5rem 0;
}

.config-panel {
  background: var(--k-card-bg);
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--k-color-border);
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 表单样式 imitation of ConfigRenderer */
.form-row {
  display: flex;
  align-items: flex-start;
}

.form-label {
  width: 120px;
  flex-shrink: 0;
  color: var(--k-color-text-description);
  padding-top: 6px;
  font-size: 0.9rem;
}

.field-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.uid-input {
  width: 100%;
}

.field-desc {
  font-size: 0.8rem;
  color: var(--k-color-text-description);
}

.field-desc code {
  background: var(--k-color-bg-2);
  padding: 0.1em 0.4em;
  border-radius: 4px;
  font-family: monospace;
}

/* 验证码区域 */
.verify-section {
  border-top: 1px solid var(--k-color-border);
  padding-top: 1.5rem;
  margin-top: 0.5rem;
}

.verify-card {
  background: var(--k-color-bg-2);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  gap: 2rem;
  align-items: center;
}

.code-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding-right: 2rem;
  border-right: 1px dashed var(--k-color-border);
  min-width: 150px;
}

.code-label {
  font-size: 0.85rem;
  color: var(--k-color-text-description);
}

.code-value {
  font-size: 2rem;
  font-family: monospace;
  font-weight: 700;
  color: var(--k-color-active);
  letter-spacing: 0.1em;
}

.code-meta {
  font-size: 0.8rem;
  color: var(--k-color-text-description);
}

.verify-guide {
  flex: 1;
}

.verify-guide p {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  color: var(--k-color-text);
}

.command-box {
  background: var(--k-card-bg);
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--k-color-border);
  display: inline-block;
  margin-bottom: 0.75rem;
}

.command-box code {
  font-family: monospace;
  color: var(--k-color-active);
  font-weight: 600;
}

.small-hint {
  font-size: 0.8rem !important;
  color: var(--k-color-text-description) !important;
  margin: 0 !important;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--k-color-border);
}
</style>
