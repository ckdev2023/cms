import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { type ErrorCode, ErrorCodes } from '../constants/error-codes';

type HttpExceptionResponseBody = {
  message?: string | string[];
};

/**
 * 将运行时异常统一转换为前端约定的 `{ code, message, data }` 响应结构。
 *
 * 过滤器会保留 HttpException 的状态码，并为未知异常兜底返回 500 与 `UNKNOWN_ERROR`。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /**
   * 拦截控制器与管道抛出的异常，并写入统一的 HTTP 错误响应体。
   *
   * 已知 HttpException 会沿用原始状态码；非 HttpException 的 Error 会记录日志后按 500 返回。
   *
   * @param exception - NestJS 请求链路中抛出的异常对象
   * @param host - 当前执行上下文，用于提取 HTTP 响应对象
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: ErrorCode = ErrorCodes.UNKNOWN_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = this.resolveHttpMessage(exception);
      code = this.resolveErrorCode(status);
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({ code, message, data: null });
  }

  /**
   * 从 HttpException 的响应载荷中提取最终返回给前端的错误文案。
   *
   * @param exception - 已知的 HttpException 实例
   * @returns 优先使用框架响应体中的 message；缺失时回退到异常对象自身的 message
   */
  private resolveHttpMessage(exception: HttpException): string {
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const { message } = exceptionResponse as HttpExceptionResponseBody;

      if (Array.isArray(message)) {
        return message.join('; ');
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    return exception.message;
  }

  /**
   * 将 HTTP 状态码映射为系统统一的业务错误码。
   *
   * @param status - 将要返回给客户端的 HTTP 状态码
   * @returns 与状态码对应的业务错误码；未显式映射时返回 `UNKNOWN_ERROR`
   */
  private resolveErrorCode(status: HttpStatus): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCodes.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCodes.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCodes.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCodes.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCodes.DUPLICATE_ENTRY;
      default:
        return ErrorCodes.UNKNOWN_ERROR;
    }
  }
}
