import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';

import { OperationResult } from '../../../common/constants/enums';
import { AUDIT_ACTION_KEY, type AuditActionMeta } from '../decorators';
import { LogService } from '../log.service';

type AuditRequest = Request & {
  user?: {
    id?: string;
  };
};

type AuditLogBasePayload = {
  actionType: AuditActionMeta['action'];
  deviceInfo: string | null;
  ipAddress: string | null;
  targetId: string | null;
  targetType: AuditActionMeta['targetType'];
  userId: string | null;
};

/**
 * 在带有审计动作元数据的请求完成后异步补写操作日志。
 *
 * 拦截器会从请求上下文中提取操作者、目标对象、来源 IP 与设备信息；
 * 即使日志写入失败，也只记录告警，不影响主业务接口的返回结果。
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly logService: LogService,
  ) {}

  /**
   * 拦截带 `@AuditAction()` 元数据的 HTTP 请求，并分别记录成功或失败的审计结果。
   *
   * @param context - 当前请求对应的 Nest 执行上下文
   * @param next - 拦截器链中的下一个处理节点
   * @returns 保持原始响应语义的 Observable；审计日志在旁路异步写入
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditActionMeta | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );

    if (!meta) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AuditRequest>();
    const basePayload = this.buildBasePayload(req, meta);

    return next.handle().pipe(
      tap((responseData) => {
        this.writeAuditLog({
          ...basePayload,
          targetId:
            basePayload.targetId ?? this.extractResponseTargetId(responseData),
          afterValue: this.extractRequestBody(req.body),
          result: OperationResult.SUCCESS,
        });
      }),
      catchError((error: unknown) => {
        this.writeAuditLog({
          ...basePayload,
          result: OperationResult.FAILURE,
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * 汇总当前请求写审计日志所需的基础字段，避免成功/失败分支重复解析请求对象。
   *
   * @param req - 已进入路由处理链的 HTTP 请求对象
   * @param meta - `@AuditAction()` 装饰器声明的审计动作元数据
   * @returns 可直接复用于成功和失败日志写入的基础字段集合
   */
  private buildBasePayload(
    req: AuditRequest,
    meta: AuditActionMeta,
  ): AuditLogBasePayload {
    return {
      userId: req.user?.id ?? null,
      actionType: meta.action,
      targetType: meta.targetType,
      targetId: this.extractRouteTargetId(req, meta.idParam ?? 'id'),
      ipAddress: this.extractIpAddress(req),
      deviceInfo: this.extractDeviceInfo(req),
    };
  }

  /**
   * 从路由参数中解析审计目标 ID，兼容缺省主键参数名为 `id` 的场景。
   *
   * @param req - 当前 HTTP 请求对象
   * @param idParam - 审计元数据声明的目标 ID 参数名
   * @returns 命中的路由参数值；不存在或为空时返回 `null`
   */
  private extractRouteTargetId(
    req: AuditRequest,
    idParam: string,
  ): string | null {
    const rawTargetId = req.params?.[idParam];
    return typeof rawTargetId === 'string' && rawTargetId.length > 0
      ? rawTargetId
      : null;
  }

  /**
   * 从代理头或直连请求中解析最可信的来源 IP 地址。
   *
   * @param req - 当前 HTTP 请求对象
   * @returns 首个代理转发 IP；若不存在则回退为 Nest 注入的 `req.ip`
   */
  private extractIpAddress(req: AuditRequest): string | null {
    const forwardedFor = req.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim() || req.ip || null;
    }

    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0]?.trim() || req.ip || null;
    }

    return req.ip || null;
  }

  /**
   * 截断并返回请求头中的设备标识，避免超长 User-Agent 写入日志字段。
   *
   * @param req - 当前 HTTP 请求对象
   * @returns 最长 255 个字符的设备标识；请求头缺失时返回 `null`
   */
  private extractDeviceInfo(req: AuditRequest): string | null {
    const userAgent = req.headers['user-agent'];

    if (typeof userAgent === 'string') {
      return userAgent.substring(0, 255);
    }

    return null;
  }

  /**
   * 从响应对象中提取新建资源的 ID，供创建类操作补全审计目标。
   *
   * @param responseData - 控制器或服务最终返回的响应载荷
   * @returns 响应体中的字符串 ID；未命中时返回 `null`
   */
  private extractResponseTargetId(responseData: unknown): string | null {
    if (
      typeof responseData === 'object' &&
      responseData !== null &&
      'id' in responseData &&
      typeof responseData.id === 'string'
    ) {
      return responseData.id;
    }

    return null;
  }

  /**
   * 提取请求体中可序列化的对象快照，避免把空对象或非对象值写入审计日志。
   *
   * @param body - 请求体原始载荷
   * @returns 具备键值的对象快照；为空或非对象时返回 `null`
   */
  private extractRequestBody(body: unknown): Record<string, unknown> | null {
    if (
      typeof body === 'object' &&
      body !== null &&
      !Array.isArray(body) &&
      Object.keys(body).length > 0
    ) {
      return body as Record<string, unknown>;
    }

    return null;
  }

  /**
   * 以“旁路失败不阻断主流程”的策略提交审计日志写入任务。
   *
   * @param payload - 传给日志服务的审计日志载荷
   */
  private writeAuditLog(
    payload: Parameters<LogService['createAuditLog']>[0],
  ): void {
    void this.logService.createAuditLog(payload).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to write audit log: ${message}`);
    });
  }
}
