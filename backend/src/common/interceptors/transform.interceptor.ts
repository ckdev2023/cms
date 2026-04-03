import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 将普通控制器返回值包装为统一的标准响应结构。
 *
 * 已经显式返回 `{ code, message }` 契约的结果会被原样透传，
 * 其余返回值统一补齐默认成功码与消息，减少控制器中重复样板代码。
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T> {
  /**
   * 在响应流结束前补齐标准成功响应结构。
   *
   * @param _context - 当前请求的 Nest 执行上下文；此实现中保留签名以兼容拦截器接口
   * @param next - 下游处理器返回的响应流
   * @returns 已包装为标准响应结构的响应流
   */
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown): unknown => {
        if (
          data &&
          typeof data === 'object' &&
          'code' in data &&
          'message' in data
        ) {
          return data;
        }
        return { code: 0, message: 'success', data };
      }),
    );
  }
}
