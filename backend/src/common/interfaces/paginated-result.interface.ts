/**
 * 定义分页查询结果在公共响应体中的承载结构。
 *
 * 该契约需与列表页查询参数、分页组件和 `ApiResponse.paginated` 的返回格式保持一致，
 * 避免前后端对页码、总数和数据列表字段的理解出现偏差。
 */
/**
 * 描述单页列表数据与分页元信息的组合结果。
 */
export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
