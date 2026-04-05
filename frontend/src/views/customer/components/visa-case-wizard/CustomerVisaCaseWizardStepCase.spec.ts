/**
 * 向导第一步：EXTERNAL 模式下展示「外部主申与本案申请人关系」下拉（Vitest + provide 注入最小向导上下文）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, describe, expect, it } from 'vitest'
import { computed, reactive, ref } from 'vue'

import { FamilyLinkMode } from '@/constants/enums'
import { i18n } from '@/i18n'

import CustomerVisaCaseWizardStepCase from './CustomerVisaCaseWizardStepCase.vue'
import { defaultCaseForm } from './defaultCaseForm'
import {
  VISA_CASE_WIZARD_KEY,
  type VisaCaseWizardContext,
} from './useVisaCaseWizard'
import { createVisaCaseWizardEnumOptionComputeds } from './visaCaseWizardEnumOptionComputeds'

describe('CustomerVisaCaseWizardStepCase (EXTERNAL relation UI)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders external primary relation label when showExternalPrimary', async () => {
    const enumOpts = createVisaCaseWizardEnumOptionComputeds()
    const form = reactive({
      ...defaultCaseForm(),
      isFamilyCase: true,
      familyLinkMode: FamilyLinkMode.EXTERNAL,
      externalPrimaryName: '外部主申',
    })

    const mockWizard = {
      form,
      T: (key: string) => `wiz:${key}`,
      CT: (key: string) => `label:${key}`,
      staffOptions: ref([]),
      caseTypeOptions: ref([]),
      caseStatusOptions: enumOpts.caseStatusOptions,
      materialStatusOptions: enumOpts.materialStatusOptions,
      feeStatusOptions: enumOpts.feeStatusOptions,
      familyLinkModeOptions: enumOpts.familyLinkModeOptions,
      familyRelationOptions: enumOpts.familyRelationOptions,
      showInternalPrimary: computed(() => false),
      showExternalPrimary: computed(() => true),
      primaryCustomerOptions: ref([]),
      primaryCustomerSearchLoading: ref(false),
      searchPrimaryCustomers: (): void => {},
    } as unknown as VisaCaseWizardContext

    const wrapper = mount(CustomerVisaCaseWizardStepCase, {
      attachTo: document.body,
      global: {
        plugins: [i18n, ElementPlus],
        provide: {
          [VISA_CASE_WIZARD_KEY]: mockWizard,
        },
      },
    })

    await flushPromises()
    const body = document.body.textContent ?? ''
    expect(body).toContain('label:externalPrimaryRelationToApplicant')
    expect(body).toContain('label:externalPrimaryRelationToApplicantHint')

    wrapper.unmount()
  })
})
