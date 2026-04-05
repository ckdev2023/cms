import { describe, expect, it } from 'vitest'

import { routePermissionsGranted } from '@/router/route-permission.util'

describe('routePermissionsGranted', () => {
  it('空要求时放行', () => {
    expect(routePermissionsGranted([], () => false)).toBe(true)
  })

  it('命中 permissions 任一则通过（OR）', () => {
    const has = (p: string): boolean => p === 'a'
    expect(routePermissionsGranted(['a', 'b'], has)).toBe(true)
  })

  it('全部未命中时拒绝', () => {
    const has = (): boolean => false
    expect(routePermissionsGranted(['x', 'y'], has)).toBe(false)
  })
})
