import { SetMetadata } from '@nestjs/common'
import type { AuditActionType, AuditTargetType } from '../../../common/constants/enums'

export const AUDIT_ACTION_KEY = 'audit_action'

export interface AuditActionMeta {
  action: AuditActionType
  targetType: AuditTargetType
  /** Route param name that holds the target entity ID (default: 'id') */
  idParam?: string
}

export const AuditAction = (meta: AuditActionMeta) =>
  SetMetadata(AUDIT_ACTION_KEY, meta)
