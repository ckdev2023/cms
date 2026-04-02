/**
 * 定义前端请求层复用的基础响应体与分页查询类型。
 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T = unknown> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  keyword?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}
