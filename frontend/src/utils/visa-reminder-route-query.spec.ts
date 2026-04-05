import { describe, expect, it } from 'vitest'
import type { LocationQuery } from 'vue-router'

import { VisaReminderType } from '@/constants/enums'

import {
  assignedToFromQuery,
  pickVisaReminderListQueryPreserve,
  preserveDataScope,
  reminderTypeFromQuery,
} from './visa-reminder-route-query'

describe('reminderTypeFromQuery', () => {
  it('returns empty string for non-string raw values', () => {
    expect(reminderTypeFromQuery(undefined)).toBe('')
    expect(reminderTypeFromQuery(null)).toBe('')
    expect(reminderTypeFromQuery(1)).toBe('')
    expect(reminderTypeFromQuery({})).toBe('')
    expect(reminderTypeFromQuery(['SUPPLEMENT'])).toBe('')
    expect(reminderTypeFromQuery(['SUPPLEMENT', 'TODAY_FOLLOW_UP'])).toBe('')
  })

  it('returns empty string for unknown string tokens', () => {
    expect(reminderTypeFromQuery('')).toBe('')
    expect(reminderTypeFromQuery('not-a-bucket')).toBe('')
    expect(reminderTypeFromQuery('supplement')).toBe('')
    expect(reminderTypeFromQuery('TODAY')).toBe('')
  })

  it('returns enum when raw matches a VisaReminderType value', () => {
    expect(reminderTypeFromQuery(VisaReminderType.SUPPLEMENT)).toBe(VisaReminderType.SUPPLEMENT)
    expect(reminderTypeFromQuery(VisaReminderType.TODAY_FOLLOW_UP)).toBe(
      VisaReminderType.TODAY_FOLLOW_UP,
    )
    expect(reminderTypeFromQuery(VisaReminderType.EXPIRING_7_DAYS)).toBe(
      VisaReminderType.EXPIRING_7_DAYS,
    )
    expect(reminderTypeFromQuery(VisaReminderType.EXPIRING_2_MONTHS)).toBe(
      VisaReminderType.EXPIRING_2_MONTHS,
    )
  })
})

describe('preserveDataScope', () => {
  it('returns empty object when dataScope is missing or not a non-empty string', () => {
    expect(preserveDataScope({})).toEqual({})
    expect(preserveDataScope({ dataScope: '' })).toEqual({})
    expect(preserveDataScope({ dataScope: ['all'] })).toEqual({})
    expect(preserveDataScope({ dataScope: ['mine', 'team'] })).toEqual({})
    expect(preserveDataScope({ dataScope: undefined } as unknown as LocationQuery)).toEqual({})
    expect(preserveDataScope({ dataScope: null } as unknown as LocationQuery)).toEqual({})
    expect(preserveDataScope({ dataScope: 1 } as unknown as LocationQuery)).toEqual({})
  })

  it('returns dataScope entry for a non-empty string value', () => {
    expect(preserveDataScope({ dataScope: 'all' })).toEqual({ dataScope: 'all' })
    expect(preserveDataScope({ dataScope: 'mine' })).toEqual({ dataScope: 'mine' })
    expect(
      preserveDataScope({
        dataScope: 'team',
        reminderType: 'SUPPLEMENT',
        tab: 'visa-domain',
      } as LocationQuery),
    ).toEqual({ dataScope: 'team' })
  })
})

/** 与 `VISA_CASE_IMPORT_LOCAL_UUID_RE` 一致的有效用户 UUID（测试用） */
const SAMPLE_USER_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('assignedToFromQuery', () => {
  it('returns undefined for non-string or empty raw values', () => {
    expect(assignedToFromQuery(undefined)).toBeUndefined()
    expect(assignedToFromQuery(null)).toBeUndefined()
    expect(assignedToFromQuery('')).toBeUndefined()
    expect(assignedToFromQuery(1)).toBeUndefined()
    expect(assignedToFromQuery(['x'])).toBeUndefined()
  })

  it('returns undefined for malformed UUID strings', () => {
    expect(assignedToFromQuery('not-uuid')).toBeUndefined()
    expect(assignedToFromQuery('550e8400-e29b-41d4-a716')).toBeUndefined()
  })

  it('returns the string when raw is a valid UUID', () => {
    expect(assignedToFromQuery(SAMPLE_USER_UUID)).toBe(SAMPLE_USER_UUID)
  })
})

describe('pickVisaReminderListQueryPreserve', () => {
  it('merges dataScope and valid assignedTo from query', () => {
    expect(
      pickVisaReminderListQueryPreserve({
        dataScope: 'mine',
        assignedTo: SAMPLE_USER_UUID,
      } as LocationQuery),
    ).toEqual({ dataScope: 'mine', assignedTo: SAMPLE_USER_UUID })
  })

  it('omits assignedTo when token is invalid', () => {
    expect(
      pickVisaReminderListQueryPreserve({
        dataScope: 'all',
        assignedTo: 'bad',
      } as LocationQuery),
    ).toEqual({ dataScope: 'all' })
  })

  it('does not include reminderType', () => {
    expect(
      pickVisaReminderListQueryPreserve({
        reminderType: 'SUPPLEMENT',
        assignedTo: SAMPLE_USER_UUID,
      } as LocationQuery),
    ).toEqual({ assignedTo: SAMPLE_USER_UUID })
  })
})
