import { describe, expect, it } from 'vitest'

import {
  buildCustomerDetailReturnFromQuery,
  CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY,
  parseSafeCustomerDetailReturnPath,
} from '@/utils/customer-detail-return-path'

/** 与 `VISA_CASE_IMPORT_LOCAL_UUID_RE` 一致的有效 UUID（测试用）。 */
const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('customer-detail-return-path', () => {
  it('parseSafeCustomerDetailReturnPath accepts hub paths and dashboard', () => {
    expect(parseSafeCustomerDetailReturnPath('/customers')).toBe('/customers')
    expect(parseSafeCustomerDetailReturnPath('/customers/workbench/visa')).toBe(
      '/customers/workbench/visa',
    )
    expect(parseSafeCustomerDetailReturnPath('/dashboard')).toBe('/dashboard')
  })

  it('parseSafeCustomerDetailReturnPath rejects traversal and unknown roots', () => {
    expect(parseSafeCustomerDetailReturnPath('//evil')).toBe(null)
    expect(parseSafeCustomerDetailReturnPath('/unknown/spam')).toBe(null)
    expect(parseSafeCustomerDetailReturnPath('/foo/../bar')).toBe(null)
  })

  it('parseSafeCustomerDetailReturnPath accepts profile and finance detail pathnames', () => {
    expect(parseSafeCustomerDetailReturnPath(`/customers/${SAMPLE_UUID}`)).toBe(`/customers/${SAMPLE_UUID}`)
    expect(parseSafeCustomerDetailReturnPath(`/customers/admin-cases/${SAMPLE_UUID}`)).toBe(
      `/customers/admin-cases/${SAMPLE_UUID}`,
    )
    expect(parseSafeCustomerDetailReturnPath('/finance/invoices/x')).toBe(null)
    expect(parseSafeCustomerDetailReturnPath(`/finance/invoices/${SAMPLE_UUID}`)).toBe(
      `/finance/invoices/${SAMPLE_UUID}`,
    )
  })

  it('buildCustomerDetailReturnFromQuery only emits from when pathname is allowed', () => {
    expect(buildCustomerDetailReturnFromQuery('/customers/visa-cases')).toEqual({
      [CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY]: '/customers/visa-cases',
    })
    expect(buildCustomerDetailReturnFromQuery('/evil')).toEqual({})
  })
})
