import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  OnModuleDestroy,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

export const IDEMPOTENT_KEY = 'idempotent';
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

interface CachedResponse {
  data: unknown;
  expiresAt: number;
}

const HEADER_NAME = 'x-idempotency-key';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * 为显式声明幂等性的写接口拦截重复请求。
 *
 * 通过 `x-idempotency-key` 组合请求方法与 URL 生成缓存键，在短时间窗口内复用首次成功响应，
 * 并在同一键仍处于处理中时阻止重复提交。
 */
@Injectable()
export class IdempotencyInterceptor
  implements NestInterceptor, OnModuleDestroy
{
  private readonly cache = new Map<string, CachedResponse>();
  private readonly pending = new Set<string>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private readonly reflector: Reflector) {
    this.cleanupTimer = setInterval(() => this.evictExpired(), 60_000);
  }

  /**
   * 对声明为幂等的请求执行缓存命中、并发拦截与响应写回。
   *
   * @param context - 当前请求的 Nest 执行上下文，用于提取路由元数据与请求头
   * @param next - 下游处理器，负责继续执行控制器逻辑
   * @returns 命中缓存时直接返回缓存响应，否则返回下游处理器的响应流
   * @throws {ConflictException} 相同幂等键的请求仍在处理中时抛出
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isIdempotent) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const headerValue = request.headers[HEADER_NAME];
    const idempotencyKey = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    if (!idempotencyKey) return next.handle();

    const cacheKey = `${request.method}:${request.url}:${idempotencyKey}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.data);
    }

    if (this.pending.has(cacheKey)) {
      throw new ConflictException(
        'リクエスト処理中です。しばらくお待ちください。',
      );
    }

    this.pending.add(cacheKey);

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.cache.set(cacheKey, {
            data,
            expiresAt: Date.now() + DEFAULT_TTL_MS,
          });
          this.pending.delete(cacheKey);
        },
        error: () => {
          this.pending.delete(cacheKey);
        },
      }),
    );
  }

  /**
   * 清理已经超过生存时间的幂等缓存记录。
   */
  private evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }

  /**
   * 在模块销毁时停止后台清理定时器，避免测试与热重载残留句柄。
   */
  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }
}
