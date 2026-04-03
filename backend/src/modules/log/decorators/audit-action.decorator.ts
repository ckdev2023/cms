import { SetMetadata } from '@nestjs/common';

import type {
  AuditActionType,
  AuditTargetType,
} from '../../../common/constants/enums';

/**
 * 标记审计日志动作配置的元数据键。
 *
 * 审计拦截器或日志模块会读取该元数据，识别当前路由对应的业务动作与目标实体类型。
 */
export const AUDIT_ACTION_KEY = 'audit_action';

/**
 * 描述审计日志装饰器写入的元数据结构。
 *
 * 用于声明当前接口对应的审计动作、目标实体类型，以及从路由参数中提取业务主键的字段名。
 */
export interface AuditActionMeta {
  /** 当前接口触发的审计动作类型。 */
  action: AuditActionType;
  /** 当前接口关联的审计目标实体类型。 */
  targetType: AuditTargetType;
  /** 保存目标实体 ID 的路由参数名，默认使用 `id`。 */
  idParam?: string;
}

/**
 * 为控制器或路由声明审计日志动作元数据。
 *
 * @param meta 当前接口对应的审计动作配置。
 * @returns 写入审计动作元数据的 Nest 装饰器。
 */
export const AuditAction = (meta: AuditActionMeta) =>
  SetMetadata(AUDIT_ACTION_KEY, meta);
