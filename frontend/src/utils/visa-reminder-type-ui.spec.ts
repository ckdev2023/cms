import { describe, expect, it } from 'vitest'

import { VisaReminderType } from '@/constants/enums'

import {
  narrowVisaReminderType,
  VISA_REMINDER_BUCKET_DISPLAY_ORDER,
  VISA_REMINDER_TYPE_EL_TAG_TYPE,
} from './visa-reminder-type-ui'

describe('visa-reminder-type-ui', () => {
  it('covers every VisaReminderType exactly once in display order', () => {
    const all = Object.values(VisaReminderType)
    expect(VISA_REMINDER_BUCKET_DISPLAY_ORDER.length).toBe(all.length)
    const set = new Set(VISA_REMINDER_BUCKET_DISPLAY_ORDER)
    expect(set.size).toBe(all.length)
    for (const v of all) {
      expect(VISA_REMINDER_BUCKET_DISPLAY_ORDER).toContain(v)
    }
  })

  it('assigns el-tag type for each VisaReminderType', () => {
    for (const v of Object.values(VisaReminderType)) {
      expect(['danger', 'warning', 'info']).toContain(VISA_REMINDER_TYPE_EL_TAG_TYPE[v])
    }
  })

  it('narrows known API strings and rejects unknown', () => {
    expect(narrowVisaReminderType('SUPPLEMENT')).toBe(VisaReminderType.SUPPLEMENT)
    expect(narrowVisaReminderType(null)).toBeUndefined()
    expect(narrowVisaReminderType('')).toBeUndefined()
    expect(narrowVisaReminderType('NOT_A_BUCKET')).toBeUndefined()
  })
})
