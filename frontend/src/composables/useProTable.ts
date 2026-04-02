import { type Ref,ref } from 'vue'

import type { ApiResponse, PaginatedResponse, PaginationParams } from '@/types'

export interface UseProTableOptions {
  defaultPageSize?: number
  immediate?: boolean
}

type ProTableQueryParams = PaginationParams & Record<string, unknown>

/**
 * 管理分页表格的数据装载、检索条件与分页状态。
 *
 * 支持列表首屏自动拉取、查询条件缓存，以及分页切换后的统一刷新逻辑。
 *
 * @param fetchFn - 接收分页与检索参数并返回分页响应的请求函数
 * @param options - 表格初始化配置，支持首屏是否立即加载与默认分页大小
 * @returns 包含表格数据、分页状态与查询交互方法的对象
 */
export function useProTable<T, TQuery extends ProTableQueryParams = ProTableQueryParams>(
  fetchFn: (
    params: TQuery,
  ) => Promise<ApiResponse<PaginatedResponse<T>>>,
  options: UseProTableOptions = {},
) {
  const { defaultPageSize = 20, immediate = true } = options

  const loading = ref(false)
  const data = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(defaultPageSize)
  const searchParams = ref<Partial<TQuery>>({})

  /**
   * 按当前分页与检索条件重新加载表格数据。
   *
   * @param extraParams - 本次请求临时追加的检索参数，会覆盖同名已保存条件
   */
  async function fetchData(extraParams?: Partial<TQuery>): Promise<void> {
    loading.value = true
    try {
      const params: TQuery = {
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

  /**
   * 切换页码后刷新当前表格数据。
   *
   * @param newPage - 用户切换后的目标页码
   */
  function handlePageChange(newPage: number) {
    page.value = newPage
    void fetchData()
  }

  /**
   * 调整每页条数后重置到首页并重新查询。
   *
   * @param newSize - 新的每页展示条数
   */
  function handleSizeChange(newSize: number) {
    pageSize.value = newSize
    page.value = 1
    void fetchData()
  }

  /**
   * 保存新的检索条件并从第一页重新拉取数据。
   *
   * @param params - 最新的查询表单参数
   */
  function handleSearch(params: Partial<TQuery>) {
    searchParams.value = params
    page.value = 1
    void fetchData()
  }

  /**
   * 清空当前检索条件并恢复到第一页。
   */
  function handleReset() {
    searchParams.value = {}
    page.value = 1
    void fetchData()
  }

  if (immediate) {
    void fetchData()
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
