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

/**
 * 管理顶部标签页的访问记录与 KeepAlive 缓存键集合。
 *
 * 该 store 负责根据路由元信息维护可关闭标签、固定标签以及缓存列表。
 *
 * @returns 包含标签页增删与缓存重建 action 的 TagsView store 实例
 */
export const useTagsViewStore = defineStore('tagsView', () => {
  const visitedViews = ref<TagView[]>([])
  const cachedViews = ref<Set<string>>(new Set())

  /**
   * 按当前路由同时注册可见标签页与 KeepAlive 缓存键。
   *
   * @param route - 当前进入的规范化路由对象，需包含 path、name 与 meta 信息
   */
  function addView(route: RouteLocationNormalized): void {
    addVisitedView(route)
    addCachedView(route)
  }

  /**
   * 把当前路由加入已访问标签列表，避免同一路径重复入栈。
   *
   * @param route - 当前进入的规范化路由对象
   */
  function addVisitedView(route: RouteLocationNormalized): void {
    if (visitedViews.value.some((v) => v.path === route.path)) {return}
    visitedViews.value.push({
      path: route.path,
      name: (route.name as string) || '',
      title: (route.meta?.title as string) || '',
      titleKey: route.meta?.titleKey as string | undefined,
      affix: !!route.meta?.affix,
      query: route.query as Record<string, string>,
    })
  }

  /**
   * 根据路由元信息决定是否把当前页面加入 KeepAlive 缓存集合。
   *
   * @param route - 当前进入的规范化路由对象
   */
  function addCachedView(route: RouteLocationNormalized): void {
    if (route.meta?.noCache || !route.name) {return}
    cachedViews.value.add(route.name as string)
  }

  /**
   * 按路径移除指定标签页，并同步删除对应缓存键。
   *
   * 固定标签页（affix）不会被关闭。
   *
   * @param path - 目标标签页对应的路由路径
   */
  function removeView(path: string): void {
    const idx = visitedViews.value.findIndex((v) => v.path === path)
    if (idx === -1) {return}
    const view = visitedViews.value[idx]
    if (view.affix) {return}
    visitedViews.value.splice(idx, 1)
    if (view.name) {cachedViews.value.delete(view.name)}
  }

  /**
   * 仅保留固定标签页与当前目标标签页，并重建缓存集合。
   *
   * @param path - 需要继续保留的当前标签页路径
   */
  function removeOtherViews(path: string): void {
    visitedViews.value = visitedViews.value.filter(
      (v) => v.affix || v.path === path,
    )
    rebuildCache()
  }

  /**
   * 清空所有非固定标签页，并据此重建缓存集合。
   */
  function removeAllViews(): void {
    visitedViews.value = visitedViews.value.filter((v) => v.affix)
    rebuildCache()
  }

  /**
   * 根据当前已访问标签列表重新生成 KeepAlive 缓存键集合。
   */
  function rebuildCache(): void {
    cachedViews.value.clear()
    visitedViews.value.forEach((v) => {
      if (v.name) {cachedViews.value.add(v.name)}
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
