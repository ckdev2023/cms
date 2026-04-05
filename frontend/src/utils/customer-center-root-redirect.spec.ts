import { describe, expect, it } from 'vitest'

import {
  resolveDefaultCustomerCenterHubEntryFullPath,
  shouldSkipDefaultCustomerCenterWorkbenchRedirect,
} from './customer-center-root-redirect'

describe('resolveDefaultCustomerCenterHubEntryFullPath', () => {
  it('returns first visible tab in the first non-empty group by hub order', () => {
    expect(
      resolveDefaultCustomerCenterHubEntryFullPath([
        { fullPath: '/customers', group: 'master' },
        { fullPath: '/customers/workbench/visa', group: 'todayOps' },
        { fullPath: '/customers/visa-reminders', group: 'todayOps' },
      ]),
    ).toBe('/customers/workbench/visa')
  })

  it('skips empty leading groups and uses the first tab in the next group', () => {
    expect(
      resolveDefaultCustomerCenterHubEntryFullPath([
        { fullPath: '/customers', group: 'master' },
        { fullPath: '/customers/visa-cases', group: 'master' },
      ]),
    ).toBe('/customers')
  })

  it('uses registryTools first tab when it is the only non-empty group', () => {
    expect(
      resolveDefaultCustomerCenterHubEntryFullPath([
        { fullPath: '/customers/visa-case-import', group: 'registryTools' },
      ]),
    ).toBe('/customers/visa-case-import')
  })

  it('returns null when there are no visible tabs', () => {
    expect(resolveDefaultCustomerCenterHubEntryFullPath([])).toBeNull()
  })

  it('uses first sidebar-visible item when todayOps has only sidebar-hidden tabs before master (aligns with el-menu)', () => {
    expect(
      resolveDefaultCustomerCenterHubEntryFullPath([
        { fullPath: '/customers', group: 'master' },
        {
          fullPath: '/customers/visa-reminders',
          group: 'todayOps',
          showInCustomerCenterSidebar: false,
        },
        { fullPath: '/customers/residence-reminders', group: 'todayOps' },
      ]),
    ).toBe('/customers/residence-reminders')
  })

  it('falls back to hub flat order when no sidebar items exist (e.g. only full-list tab)', () => {
    expect(
      resolveDefaultCustomerCenterHubEntryFullPath([
        {
          fullPath: '/customers/visa-reminders',
          group: 'todayOps',
          showInCustomerCenterSidebar: false,
        },
      ]),
    ).toBe('/customers/visa-reminders')
  })
})

describe('shouldSkipDefaultCustomerCenterWorkbenchRedirect', () => {
  it('returns false when there is no previous path (sidebar / first entry)', () => {
    expect(shouldSkipDefaultCustomerCenterWorkbenchRedirect(null)).toBe(false)
  })

  it('returns false when previous path is outside customer center', () => {
    expect(shouldSkipDefaultCustomerCenterWorkbenchRedirect('/dashboard')).toBe(false)
  })

  it('returns true when previous path is exactly /customers to avoid replace fighting hub selection', () => {
    expect(shouldSkipDefaultCustomerCenterWorkbenchRedirect('/customers')).toBe(true)
  })

  it('returns true when coming from a customer center child such as workbench', () => {
    expect(shouldSkipDefaultCustomerCenterWorkbenchRedirect('/customers/workbench/visa')).toBe(true)
  })

  it('returns true when coming from visa reminders child path', () => {
    expect(shouldSkipDefaultCustomerCenterWorkbenchRedirect('/customers/visa-reminders')).toBe(true)
  })
})
