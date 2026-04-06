import { describe, expect, it, vi } from 'vitest'

import {
  isVisaDomainBlockQueryValue,
  parseVisaDomainBlockFromLocationHash,
  stripVisaDomainDeepLinkFromLocation,
  visaDomainBlockFromSectionIdSuffix,
  visaDomainSectionElementId,
} from './customer-detail-visa-domain-deeplink'

describe('isVisaDomainBlockQueryValue', () => {
  it('returns true for registered block keys', () => {
    expect(isVisaDomainBlockQueryValue('basicSnapshot')).toBe(true)
    expect(isVisaDomainBlockQueryValue('logs')).toBe(true)
    expect(isVisaDomainBlockQueryValue('cases')).toBe(true)
  })

  it('returns false for unknown keys', () => {
    expect(isVisaDomainBlockQueryValue('')).toBe(false)
    expect(isVisaDomainBlockQueryValue('basic')).toBe(false)
    expect(isVisaDomainBlockQueryValue('basic-snapshot')).toBe(false)
    expect(isVisaDomainBlockQueryValue('visa-domain-logs')).toBe(false)
  })
})

describe('visaDomainSectionElementId', () => {
  it('prefixes block key with visa-domain-', () => {
    expect(visaDomainSectionElementId('materials')).toBe('visa-domain-materials')
  })

  it('maps basicSnapshot to visa-domain-basic-snapshot DOM id', () => {
    expect(visaDomainSectionElementId('basicSnapshot')).toBe('visa-domain-basic-snapshot')
  })
})

describe('visaDomainBlockFromSectionIdSuffix', () => {
  it('maps basic-snapshot to basicSnapshot', () => {
    expect(visaDomainBlockFromSectionIdSuffix('basic-snapshot')).toBe('basicSnapshot')
  })

  it('passes through registered single-segment keys', () => {
    expect(visaDomainBlockFromSectionIdSuffix('family')).toBe('family')
  })

  it('returns null for unknown suffix', () => {
    expect(visaDomainBlockFromSectionIdSuffix('unknown')).toBe(null)
  })
})

describe('parseVisaDomainBlockFromLocationHash', () => {
  it('parses #visa-domain-* hashes', () => {
    expect(parseVisaDomainBlockFromLocationHash('#visa-domain-family')).toBe('family')
    expect(parseVisaDomainBlockFromLocationHash('#visa-domain-basic-snapshot')).toBe('basicSnapshot')
  })

  it('returns null for unrelated hashes', () => {
    expect(parseVisaDomainBlockFromLocationHash('')).toBe(null)
    expect(parseVisaDomainBlockFromLocationHash('#')).toBe(null)
    expect(parseVisaDomainBlockFromLocationHash('#other')).toBe(null)
  })
})

describe('stripVisaDomainDeepLinkFromLocation', () => {
  it('removes visaDomainBlock query and clears matching hash', () => {
    const replace = vi.fn()
    const router = { replace } as { replace: typeof replace }
    const route = {
      path: '/customers/x',
      query: { tab: 'visa-domain', visaDomainBlock: 'logs', ccFrom: '/customers' },
      hash: '#visa-domain-logs',
    }
    stripVisaDomainDeepLinkFromLocation(route as never, router as never)
    expect(replace).toHaveBeenCalledWith({
      path: '/customers/x',
      query: { tab: 'visa-domain', ccFrom: '/customers' },
      hash: '',
    })
  })

  it('does not replace when nothing to strip', () => {
    const replace = vi.fn()
    stripVisaDomainDeepLinkFromLocation(
      { path: '/p', query: { tab: 'basic' }, hash: '' } as never,
      { replace } as never,
    )
    expect(replace).not.toHaveBeenCalled()
  })

  it('preserves unrelated hash when only stripping query', () => {
    const replace = vi.fn()
    const router = { replace } as { replace: typeof replace }
    stripVisaDomainDeepLinkFromLocation(
      {
        path: '/customers/x',
        query: { visaDomainBlock: 'paths' },
        hash: '#footnote',
      } as never,
      router as never,
    )
    expect(replace).toHaveBeenCalledWith({
      path: '/customers/x',
      query: {},
      hash: '#footnote',
    })
  })
})
