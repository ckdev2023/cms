import { describe, expect, it } from 'vitest'

import {
  isVisaCaseTypeChanging,
  normalizeVisaCaseTypeKey,
} from '@/utils/visa-case-type-change-materials'

describe('normalizeVisaCaseTypeKey', () => {
  it('trims whitespace', () => {
    expect(normalizeVisaCaseTypeKey('  A  ')).toBe('A')
  })

  it('treats nullish as empty', () => {
    expect(normalizeVisaCaseTypeKey(null)).toBe('')
    expect(normalizeVisaCaseTypeKey(undefined)).toBe('')
  })
})

describe('isVisaCaseTypeChanging', () => {
  it('returns false when only whitespace differs', () => {
    expect(isVisaCaseTypeChanging('X', '  X  ')).toBe(false)
  })

  it('returns true when normalized values differ', () => {
    expect(isVisaCaseTypeChanging('A', 'B')).toBe(true)
  })

  it('returns false when both empty after trim', () => {
    expect(isVisaCaseTypeChanging('', null)).toBe(false)
  })
})
