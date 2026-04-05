import { describe, expect, it, vi } from 'vitest'

import { formatIsoToDatetimeLocalPickerValue, stripVisaCaseLogDeepLinkQuery } from './visa-case-log-deep-link'

describe('formatIsoToDatetimeLocalPickerValue', () => {
  it('returns empty string for blank or invalid input', () => {
    expect(formatIsoToDatetimeLocalPickerValue('')).toBe('')
    expect(formatIsoToDatetimeLocalPickerValue('   ')).toBe('')
    expect(formatIsoToDatetimeLocalPickerValue('not-a-date')).toBe('')
  })

  it('formats valid ISO to YYYY-MM-DDTHH:mm in local time', () => {
    const d = new Date(Date.UTC(2026, 3, 5, 8, 30, 0))
    const iso = d.toISOString()
    const got = formatIsoToDatetimeLocalPickerValue(iso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    expect(got).toBe(`${y}-${m}-${day}T${h}:${min}`)
  })
})

describe('stripVisaCaseLogDeepLinkQuery', () => {
  it('removes log deep-link keys and calls replace when any present', () => {
    const replace = vi.fn()
    const router = { replace } as { replace: typeof replace }
    const route = {
      path: '/customers/x',
      query: {
        tab: 'visa-domain',
        logVisaCaseId: 'c1',
        openVisaCaseLogForm: '1',
        suggestedNextFollowUpAt: '2026-04-01T00:00:00.000Z',
      },
    }
    stripVisaCaseLogDeepLinkQuery(route as never, router as never)
    expect(replace).toHaveBeenCalledWith({
      path: '/customers/x',
      query: { tab: 'visa-domain' },
    })
  })

  it('does not replace when no keys to strip', () => {
    const replace = vi.fn()
    stripVisaCaseLogDeepLinkQuery({ path: '/p', query: { tab: 'basic' } } as never, {
      replace,
    } as never)
    expect(replace).not.toHaveBeenCalled()
  })
})
