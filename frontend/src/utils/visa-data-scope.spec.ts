import { describe, expect, it } from 'vitest'

import { VisaDataScope } from '@/constants/enums'
import { P } from '@/constants/permissions'

import {
  clampVisaDataScope,
  getMaxAllowedVisaDataScope,
  parseVisaDataScopeQuery,
  resolveEffectiveVisaDataScope,
  selectableVisaDataScopes,
  visaDataScopeWideness,
} from './visa-data-scope'

describe('parseVisaDataScopeQuery', () => {
  it('returns undefined for empty input', () => {
    expect(parseVisaDataScopeQuery(undefined)).toBeUndefined()
    expect(parseVisaDataScopeQuery('')).toBeUndefined()
  })

  it('parses valid lowercase scope', () => {
    expect(parseVisaDataScopeQuery('mine')).toBe(VisaDataScope.MINE)
    expect(parseVisaDataScopeQuery('TEAM')).toBe(VisaDataScope.TEAM)
  })

  it('returns undefined for invalid string', () => {
    expect(parseVisaDataScopeQuery('bogus')).toBeUndefined()
  })

  it('unwraps first array element', () => {
    expect(parseVisaDataScopeQuery(['all', 'mine'])).toBe(VisaDataScope.ALL)
  })
})

describe('getMaxAllowedVisaDataScope', () => {
  it('returns ALL when no explicit dataScope permissions', () => {
    const has = (p: string): boolean => p === P.VISA_CASE_LIST
    expect(getMaxAllowedVisaDataScope(has)).toBe(VisaDataScope.ALL)
  })

  it('returns MINE when only dataScopeMine', () => {
    const has = (p: string): boolean => p === P.VISA_CASE_DATA_SCOPE_MINE
    expect(getMaxAllowedVisaDataScope(has)).toBe(VisaDataScope.MINE)
  })

  it('returns TEAM when dataScopeTeam without ALL', () => {
    const perms = new Set<string>([P.VISA_CASE_DATA_SCOPE_TEAM])
    const has = (p: string): boolean => perms.has(p)
    expect(getMaxAllowedVisaDataScope(has)).toBe(VisaDataScope.TEAM)
  })
})

describe('clampVisaDataScope', () => {
  it('clamps wider request to max', () => {
    expect(clampVisaDataScope(VisaDataScope.ALL, VisaDataScope.MINE)).toBe(VisaDataScope.MINE)
    expect(clampVisaDataScope(VisaDataScope.TEAM, VisaDataScope.MINE)).toBe(VisaDataScope.MINE)
  })

  it('treats undefined as ALL then clamps', () => {
    expect(clampVisaDataScope(undefined, VisaDataScope.MINE)).toBe(VisaDataScope.MINE)
  })
})

describe('resolveEffectiveVisaDataScope', () => {
  it('matches parse + clamp for explicit query', () => {
    const hasMineOnly = (p: string): boolean => p === P.VISA_CASE_DATA_SCOPE_MINE
    expect(resolveEffectiveVisaDataScope('mine', hasMineOnly)).toBe(VisaDataScope.MINE)
    expect(resolveEffectiveVisaDataScope('all', hasMineOnly)).toBe(VisaDataScope.MINE)
  })

  it('narrows empty query to max allowed (same as dataScopeForApi default)', () => {
    const hasMineOnly = (p: string): boolean => p === P.VISA_CASE_DATA_SCOPE_MINE
    expect(resolveEffectiveVisaDataScope(undefined, hasMineOnly)).toBe(VisaDataScope.MINE)
    expect(resolveEffectiveVisaDataScope('', hasMineOnly)).toBe(VisaDataScope.MINE)
  })

  it('keeps ALL when user has dataScopeAll permission', () => {
    const hasDataScopeAll = (p: string): boolean => p === P.VISA_CASE_DATA_SCOPE_ALL
    expect(resolveEffectiveVisaDataScope(undefined, hasDataScopeAll)).toBe(VisaDataScope.ALL)
  })
})

describe('selectableVisaDataScopes', () => {
  it('returns one scope for MINE max', () => {
    expect(selectableVisaDataScopes(VisaDataScope.MINE)).toEqual([VisaDataScope.MINE])
  })

  it('returns three for ALL max', () => {
    expect(selectableVisaDataScopes(VisaDataScope.ALL).length).toBe(3)
  })
})

describe('visaDataScopeWideness', () => {
  it('orders mine < team < all', () => {
    expect(visaDataScopeWideness(VisaDataScope.MINE)).toBeLessThan(
      visaDataScopeWideness(VisaDataScope.TEAM),
    )
    expect(visaDataScopeWideness(VisaDataScope.TEAM)).toBeLessThan(
      visaDataScopeWideness(VisaDataScope.ALL),
    )
  })
})
