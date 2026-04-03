import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import App from '../App.vue'

describe('App', () => {
  it('renders without crashing', () => {
    const wrapper = mount(App, {
      global: {
        stubs: ['router-view'],
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
