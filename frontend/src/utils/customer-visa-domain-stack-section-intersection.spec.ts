import { describe, expect, it } from 'vitest'

import {
  pickVisaDomainStackActiveBlockByRatios,
  visaDomainStackObserverRootMargin,
} from './customer-visa-domain-stack-section-intersection'

describe('visaDomainStackObserverRootMargin', () => {
  it('returns wider vertical shrink on wide layout match', () => {
    expect(visaDomainStackObserverRootMargin(true)).toContain('-34%')
    expect(visaDomainStackObserverRootMargin(false)).toContain('-20%')
  })
})

describe('pickVisaDomainStackActiveBlockByRatios', () => {
  it('returns null when no ratio clears noise threshold', () => {
    const m = new Map<string, number>([
      ['visa-domain-materials', 0.01],
      ['visa-domain-family', 0],
    ])
    expect(pickVisaDomainStackActiveBlockByRatios(m)).toBe(null)
  })

  it('returns block with max ratio', () => {
    const m = new Map<string, number>([
      ['visa-domain-materials', 0.4],
      ['visa-domain-paths', 0.6],
    ])
    expect(pickVisaDomainStackActiveBlockByRatios(m)).toBe('paths')
  })

  it('breaks ties by VISA_DOMAIN_BLOCK_KEYS order', () => {
    const m = new Map<string, number>([
      ['visa-domain-family', 0.5],
      ['visa-domain-materials', 0.5],
    ])
    expect(pickVisaDomainStackActiveBlockByRatios(m)).toBe('family')
  })
})
