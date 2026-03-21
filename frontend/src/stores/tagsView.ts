import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'

export interface TagView {
  path: string
  name: string
  title: string
  titleKey?: string
  affix?: boolean
  query?: Record<string, string>
}

export const useTagsViewStore = defineStore('tagsView', () => {
  const visitedViews = ref<TagView[]>([])
  const cachedViews = ref<Set<string>>(new Set())

  function addView(route: RouteLocationNormalized) {
    addVisitedView(route)
    addCachedView(route)
  }

  function addVisitedView(route: RouteLocationNormalized) {
    if (visitedViews.value.some((v) => v.path === route.path)) return
    visitedViews.value.push({
      path: route.path,
      name: (route.name as string) || '',
      title: (route.meta?.title as string) || '',
      titleKey: route.meta?.titleKey as string | undefined,
      affix: !!route.meta?.affix,
      query: route.query as Record<string, string>,
    })
  }

  function addCachedView(route: RouteLocationNormalized) {
    if (route.meta?.noCache || !route.name) return
    cachedViews.value.add(route.name as string)
  }

  function removeView(path: string) {
    const idx = visitedViews.value.findIndex((v) => v.path === path)
    if (idx === -1) return
    const view = visitedViews.value[idx]
    if (view.affix) return
    visitedViews.value.splice(idx, 1)
    if (view.name) cachedViews.value.delete(view.name)
  }

  function removeOtherViews(path: string) {
    visitedViews.value = visitedViews.value.filter(
      (v) => v.affix || v.path === path,
    )
    rebuildCache()
  }

  function removeAllViews() {
    visitedViews.value = visitedViews.value.filter((v) => v.affix)
    rebuildCache()
  }

  function rebuildCache() {
    cachedViews.value.clear()
    visitedViews.value.forEach((v) => {
      if (v.name) cachedViews.value.add(v.name)
    })
  }

  return {
    visitedViews,
    cachedViews,
    addView,
    removeView,
    removeOtherViews,
    removeAllViews,
  }
})
