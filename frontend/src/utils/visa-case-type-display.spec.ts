import { afterEach, describe, expect, it } from 'vitest'

import { VisaCaseApplicationCategory } from '@/constants/enums'
import { i18n } from '@/i18n'

import { formatVisaCaseTypeDisplay } from './visa-case-type-display'

afterEach(() => {
  i18n.global.locale.value = 'ja'
})

describe('formatVisaCaseTypeDisplay', () => {
  it('returns empty for null, undefined, or blank', () => {
    expect(formatVisaCaseTypeDisplay(null)).toBe('')
    expect(formatVisaCaseTypeDisplay(undefined)).toBe('')
    expect(formatVisaCaseTypeDisplay('   ')).toBe('')
  })

  it('passes through unknown free text unchanged', () => {
    expect(formatVisaCaseTypeDisplay('技人国')).toBe('技人国')
  })

  it('localizes TECH_HUMANITIES_INTERNATIONAL per active locale', () => {
    const v = VisaCaseApplicationCategory.TECH_HUMANITIES_INTERNATIONAL
    i18n.global.locale.value = 'zh-CN'
    expect(formatVisaCaseTypeDisplay(v)).toBe('技术·人文知识·国际业务')
    i18n.global.locale.value = 'ja'
    expect(formatVisaCaseTypeDisplay(v)).toBe('技術・人文知識・国際業務')
  })
})
