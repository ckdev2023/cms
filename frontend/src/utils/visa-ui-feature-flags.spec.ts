import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { routes } from '@/router/routes'
import {
  VISA_UI_PRIMARY_SIDEBAR_PATHS,
  visaUiParseBooleanEnv,
  visaUiSidebarChildHiddenForFlagState,
  visaUiVisaMergedSidebarChildVisible,
} from '@/utils/visa-ui-feature-flags'

/**
 * 收集 `routes` 解析后的全部绝对 path（含嵌套），用于断言「开关仅藏入口、不卸路由」。
 *
 * @returns 已注册路由 path 集合
 */
function allRouterResolvedPaths(): Set<string> {
  const router = createRouter({ history: createMemoryHistory(), routes })
  return new Set(router.getRoutes().map((r) => r.path))
}

describe('visaUiParseBooleanEnv', () => {
  it('在未设置或空串时按 defaultTrue 回落', () => {
    expect(visaUiParseBooleanEnv(undefined, true)).toBe(true)
    expect(visaUiParseBooleanEnv(undefined, false)).toBe(false)
    expect(visaUiParseBooleanEnv('', true)).toBe(true)
  })

  it('识别常见的 false 取值', () => {
    expect(visaUiParseBooleanEnv('false', true)).toBe(false)
    expect(visaUiParseBooleanEnv('FALSE', true)).toBe(false)
    expect(visaUiParseBooleanEnv('0', true)).toBe(false)
    expect(visaUiParseBooleanEnv('no', true)).toBe(false)
    expect(visaUiParseBooleanEnv('off', true)).toBe(false)
  })

  it('识别常见的 true 取值', () => {
    expect(visaUiParseBooleanEnv('true', false)).toBe(true)
    expect(visaUiParseBooleanEnv('1', false)).toBe(true)
    expect(visaUiParseBooleanEnv('yes', false)).toBe(true)
    expect(visaUiParseBooleanEnv('on', false)).toBe(true)
  })

  it('无法识别的非空串回落到 defaultTrue', () => {
    expect(visaUiParseBooleanEnv('maybe', true)).toBe(true)
    expect(visaUiParseBooleanEnv('maybe', false)).toBe(false)
  })
})

describe('visaUiSidebarChildHiddenForFlagState', () => {
  it('与 visaUiVisaMergedSidebarChildVisible 语义互斥（不读环境变量）', () => {
    const paths = [...VISA_UI_PRIMARY_SIDEBAR_PATHS, '/customers/admin-cases', '/dashboard']
    for (const p of paths) {
      for (const primary of [true, false]) {
        const hidden = visaUiSidebarChildHiddenForFlagState(p, primary)
        const visible = !hidden
        const mergedLike = !(
          (VISA_UI_PRIMARY_SIDEBAR_PATHS as readonly string[]).includes(p) && !primary
        )
        expect(visible).toBe(mergedLike)
      }
    }
  })
})

describe('visaUiVisaMergedSidebarChildVisible', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('默认 true 开关下主路径与行政案件叶子均不因 flag 隐藏', () => {
    for (const p of VISA_UI_PRIMARY_SIDEBAR_PATHS) {
      expect(visaUiVisaMergedSidebarChildVisible(p)).toBe(true)
    }
    expect(visaUiVisaMergedSidebarChildVisible('/customers/admin-cases')).toBe(true)
  })

  it('关闭主路径开关时仅隐藏 VISA_UI_PRIMARY_SIDEBAR_PATHS，行政案件仍可见', () => {
    vi.stubEnv('VITE_VISA_UI_VISA_PRIMARY_VISIBLE', 'false')
    for (const p of VISA_UI_PRIMARY_SIDEBAR_PATHS) {
      expect(visaUiVisaMergedSidebarChildVisible(p)).toBe(false)
    }
    expect(visaUiVisaMergedSidebarChildVisible('/customers/admin-cases')).toBe(true)
  })
})

describe('visa-ui-feature-flags 与 MainLayout 菜单 path 契约', () => {
  it('主路径侧栏 path 无重复项', () => {
    const primary = new Set(VISA_UI_PRIMARY_SIDEBAR_PATHS)
    expect(primary.size).toBe(VISA_UI_PRIMARY_SIDEBAR_PATHS.length)
  })
})

describe('visa-ui-feature-flags 与 routes 注册（docs/26 §4 不静默下线）', () => {
  it('受构建期开关影响的侧栏 path 在 MainLayout 子路由中均有注册', () => {
    const registered = allRouterResolvedPaths()
    for (const p of VISA_UI_PRIMARY_SIDEBAR_PATHS) {
      expect(registered.has(p), `expected route for ${p}`).toBe(true)
    }
    expect(registered.has('/customers/admin-cases')).toBe(true)
  })
})
