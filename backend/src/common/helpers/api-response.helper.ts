import { IApiResponse } from '../interfaces/api-response.interface'
import { PaginatedResult } from '../interfaces/paginated-result.interface'

export class ApiResponse {
  static success<T>(data: T, message = 'success'): IApiResponse<T> {
    return { code: 0, message, data }
  }

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
    }
  }

  static error(message: string, code = -1): IApiResponse<null> {
    return { code, message, data: null }
  }
}
