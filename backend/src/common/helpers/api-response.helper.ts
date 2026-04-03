import type { IApiResponse } from '../interfaces/api-response.interface';
import type { PaginatedResult } from '../interfaces/paginated-result.interface';

/**
 * 统一构造后端接口的标准响应体。
 *
 * 为控制器与拦截器之外的调用场景提供稳定的 `{ code, message, data }` 契约结构，
 * 避免分页列表与异常兜底响应出现字段漂移。
 */
export class ApiResponse {
  /**
   * 构造标准成功响应体并透传业务数据。
   *
   * @param data - 控制器或服务层返回的业务数据载荷
   * @param message - 成功提示文案，默认使用 `success`
   * @returns 符合 `IApiResponse` 契约的成功响应对象
   */
  static success<T>(data: T, message = 'success'): IApiResponse<T> {
    return { code: 0, message, data };
  }

  /**
   * 构造带分页元数据的标准成功响应体。
   *
   * @param items - 当前页的数据列表
   * @param total - 符合筛选条件的总记录数
   * @param page - 当前页码，从 1 开始计数
   * @param pageSize - 单页返回的记录上限
   * @param message - 成功提示文案，默认使用 `success`
   * @returns 包含分页结果对象的标准响应体
   */
  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    pageSize: number,
    message = 'success',
  ): IApiResponse<PaginatedResult<T>> {
    return {
      code: 0,
      message,
      data: { items, total, page, pageSize },
    };
  }

  /**
   * 构造标准错误响应体并显式返回空数据载荷。
   *
   * @param message - 需要返回给调用方的错误说明
   * @param code - 业务错误码，默认使用 `-1`
   * @returns 符合 `IApiResponse` 契约的错误响应对象
   */
  static error(message: string, code = -1): IApiResponse<null> {
    return { code, message, data: null };
  }
}
