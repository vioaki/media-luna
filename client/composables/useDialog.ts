/**
 * 对话框控制 composable
 */
import { ref, Ref } from 'vue'

export interface UseDialogReturn<T = any> {
  /** 对话框是否可见 */
  visible: Ref<boolean>
  /** 当前数据（编辑模式） */
  data: Ref<T | null>
  /** 是否为编辑模式 */
  isEdit: Ref<boolean>
  /** 打开对话框（新建模式） */
  open: () => void
  /** 打开对话框（编辑模式） */
  openEdit: (item: T) => void
  /** 关闭对话框 */
  close: () => void
  /** 重置数据 */
  reset: () => void
}

export function useDialog<T = any>(defaultData?: T): UseDialogReturn<T> {
  const visible = ref(false)
  const data = ref<T | null>(null) as Ref<T | null>
  const isEdit = ref(false)

  const open = () => {
    data.value = defaultData ? { ...defaultData } : null
    isEdit.value = false
    visible.value = true
  }

  const openEdit = (item: T) => {
    data.value = { ...item }
    isEdit.value = true
    visible.value = true
  }

  const close = () => {
    visible.value = false
  }

  const reset = () => {
    data.value = null
    isEdit.value = false
  }

  return {
    visible,
    data,
    isEdit,
    open,
    openEdit,
    close,
    reset
  }
}
