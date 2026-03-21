import { ref, type Ref } from 'vue'
import type { ApiResponse, PaginatedResponse, PaginationParams } from '@/types'

export interface UseProTableOptions {
  defaultPageSize?: number
  immediate?: boolean
}

export function useProTable<T>(
  fetchFn: (
    params: PaginationParams & Record<string, any>,
  ) => Promise<ApiResponse<PaginatedResponse<T>>>,
  options: UseProTableOptions = {},
) {
  const { defaultPageSize = 20, immediate = true } = options

  const loading = ref(false)
  const data = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(defaultPageSize)
  const searchParams = ref<Record<string, any>>({})

  async function fetchData(extraParams?: Record<string, any>) {
    loading.value = true
    try {
      const params = {
        page: page.value,
        pageSize: pageSize.value,
        ...searchParams.value,
        ...extraParams,
      }
      const res = await fetchFn(params)
      data.value = res.data.items
      total.value = res.data.total
    } finally {
      loading.value = false
    }
  }

  function handlePageChange(newPage: number) {
    page.value = newPage
    fetchData()
  }

  function handleSizeChange(newSize: number) {
    pageSize.value = newSize
    page.value = 1
    fetchData()
  }

  function handleSearch(params: Record<string, any>) {
    searchParams.value = params
    page.value = 1
    fetchData()
  }

  function handleReset() {
    searchParams.value = {}
    page.value = 1
    fetchData()
  }

  if (immediate) {
    fetchData()
  }

  return {
    loading,
    data,
    total,
    page,
    pageSize,
    searchParams,
    fetchData,
    handlePageChange,
    handleSizeChange,
    handleSearch,
    handleReset,
  }
}
