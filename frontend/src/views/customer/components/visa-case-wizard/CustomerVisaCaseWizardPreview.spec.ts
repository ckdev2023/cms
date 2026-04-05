/**
 * 向导侧栏档案预览：校验主申模式摘要与案件类型展示（Vitest + provide 最小上下文）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, describe, expect, it } from 'vitest'
import { computed, reactive, ref } from 'vue'

import { FamilyLinkMode } from '@/constants/enums'
import { i18n } from '@/i18n'

import CustomerVisaCaseWizardPreview from './CustomerVisaCaseWizardPreview.vue'
import { defaultCaseForm } from './defaultCaseForm'
import {
  VISA_CASE_WIZARD_KEY,
  type VisaCaseWizardContext,
} from './useVisaCaseWizard'

const T = (key: string): string => `wiz:${key}`

describe('CustomerVisaCaseWizardPreview', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows non-family primary mode and case type label from dictionary', async () => {
    const form = reactive({
      ...defaultCaseForm(),
      caseType: 'WORK',
      isFamilyCase: false,
    })

    const mockWizard = {
      form,
      T,
      contextApplicantDisplay: computed(() => '山田太郎'),
      caseTypeOptions: ref([{ label: '就劳', value: 'WORK' }]),
      pendingMembers: ref([]),
      selectedPrimaryName: computed(() => ''),
    } as unknown as VisaCaseWizardContext

    const wrapper = mount(CustomerVisaCaseWizardPreview, {
      attachTo: document.body,
      global: {
        plugins: [i18n, ElementPlus],
        provide: { [VISA_CASE_WIZARD_KEY]: mockWizard },
      },
    })

    await flushPromises()
    const text = document.body.textContent ?? ''
    expect(text).toContain('山田太郎')
    expect(text).toContain('就劳')
    expect(text).toContain('wiz:previewModeNonFamily')

    wrapper.unmount()
  })

  it('shows internal primary line when family case uses INTERNAL mode', async () => {
    const form = reactive({
      ...defaultCaseForm(),
      isFamilyCase: true,
      familyLinkMode: FamilyLinkMode.INTERNAL,
      internalPrimaryCustomerId: 'p1',
    })

    const mockWizard = {
      form,
      T,
      contextApplicantDisplay: computed(() => '次郎'),
      caseTypeOptions: ref([]),
      pendingMembers: ref([{ tempId: 1, customerId: 'x', memberRole: 'SPOUSE', displayNameSnapshot: 'A' }]),
      selectedPrimaryName: computed(() => '主申一郎'),
    } as unknown as VisaCaseWizardContext

    const wrapper = mount(CustomerVisaCaseWizardPreview, {
      attachTo: document.body,
      global: {
        plugins: [i18n, ElementPlus],
        provide: { [VISA_CASE_WIZARD_KEY]: mockWizard },
      },
    })

    await flushPromises()
    const text = document.body.textContent ?? ''
    expect(text).toContain('主申一郎')
    expect(text).toContain('wiz:previewLinkInternal')
    expect(text).toMatch(/1/)

    wrapper.unmount()
  })
})
