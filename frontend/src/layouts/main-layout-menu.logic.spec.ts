import { describe, expect, it, vi } from 'vitest'

import { allMenuItems } from '@/layouts/main-layout-menu.config'
import {
  filterVisibleMainLayoutMenuItems,
  localizeMainLayoutMenuItems,
  visaMenuDefaultOpenedsFromItems,
} from '@/layouts/main-layout-menu.logic'
import type { MenuItem } from '@/layouts/main-layout-menu.types'

describe('filterVisibleMainLayoutMenuItems', () => {
  it('客户中心单入口在具备客户列表权限时保留', () => {
    const has = (perms?: string[]): boolean => (perms ?? []).some((p) => p === 'customer:list')
    const out = filterVisibleMainLayoutMenuItems(allMenuItems, has)
    const customer = out.find((i) => i.path === '/customers')
    expect(customer).toBeDefined()
    expect(customer?.children).toBeUndefined()
  })

  it('客户中心在完全不满足其权限并集时移除', () => {
    const has = (): boolean => false
    const out = filterVisibleMainLayoutMenuItems(allMenuItems, has)
    expect(out.some((i) => i.path === '/customers')).toBe(false)
  })
})

describe('visaMenuDefaultOpenedsFromItems', () => {
  it('扁平客户中心后不再默认展开分组', () => {
    const hubOnly: MenuItem[] = [
      {
        path: '/customers',
        titleKey: 'routes.customers',
        icon: allMenuItems[1]!.icon,
        permissions: ['customer:list'],
      },
    ]
    expect(visaMenuDefaultOpenedsFromItems(hubOnly)).toEqual([])
  })
})

describe('localizeMainLayoutMenuItems', () => {
  it('解析分组子项 title 与副标题键', () => {
    const t = vi.fn((k: string) => (k === 'routes.invoices' ? '发票' : k))
    const finance: MenuItem[] = [
      {
        path: '/finance',
        titleKey: 'routes.finance',
        icon: allMenuItems[3]!.icon,
        permissions: ['finance:list'],
        children: [
          {
            path: '/finance/invoices',
            titleKey: 'routes.invoices',
            menuSubtitleKey: 'routes.workbenchVisaMenuSubtitle',
          },
        ],
      },
    ]
    const out = localizeMainLayoutMenuItems(finance, t)
    expect(out[0]?.children?.[0]?.title).toBe('发票')
    expect(out[0]?.children?.[0]?.menuSubtitle).toBe('routes.workbenchVisaMenuSubtitle')
  })
})
