import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { mergeLegacyPersonResidenceStatusOption } from './person-residence-status-options'

describe('mergeLegacyPersonResidenceStatusOption', () => {
  it('在选项列表中追加经 trim 后的历史自由文本且避免重复', () => {
    const optionsRef = ref([{ value: '永住者', label: '永住者' }])
    mergeLegacyPersonResidenceStatusOption(optionsRef, '  旧表記カスタム  ')
    expect(optionsRef.value).toEqual([
      { value: '永住者', label: '永住者' },
      { value: '旧表記カスタム', label: '旧表記カスタム' },
    ])
    mergeLegacyPersonResidenceStatusOption(optionsRef, '旧表記カスタム')
    expect(optionsRef.value).toHaveLength(2)
  })

  it('空白字符串不修改选项列表', () => {
    const optionsRef = ref([{ value: 'a', label: 'a' }])
    mergeLegacyPersonResidenceStatusOption(optionsRef, '   ')
    expect(optionsRef.value).toEqual([{ value: 'a', label: 'a' }])
  })
})
