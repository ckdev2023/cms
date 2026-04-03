/**
 * 定义后端统一响应体使用的错误码常量。
 *
 * 错误码应保持稳定且唯一，供异常过滤器、前端提示映射和接口文档共同引用。
 */
export const ErrorCodes = {
  SUCCESS: 0,
  UNKNOWN_ERROR: -1,
  VALIDATION_ERROR: 1001,
  UNAUTHORIZED: 1002,
  FORBIDDEN: 1003,
  NOT_FOUND: 1004,
  DUPLICATE_ENTRY: 1005,
  INVALID_OPERATION: 1006,
  RATE_LIMIT_EXCEEDED: 1007,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
