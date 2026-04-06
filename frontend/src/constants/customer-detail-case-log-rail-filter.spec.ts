import { describe, expect, it } from 'vitest'

import { VisaCaseLogType } from '@/constants/enums'

import {
  caseLogRailPillLogTypes,
  isVisaCaseLogInRailPill,
} from './customer-detail-case-log-rail-filter'

describe('isVisaCaseLogInRailPill', () => {
  it('all pill accepts every enum value', () => {
    for (const logType of Object.values(VisaCaseLogType)) {
      expect(isVisaCaseLogInRailPill(logType, 'all')).toBe(true)
    }
  })

  it('materials pill matches submission and supplement only', () => {
    expect(isVisaCaseLogInRailPill(VisaCaseLogType.SUBMISSION, 'materials')).toBe(true)
    expect(isVisaCaseLogInRailPill(VisaCaseLogType.SUPPLEMENT, 'materials')).toBe(true)
    expect(isVisaCaseLogInRailPill(VisaCaseLogType.GENERAL, 'materials')).toBe(false)
  })

  it('communication pill matches follow-up and general', () => {
    expect(isVisaCaseLogInRailPill(VisaCaseLogType.FOLLOW_UP, 'communication')).toBe(true)
    expect(isVisaCaseLogInRailPill(VisaCaseLogType.GENERAL, 'communication')).toBe(true)
    expect(isVisaCaseLogInRailPill(VisaCaseLogType.STATUS_CHANGE, 'communication')).toBe(
      false,
    )
  })

  it('system pill matches status change', () => {
    expect(isVisaCaseLogInRailPill(VisaCaseLogType.STATUS_CHANGE, 'system')).toBe(true)
    expect(isVisaCaseLogInRailPill(VisaCaseLogType.GENERAL, 'system')).toBe(false)
  })
})

describe('caseLogRailPillLogTypes', () => {
  it('covers every VisaCaseLogType exactly once across non-all pills', () => {
    const buckets = new Map<VisaCaseLogType, string[]>()
    for (const logType of Object.values(VisaCaseLogType)) {
      buckets.set(logType, [])
    }
    for (const pill of ['materials', 'communication', 'system'] as const) {
      const types = caseLogRailPillLogTypes[pill]
      expect(types).toBeTruthy()
      for (const lt of types!) {
        buckets.get(lt)!.push(pill)
      }
    }
    for (const [lt, pills] of buckets) {
      expect(pills, lt).toHaveLength(1)
    }
  })
})
