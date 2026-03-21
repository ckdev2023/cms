import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, tap, catchError, throwError } from 'rxjs'
import type { Request } from 'express'
import { LogService } from '../log.service'
import { AUDIT_ACTION_KEY, type AuditActionMeta } from '../decorators'
import { OperationResult } from '../../../common/constants/enums'

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly logService: LogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditActionMeta | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    )

    if (!meta) return next.handle()

    const req = context.switchToHttp().getRequest<Request>()
    const user = req.user as { id: string } | undefined
    const userId = user?.id ?? null
    const idParam = meta.idParam ?? 'id'
    const targetId = (req.params?.[idParam] as string) ?? null
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      null
    const deviceInfo =
      (req.headers['user-agent'] as string)?.substring(0, 255) ?? null

    return next.handle().pipe(
      tap((responseData) => {
        const createdId =
          targetId ?? (responseData as Record<string, unknown>)?.id ?? null

        this.logService
          .createAuditLog({
            userId,
            actionType: meta.action,
            targetType: meta.targetType,
            targetId: (createdId as string) ?? null,
            afterValue: req.body && Object.keys(req.body).length > 0 ? req.body : null,
            ipAddress,
            deviceInfo,
            result: OperationResult.SUCCESS,
          })
          .catch((err) => this.logger.warn(`Failed to write audit log: ${err}`))
      }),
      catchError((err) => {
        this.logService
          .createAuditLog({
            userId,
            actionType: meta.action,
            targetType: meta.targetType,
            targetId,
            ipAddress,
            deviceInfo,
            result: OperationResult.FAILURE,
          })
          .catch((logErr) => this.logger.warn(`Failed to write audit log: ${logErr}`))

        return throwError(() => err)
      }),
    )
  }
}
