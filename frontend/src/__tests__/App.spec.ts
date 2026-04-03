import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import App from '../App.vue'
import { i18n } from '../i18n'

vi.mock('vue-router', () => ({
  useRoute: () => ({
    meta: {},
  }),
}))

describe('App', () => {
  it('renders without crashing', () => {
    const pinia = createPinia()

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, i18n, ElementPlus],
        stubs: ['router-view'],
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
