/**
 * 定义后端标准接口响应体的统一契约结构。
 *
 * 该契约需与全局响应拦截器和 `ApiResponse` 辅助方法保持一致，
 * 避免控制器直返对象与分页响应的字段命名发生漂移。
 */
/**
 * 描述后端接口返回的通用包裹结构。
 *
 * `data` 字段承载实际业务载荷，`code` 与 `message` 用于表达统一的业务结果状态。
 */
export interface IApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}
