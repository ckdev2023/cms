import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { useTagsViewStore } from '@/stores/tagsView'

function createRoute(
  overrides: Partial<RouteLocationNormalized> = {},
): RouteLocationNormalized {
  return {
    path: '/dashboard',
    name: 'DashboardView',
    meta: {
      title: 'Dashboard',
      titleKey: 'menu.dashboard',
      affix: false,
      noCache: false,
    },
    query: {},
    fullPath: '/dashboard',
    hash: '',
    href: '/dashboard',
    matched: [],
    params: {},
    redirectedFrom: undefined,
    ...overrides,
  } as RouteLocationNormalized
}

describe('useTagsViewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should add a route to visited and cached views', () => {
    const store = useTagsViewStore()

    store.addView(createRoute())

    expect(store.visitedViews).toHaveLength(1)
    expect(store.visitedViews[0]).toMatchObject({
      path: '/dashboard',
      name: 'DashboardView',
      title: 'Dashboard',
      titleKey: 'menu.dashboard',
      affix: false,
    })
    expect(Array.from(store.cachedViews)).toEqual(['DashboardView'])
  })

  it('should not duplicate visited views for the same path', () => {
    const store = useTagsViewStore()

    store.addView(createRoute())
    store.addView(createRoute({ query: { tab: 'summary' } }))

    expect(store.visitedViews).toHaveLength(1)
    expect(Array.from(store.cachedViews)).toEqual(['DashboardView'])
  })

  it('should skip cache registration when route meta declares noCache', () => {
    const store = useTagsViewStore()

    store.addView(createRoute({ meta: { title: 'Logs', noCache: true } }))

    expect(store.visitedViews).toHaveLength(1)
    expect(store.cachedViews.size).toBe(0)
  })

  it('should keep affix views when removing a single path', () => {
    const store = useTagsViewStore()
    store.addView(createRoute({ path: '/home', name: 'HomeView', meta: { title: 'Home', affix: true } }))
    store.addView(createRoute({ path: '/logs', name: 'LogsView', meta: { title: 'Logs' } }))

    store.removeView('/home')
    expect(store.visitedViews).toHaveLength(2)

    store.removeView('/logs')
    expect(store.visitedViews.map((view) => view.path)).toEqual(['/home'])
    expect(Array.from(store.cachedViews)).toEqual(['HomeView'])
  })

  it('should keep only affix and current views when removing other views', () => {
    const store = useTagsViewStore()
    store.addView(createRoute({ path: '/home', name: 'HomeView', meta: { title: 'Home', affix: true } }))
    store.addView(createRoute({ path: '/logs', name: 'LogsView', meta: { title: 'Logs' } }))
    store.addView(createRoute({ path: '/settings', name: 'SettingsView', meta: { title: 'Settings' } }))

    store.removeOtherViews('/settings')

    expect(store.visitedViews.map((view) => view.path)).toEqual(['/home', '/settings'])
    expect(Array.from(store.cachedViews)).toEqual(['HomeView', 'SettingsView'])
  })

  it('should keep only affix views when removing all views', () => {
    const store = useTagsViewStore()
    store.addView(createRoute({ path: '/home', name: 'HomeView', meta: { title: 'Home', affix: true } }))
    store.addView(createRoute({ path: '/logs', name: 'LogsView', meta: { title: 'Logs' } }))

    store.removeAllViews()

    expect(store.visitedViews.map((view) => view.path)).toEqual(['/home'])
    expect(Array.from(store.cachedViews)).toEqual(['HomeView'])
  })
})
