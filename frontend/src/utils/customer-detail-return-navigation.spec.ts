import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

import {
  CUSTOMER_DETAIL_RETURN_QUERY_KEY,
  isSafeCustomerDetailReturnPath,
  isTrustedCustomerDetailHistoryBack,
  mergeCustomerDetailReturnQuery,
  parseCustomerDetailReturnTarget,
  pickCustomerDetailDeepLinkPreserve,
} from '@/utils/customer-detail-return-navigation'
import { CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY } from '@/utils/customer-detail-return-path'

/** 与 `VISA_CASE_IMPORT_LOCAL_UUID_RE` 一致的有效 UUID（测试用）。 */
const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('customer-detail-return-navigation', () => {
  it('isSafeCustomerDetailReturnPath rejects traversal, unknown paths, and absolute URLs', () => {
    expect(isSafeCustomerDetailReturnPath('/customers')).toBe(true)
    expect(isSafeCustomerDetailReturnPath('/customers/workbench/visa?dataScope=team')).toBe(true)
    expect(isSafeCustomerDetailReturnPath('//evil.com')).toBe(false)
    expect(isSafeCustomerDetailReturnPath('/foo/../bar')).toBe(false)
    expect(isSafeCustomerDetailReturnPath('https://x')).toBe(false)
    expect(isSafeCustomerDetailReturnPath('')).toBe(false)
    expect(isSafeCustomerDetailReturnPath('/unknown/spam')).toBe(false)
  })

  it('parseCustomerDetailReturnTarget reads ccFrom and filters query', () => {
    expect(
      parseCustomerDetailReturnTarget({
        [CUSTOMER_DETAIL_RETURN_QUERY_KEY]: '/customers/visa-reminders?dataScope=mine',
      }),
    ).toEqual({ path: '/customers/visa-reminders', query: { dataScope: 'mine' } })
    expect(parseCustomerDetailReturnTarget({ [CUSTOMER_DETAIL_RETURN_QUERY_KEY]: '//x' })).toBe(null)
    expect(parseCustomerDetailReturnTarget({})).toBe(null)
  })

  it('mergeCustomerDetailReturnQuery writes ccFrom fullPath when safe', () => {
    const q: Record<string, string> = { tab: 'visa-domain' }
    mergeCustomerDetailReturnQuery(q, {
      path: '/customers/workbench/visa',
      fullPath: '/customers/workbench/visa',
    } as RouteLocationNormalizedLoaded)
    expect(q[CUSTOMER_DETAIL_RETURN_QUERY_KEY]).toBe('/customers/workbench/visa')
    expect(q[CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY]).toBe('/customers/workbench/visa')
  })

  it('mergeCustomerDetailReturnQuery respects overrideFullPath', () => {
    const q: Record<string, string> = {}
    mergeCustomerDetailReturnQuery(
      q,
      {
        path: `/customers/${SAMPLE_UUID}`,
        fullPath: `/customers/${SAMPLE_UUID}?tab=basic`,
      } as RouteLocationNormalizedLoaded,
      { overrideFullPath: `/customers/${SAMPLE_UUID}` },
    )
    expect(q[CUSTOMER_DETAIL_RETURN_QUERY_KEY]).toBe(`/customers/${SAMPLE_UUID}`)
  })

  it('pickCustomerDetailDeepLinkPreserve merges dataScope assignedTo, ccFrom, and from', () => {
    expect(
      pickCustomerDetailDeepLinkPreserve({
        dataScope: 'team',
        assignedTo: SAMPLE_UUID,
        [CUSTOMER_DETAIL_RETURN_QUERY_KEY]: '/customers/visa-cases',
        [CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY]: '/customers/visa-reminders',
      }),
    ).toEqual({
      dataScope: 'team',
      assignedTo: SAMPLE_UUID,
      [CUSTOMER_DETAIL_RETURN_QUERY_KEY]: '/customers/visa-cases',
      [CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY]: '/customers/visa-reminders',
    })
  })

  it('isTrustedCustomerDetailHistoryBack validates pathname allowlist', () => {
    expect(isTrustedCustomerDetailHistoryBack('/customers/workbench/visa', '/customers/x')).toBe(true)
    expect(isTrustedCustomerDetailHistoryBack('/customers/workbench/visa', '/customers/workbench/visa')).toBe(
      false,
    )
    expect(isTrustedCustomerDetailHistoryBack('//evil', '/x')).toBe(false)
  })
})
