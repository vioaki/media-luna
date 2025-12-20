/**
 * 数据获取 composable
 * 结合 useLoading 和 usePagination，提供完整的数据获取能力
 */
import { ref, Ref, watch, onMounted } from 'vue'
import { useLoading, UseLoadingOptions } from './useLoading'
import { usePagination, UsePaginationOptions } from './usePagination'

export interface UseDataFetchOptions<T> extends UseLoadingOptions, UsePaginationOptions {
  /** 是否在挂载时自动获取 */
  immediate?: boolean
  /** 是否启用分页 */
  paginated?: boolean
  /** 数据获取函数 */
  fetchFn: (params: { offset: number; limit: number }) => Promise<{ items: T[]; total: number } | T[]>
}

export interface UseDataFetchReturn<T> {
  /** 数据列表 */
  data: Ref<T[]>
  /** 加载状态 */
  loading: Ref<boolean>
  /** 错误信息 */
  error: Ref<string | null>
  /** 分页信息（如果启用） */
  pagination: ReturnType<typeof usePagination> | null
  /** 刷新数据 */
  refresh: () => Promise<void>
  /** 重置并刷新（回到第一页） */
  reset: () => Promise<void>
}

export function useDataFetch<T>(options: UseDataFetchOptions<T>): UseDataFetchReturn<T> {
  const {
    immediate = true,
    paginated = false,
    fetchFn,
    ...loadingOptions
  } = options

  const data = ref<T[]>([]) as Ref<T[]>
  const { loading, error, withLoading } = useLoading(loadingOptions)
  const pagination = paginated ? usePagination(options) : null

  const fetchData = async () => {
    const params = pagination
      ? { offset: pagination.offset.value, limit: pagination.pageSize.value }
      : { offset: 0, limit: 1000 }

    await withLoading(async () => {
      const result = await fetchFn(params)

      if (Array.isArray(result)) {
        // 非分页响应
        data.value = result
        if (pagination) {
          pagination.setTotal(result.length)
        }
      } else {
        // 分页响应
        data.value = result.items
        if (pagination) {
          pagination.setTotal(result.total)
        }
      }
    })
  }

  const refresh = async () => {
    await fetchData()
  }

  const reset = async () => {
    if (pagination) {
      pagination.reset()
    }
    await fetchData()
  }

  // 监听分页变化
  if (pagination) {
    watch([pagination.page, pagination.pageSize], () => {
      fetchData()
    })
  }

  // 自动获取
  if (immediate) {
    onMounted(() => {
      fetchData()
    })
  }

  return {
    data,
    loading,
    error,
    pagination,
    refresh,
    reset
  }
}
