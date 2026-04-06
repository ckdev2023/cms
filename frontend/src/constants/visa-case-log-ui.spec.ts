import { describe, expect, it } from 'vitest'

import { VisaCaseLogType } from '@/constants/enums'

import {
  resolveVisaCaseLogTimelineEpType,
  resolveVisaCaseLogTimelineVisualTone,
  visaCaseLogTimelineTagType,
  visaCaseLogTimelineToneForLogType,
} from './visa-case-log-ui'

describe('visaCaseLogTimelineTagType', () => {
  it('maps each VisaCaseLogType to the same emphasis as product semantics', () => {
    expect(visaCaseLogTimelineTagType[VisaCaseLogType.SUBMISSION]).toBe('primary')
    expect(visaCaseLogTimelineTagType[VisaCaseLogType.SUPPLEMENT]).toBe('warning')
    expect(visaCaseLogTimelineTagType[VisaCaseLogType.FOLLOW_UP]).toBe('success')
    expect(visaCaseLogTimelineTagType[VisaCaseLogType.STATUS_CHANGE]).toBe('info')
    expect(visaCaseLogTimelineTagType[VisaCaseLogType.GENERAL]).toBe('info')
  })
})

describe('resolveVisaCaseLogTimelineEpType', () => {
  it('returns info for unknown logType strings as the shared safe default', () => {
    expect(resolveVisaCaseLogTimelineEpType('UNKNOWN_FUTURE_TYPE')).toBe('info')
  })

  it('delegates known types to visaCaseLogTimelineTagType', () => {
    expect(resolveVisaCaseLogTimelineEpType(VisaCaseLogType.SUBMISSION)).toBe('primary')
  })

  it('matches visaCaseLogTimelineToneForLogType for shared Rail / timeline tokens', () => {
    expect(resolveVisaCaseLogTimelineEpType(VisaCaseLogType.SUPPLEMENT)).toBe(
      visaCaseLogTimelineToneForLogType(VisaCaseLogType.SUPPLEMENT),
    )
  })
})

describe('resolveVisaCaseLogTimelineVisualTone', () => {
  it('aliases visaCaseLogTimelineToneForLogType for plan-facing imports', () => {
    expect(resolveVisaCaseLogTimelineVisualTone(VisaCaseLogType.FOLLOW_UP)).toBe('success')
    expect(resolveVisaCaseLogTimelineVisualTone('UNKNOWN')).toBe('info')
    expect(resolveVisaCaseLogTimelineVisualTone(VisaCaseLogType.SUBMISSION)).toBe(
      visaCaseLogTimelineToneForLogType(VisaCaseLogType.SUBMISSION),
    )
  })
})
