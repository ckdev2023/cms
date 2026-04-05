import { describe, expect, it } from 'vitest'

import type { ProTableColumn } from '@/types/components'

import {
  CUSTOMER_LIST_TABLE_COLUMN_ORDER,
  normalizeCustomerListColumnPresetId,
  pickCustomerListTableColumns,
} from './customer-list-column-presets'

/**
 * 构造与全量客户列表 `prop` 顺序一致的最小 ProTable 列桩，供列预设过滤单测使用。
 *
 * @returns 桩数据列配置数组
 */
function mockColumns(): ProTableColumn[] {
  return CUSTOMER_LIST_TABLE_COLUMN_ORDER.map((prop) => ({
    prop,
    label: prop,
  }))
}

describe('normalizeCustomerListColumnPresetId', () => {
  it('returns standard for empty or unknown', () => {
    expect(normalizeCustomerListColumnPresetId(undefined)).toBe('standard')
    expect(normalizeCustomerListColumnPresetId(null)).toBe('standard')
    expect(normalizeCustomerListColumnPresetId('')).toBe('standard')
    expect(normalizeCustomerListColumnPresetId('bogus')).toBe('standard')
  })

  it('accepts valid ids', () => {
    expect(normalizeCustomerListColumnPresetId('compact')).toBe('compact')
    expect(normalizeCustomerListColumnPresetId('full')).toBe('full')
  })
})

describe('pickCustomerListTableColumns', () => {
  it('full preset keeps all columns in order', () => {
    const cols = mockColumns()
    const out = pickCustomerListTableColumns(cols, 'full')
    expect(out.map((c) => c.prop)).toEqual([...CUSTOMER_LIST_TABLE_COLUMN_ORDER])
  })

  it('compact preset hides residence and extended primary columns', () => {
    const cols = mockColumns()
    const out = pickCustomerListTableColumns(cols, 'compact')
    const props = out.map((c) => c.prop)
    expect(props).not.toContain('residenceExpireDateCol')
    expect(props).not.toContain('listPrimaryCaseFamily')
    expect(props).toContain('listPrimaryCaseStatus')
    expect(props).toContain('customerCode')
  })

  it('standard preset is a superset of compact and subset of full', () => {
    const cols = mockColumns()
    const compact = new Set(
      pickCustomerListTableColumns(cols, 'compact').map((c) => c.prop),
    )
    const standard = new Set(
      pickCustomerListTableColumns(cols, 'standard').map((c) => c.prop),
    )
    const full = new Set(
      pickCustomerListTableColumns(cols, 'full').map((c) => c.prop),
    )
    for (const p of compact) {
      expect(standard.has(p)).toBe(true)
    }
    for (const p of standard) {
      expect(full.has(p)).toBe(true)
    }
    expect(standard.has('visaDerivedRisk')).toBe(true)
    expect(standard.has('listPrimaryCaseFamily')).toBe(false)
  })
})
