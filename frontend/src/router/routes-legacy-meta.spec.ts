import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'

import { P } from '@/constants/permissions'
import { routes } from '@/router/routes'

/**
 * 在静态路由树中按 `name` 查找首个匹配记录。
 *
 * @param records - 路由记录数组
 * @param name - Vue Router 路由名称
 * @returns 命中的记录；未找到时返回 undefined
 */
function findRouteByName(records: readonly RouteRecordRaw[], name: string): RouteRecordRaw | undefined {
  for (const r of records) {
    if (r.name === name) {
      return r
    }
    if (r.children?.length) {
      const hit = findRouteByName(r.children, name)
      if (hit) {
        return hit
      }
    }
  }
  return undefined
}

describe('routes legacy entry meta（docs/21 §14.1 故事 16–17）', () => {
  it('AdminCaseList 仅 admin_case:list 且标记行政并列域', () => {
    const r = findRouteByName(routes, 'AdminCaseList')
    expect(r).toBeDefined()
    expect(r!.meta?.permissions).toEqual([P.ADMIN_CASE_LIST])
    expect(r!.meta?.legacyEntryKind).toBe('adminCases')
  })

  it('VisaWorkbench 为提醒或案件列表权二选一（OR）', () => {
    const r = findRouteByName(routes, 'VisaWorkbench')
    expect(r).toBeDefined()
    expect(r!.meta?.permissions).toEqual([P.VISA_REMINDER_LIST, P.VISA_CASE_LIST])
  })
})

describe('routes visa entry meta（与 backend PermissionCodes / 菜单对齐）', () => {
  it('VisaCaseRegistry 绑定 visaCase:list', () => {
    const r = findRouteByName(routes, 'VisaCaseRegistry')
    expect(r).toBeDefined()
    expect(r!.meta?.permissions).toEqual([P.VISA_CASE_LIST])
  })

  it('VisaReminderList 绑定 visaReminder:list', () => {
    const r = findRouteByName(routes, 'VisaReminderList')
    expect(r).toBeDefined()
    expect(r!.meta?.permissions).toEqual([P.VISA_REMINDER_LIST])
  })

  it('VisaCaseImport 绑定 visaCase:import', () => {
    const r = findRouteByName(routes, 'VisaCaseImport')
    expect(r).toBeDefined()
    expect(r!.meta?.permissions).toEqual([P.VISA_CASE_IMPORT])
  })

  it('AdminCaseVisaSupplement 绑定 visaCase:adminCaseSupplement', () => {
    const r = findRouteByName(routes, 'AdminCaseVisaSupplement')
    expect(r).toBeDefined()
    expect(r!.meta?.permissions).toEqual([P.VISA_CASE_ADMIN_SUPPLEMENT])
  })

  it('ResidenceReminderList 绑定 customer:list 且携带主档在留默认筛选天数', () => {
    const r = findRouteByName(routes, 'ResidenceReminderList')
    expect(r).toBeDefined()
    expect(r!.meta?.permissions).toEqual([P.CUSTOMER_LIST])
    expect(r!.meta?.defaultResidenceExpireWithinDays).toBe(90)
  })
})
