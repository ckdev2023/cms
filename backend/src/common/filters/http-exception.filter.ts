import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Response } from 'express'
import { ErrorCodes, ErrorCode } from '../constants/error-codes'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let code: ErrorCode = ErrorCodes.UNKNOWN_ERROR

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message as string ||
            exception.message

      if (Array.isArray(message)) {
        message = message.join('; ')
      }

      switch (status) {
        case HttpStatus.BAD_REQUEST:
          code = ErrorCodes.VALIDATION_ERROR
          break
        case HttpStatus.UNAUTHORIZED:
          code = ErrorCodes.UNAUTHORIZED
          break
        case HttpStatus.FORBIDDEN:
          code = ErrorCodes.FORBIDDEN
          break
        case HttpStatus.NOT_FOUND:
          code = ErrorCodes.NOT_FOUND
          break
        case HttpStatus.CONFLICT:
          code = ErrorCodes.DUPLICATE_ENTRY
          break
      }
    } else if (exception instanceof Error) {
      message = exception.message
      this.logger.error(exception.message, exception.stack)
    }

    response.status(status).json({ code, message, data: null })
  }
}
