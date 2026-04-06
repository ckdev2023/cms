import { describe, expect, it } from 'vitest'

import { customerDetailRouteRequiresFullPage } from '@/utils/customer-detail-full-route-query'

describe('customerDetailRouteRequiresFullPage', () => {
  it('returns false for plain customer detail navigation (redirect to simple)', () => {
    expect(customerDetailRouteRequiresFullPage({}, '')).toBe(false)
    expect(customerDetailRouteRequiresFullPage({ ccFrom: '/customers' }, '')).toBe(false)
  })

  it('returns true when tab or visa-domain deep link query is present', () => {
    expect(customerDetailRouteRequiresFullPage({ tab: 'visa-domain' }, '')).toBe(true)
    expect(customerDetailRouteRequiresFullPage({ tab: 'basic' }, '')).toBe(true)
    expect(customerDetailRouteRequiresFullPage({ visaDomainBlock: 'logs' }, '')).toBe(true)
    expect(customerDetailRouteRequiresFullPage({ openVisaCaseId: 'x' }, '')).toBe(true)
    expect(customerDetailRouteRequiresFullPage({ logVisaCaseId: 'x' }, '')).toBe(true)
    expect(customerDetailRouteRequiresFullPage({ openVisaCaseWizard: '1' }, '')).toBe(true)
    expect(customerDetailRouteRequiresFullPage({ openVisaCaseLogForm: '1' }, '')).toBe(true)
    expect(customerDetailRouteRequiresFullPage({ suggestedNextFollowUpAt: '2026-01-01' }, '')).toBe(
      true,
    )
    expect(customerDetailRouteRequiresFullPage({ materialsVisaCaseId: 'x' }, '')).toBe(true)
  })

  it('returns false for empty tab string', () => {
    expect(customerDetailRouteRequiresFullPage({ tab: '' }, '')).toBe(false)
  })

  it('returns true for visa-domain stack hash without query', () => {
    expect(customerDetailRouteRequiresFullPage({}, '#visa-domain-logs')).toBe(true)
  })

  it('returns false for unrelated hash', () => {
    expect(customerDetailRouteRequiresFullPage({}, '#other')).toBe(false)
  })
})
