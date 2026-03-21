import { SetMetadata } from '@nestjs/common'

export const PERMISSIONS_KEY = 'permissions'

/**
 * Require one or more permission codes for this route.
 * The user must have **at least one** of the listed permissions.
 *
 * @example `@Permissions('customer:create')`
 * @example `@Permissions('finance:edit', 'finance:create')`
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions)
