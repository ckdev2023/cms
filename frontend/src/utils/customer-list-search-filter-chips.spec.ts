import { describe, expect, it } from 'vitest'
import type { ComposerTranslation } from 'vue-i18n'

import { CustomerStatus, CustomerType, ServiceType } from '@/constants/enums'
import type { CustomerQueryParams } from '@/types/customer'

import {
  buildCustomerListFilterChips,
  clearCustomerListFilterChip,
} from './customer-list-search-filter-chips'

/**
 * 构造测试用最小 Composer `t`：返回键名，忽略占位符参数。
 *
 * @returns 可传入 `buildCustomerListFilterChips` 的翻译函数替身
 */
function createFakeComposerT(): ComposerTranslation {
  return ((key: string) => key) as ComposerTranslation
}

const fakeT = createFakeComposerT()

describe('buildCustomerListFilterChips', () => {
  it('returns empty array when no filters are set', () => {
    const f: CustomerQueryParams = {}
    expect(buildCustomerListFilterChips(f, fakeT)).toStrictEqual([])
  })

  it('includes keyword chip when keyword is non-empty', () => {
    const f: CustomerQueryParams = { keyword: '  acme  ' }
    const chips = buildCustomerListFilterChips(f, fakeT)
    expect(chips).toHaveLength(1)
    expect(chips[0]?.id).toBe('keyword')
    expect(chips[0]?.label).toContain('acme')
  })

  it('appends customer master chips in stable order', () => {
    const f: CustomerQueryParams = {
      customerType: CustomerType.PERSONAL,
      serviceType: ServiceType.TAX,
      status: CustomerStatus.ACTIVE,
    }
    const chips = buildCustomerListFilterChips(f, fakeT)
    expect(chips.map((c) => c.id)).toEqual(['customerType', 'serviceType', 'status'])
  })
})

describe('clearCustomerListFilterChip', () => {
  it('clears the matching field only', () => {
    const f: CustomerQueryParams = {
      keyword: 'x',
      customerType: CustomerType.COMPANY,
    }
    clearCustomerListFilterChip(f, 'keyword')
    expect(f.keyword).toBe('')
    expect(f.customerType).toBe(CustomerType.COMPANY)
  })
})
