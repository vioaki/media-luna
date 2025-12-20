/**
 * 加载状态管理 composable
 * 提供统一的 loading、error 状态管理
 */
import { ref, Ref } from 'vue'
import { message } from '@koishijs/client'

export interface UseLoadingOptions {
  /** 初始加载状态 */
  initialLoading?: boolean
  /** 错误时是否显示 toast */
  showErrorToast?: boolean
  /** 默认错误消息 */
  defaultErrorMessage?: string
}

export interface UseLoadingReturn {
  /** 是否正在加载 */
  loading: Ref<boolean>
  /** 错误信息 */
  error: Ref<string | null>
  /** 包装异步函数，自动处理 loading 和 error 状态 */
  withLoading: <T>(fn: () => Promise<T>, errorMessage?: string) => Promise<T | undefined>
  /** 手动设置加载状态 */
  setLoading: (value: boolean) => void
  /** 手动设置错误 */
  setError: (message: string | null) => void
  /** 清除错误 */
  clearError: () => void
}

export function useLoading(options: UseLoadingOptions = {}): UseLoadingReturn {
  const {
    initialLoading = false,
    showErrorToast = true,
    defaultErrorMessage = '操作失败'
  } = options

  const loading = ref(initialLoading)
  const error = ref<string | null>(null)

  const setLoading = (value: boolean) => {
    loading.value = value
  }

  const setError = (msg: string | null) => {
    error.value = msg
    if (msg && showErrorToast) {
      message.error(msg)
    }
  }

  const clearError = () => {
    error.value = null
  }

  const withLoading = async <T>(
    fn: () => Promise<T>,
    errorMessage?: string
  ): Promise<T | undefined> => {
    loading.value = true
    error.value = null

    try {
      const result = await fn()
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : (errorMessage || defaultErrorMessage)
      setError(msg)
      return undefined
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    withLoading,
    setLoading,
    setError,
    clearError
  }
}
