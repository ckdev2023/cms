import { describe, expect, it } from 'vitest'

import {
  buildVisibleCustomerCenterSidebarGroups,
  customerCenterSidebarGroupTitleKey,
  customerCenterTabDefs,
  filterVisibleCustomerCenterTabs,
  resolveVisibleCustomerCenterSidebarGroups,
} from '@/layouts/customer-center-tabs.config'
import { resolveDefaultCustomerCenterHubEntryFullPath } from '@/utils/customer-center-root-redirect'

describe('customerCenterSidebarGroupTitleKey', () => {
  it('与 layout.customerCenterGroup 分段键一致', () => {
    expect(customerCenterSidebarGroupTitleKey('todayOps')).toBe('layout.customerCenterGroup.todayOps')
    expect(customerCenterSidebarGroupTitleKey('master')).toBe('layout.customerCenterGroup.master')
    expect(customerCenterSidebarGroupTitleKey('registryTools')).toBe(
      'layout.customerCenterGroup.registryTools',
    )
  })
})

describe('buildVisibleCustomerCenterSidebarGroups', () => {
  it('剔除 showInCustomerCenterSidebar 为 false 的 Tab，且组内顺序与入参稳定顺序一致', () => {
    const visible = customerCenterTabDefs.filter((d) => d.group === 'todayOps')
    const groups = buildVisibleCustomerCenterSidebarGroups(visible)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.group).toBe('todayOps')
    expect(groups[0]?.items.map((i) => i.fullPath)).toEqual([
      '/customers/workbench/visa',
      '/customers/residence-reminders',
    ])
    expect(groups[0]?.items.some((i) => i.fullPath === '/customers/visa-reminders')).toBe(false)
  })

  it('无子项的分组不出现在结果中', () => {
    const onlyHidden = customerCenterTabDefs.filter(
      (d) => d.fullPath === '/customers/visa-reminders',
    )
    expect(buildVisibleCustomerCenterSidebarGroups(onlyHidden)).toEqual([])
  })
})

describe('resolveVisibleCustomerCenterSidebarGroups', () => {
  it('等价于 filterVisibleCustomerCenterTabs 后再 buildVisibleCustomerCenterSidebarGroups', () => {
    const hasAll = (): boolean => true
    const visible = filterVisibleCustomerCenterTabs(customerCenterTabDefs, hasAll)
    expect(resolveVisibleCustomerCenterSidebarGroups(hasAll)).toEqual(
      buildVisibleCustomerCenterSidebarGroups(visible),
    )
  })

  it('全权限下今日待办侧栏不含 visa-reminders 全表项', () => {
    const hasAll = (): boolean => true
    const today = resolveVisibleCustomerCenterSidebarGroups(hasAll).find((g) => g.group === 'todayOps')
    expect(today?.items.map((i) => i.fullPath)).not.toContain('/customers/visa-reminders')
  })

  it('侧栏第一项与 `/customers` 默认 replace 目标一致（全权限，对齐 CustomerCenterLayout watch）', () => {
    const hasAll = (): boolean => true
    const visible = filterVisibleCustomerCenterTabs(customerCenterTabDefs, hasAll)
    const groups = buildVisibleCustomerCenterSidebarGroups(visible)
    const firstSidebarPath = groups[0]?.items[0]?.fullPath
    expect(firstSidebarPath).toBeDefined()
    expect(resolveDefaultCustomerCenterHubEntryFullPath(visible)).toBe(firstSidebarPath)
  })
})
