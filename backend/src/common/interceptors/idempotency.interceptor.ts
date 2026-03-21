import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, of } from 'rxjs'
import { tap } from 'rxjs/operators'

export const IDEMPOTENT_KEY = 'idempotent'
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true)

interface CachedResponse {
  data: any
  expiresAt: number
}

const HEADER_NAME = 'x-idempotency-key'
const DEFAULT_TTL_MS = 5 * 60 * 1000

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, CachedResponse>()
  private readonly pending = new Set<string>()
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor(private readonly reflector: Reflector) {
    this.cleanupTimer = setInterval(() => this.evictExpired(), 60_000)
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (!isIdempotent) return next.handle()

    const request = context.switchToHttp().getRequest()
    const idempotencyKey = request.headers[HEADER_NAME] as string | undefined

    if (!idempotencyKey) return next.handle()

    const cacheKey = `${request.method}:${request.url}:${idempotencyKey}`

    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.data)
    }

    if (this.pending.has(cacheKey)) {
      throw new ConflictException('リクエスト処理中です。しばらくお待ちください。')
    }

    this.pending.add(cacheKey)

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.cache.set(cacheKey, {
            data,
            expiresAt: Date.now() + DEFAULT_TTL_MS,
          })
          this.pending.delete(cacheKey)
        },
        error: () => {
          this.pending.delete(cacheKey)
        },
      }),
    )
  }

  private evictExpired() {
    const now = Date.now()
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key)
    }
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer)
  }
}
