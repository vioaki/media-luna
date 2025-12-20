/**
 * 分页管理 composable
 * 提供统一的分页状态和控制
 */
import { ref, computed, Ref, ComputedRef } from 'vue'

export interface UsePaginationOptions {
  /** 初始页码（从 1 开始） */
  initialPage?: number
  /** 每页数量 */
  initialPageSize?: number
  /** 可选的每页数量选项 */
  pageSizeOptions?: number[]
}

export interface UsePaginationReturn {
  /** 当前页码（从 1 开始） */
  page: Ref<number>
  /** 每页数量 */
  pageSize: Ref<number>
  /** 总数量 */
  total: Ref<number>
  /** 总页数 */
  totalPages: ComputedRef<number>
  /** 是否有下一页 */
  hasNext: ComputedRef<boolean>
  /** 是否有上一页 */
  hasPrev: ComputedRef<boolean>
  /** 当前页的 offset（用于 API 调用） */
  offset: ComputedRef<number>
  /** 每页数量选项 */
  pageSizeOptions: number[]
  /** 设置总数 */
  setTotal: (value: number) => void
  /** 下一页 */
  nextPage: () => void
  /** 上一页 */
  prevPage: () => void
  /** 跳转到指定页 */
  goToPage: (pageNum: number) => void
  /** 重置到第一页 */
  reset: () => void
  /** 更改每页数量（会重置到第一页） */
  changePageSize: (size: number) => void
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = 1,
    initialPageSize = 20,
    pageSizeOptions = [10, 20, 50, 100]
  } = options

  const page = ref(initialPage)
  const pageSize = ref(initialPageSize)
  const total = ref(0)

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)
  const hasNext = computed(() => page.value < totalPages.value)
  const hasPrev = computed(() => page.value > 1)
  const offset = computed(() => (page.value - 1) * pageSize.value)

  const setTotal = (value: number) => {
    total.value = value
  }

  const nextPage = () => {
    if (hasNext.value) {
      page.value++
    }
  }

  const prevPage = () => {
    if (hasPrev.value) {
      page.value--
    }
  }

  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages.value) {
      page.value = pageNum
    }
  }

  const reset = () => {
    page.value = 1
  }

  const changePageSize = (size: number) => {
    pageSize.value = size
    page.value = 1
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext,
    hasPrev,
    offset,
    pageSizeOptions,
    setTotal,
    nextPage,
    prevPage,
    goToPage,
    reset,
    changePageSize
  }
}
