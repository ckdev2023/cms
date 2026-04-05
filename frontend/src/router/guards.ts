import 'nprogress/nprogress.css'

import NProgress from 'nprogress'
import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'

import { routePermissionsGranted } from '@/router/route-permission.util'

const ACCESS_TOKEN_KEY = 'access_token'
const FORBIDDEN_PATH = '/403'
const HOME_PATH = '/'
const LOGIN_PATH = '/login'

let userInfoLoaded = false

NProgress.configure({ showSpinner: false })

/**
 * 注册全局导航守卫，统一处理登录跳转、用户资料预加载和权限拦截。
 *
 * @param router - 应用级 Vue Router 实例
 */
export function registerRouterGuards(router: Router): void {
  router.beforeEach(async (to) => {
    NProgress.start()

    const token = readAccessToken()
    resetUserInfoFlagWhenLoggedOut(token)

    if (shouldRedirectToLogin(to, token)) {
      return buildLoginRedirect(to)
    }

    if (shouldRedirectToHome(to, token)) {
      return { path: HOME_PATH }
    }

    const preloadRedirect = await ensureUserInfoLoaded(to, token)
    if (preloadRedirect) {
      return preloadRedirect
    }

    if (await lacksRequiredPermission(to, token)) {
      return { path: FORBIDDEN_PATH }
    }

    return true
  })

  router.afterEach(() => {
    NProgress.done()
  })

  router.onError(() => {
    NProgress.done()
  })
}

/**
 * 读取浏览器本地缓存中的访问令牌，作为路由鉴权的唯一入口。
 *
 * @returns 当前登录态对应的 access token；未登录时返回 null
 */
function readAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/**
 * 在用户已退出登录时重置用户资料加载标记，避免沿用旧会话状态。
 *
 * @param token - 当前导航开始时读取到的 access token
 */
function resetUserInfoFlagWhenLoggedOut(token: string | null): void {
  if (!token) {
    userInfoLoaded = false
  }
}

/**
 * 判断当前导航是否应跳转到登录页，并保留原始访问目标用于登录后回跳。
 *
 * @param to - 即将进入的目标路由
 * @param token - 当前导航开始时读取到的 access token
 * @returns 未登录访问受保护页面时返回 true
 */
function shouldRedirectToLogin(
  to: RouteLocationNormalized,
  token: string | null,
): boolean {
  return !to.meta.public && !token
}

/**
 * 构造登录页跳转目标，并附带用户原本想访问的完整路径。
 *
 * @param to - 被拦截的目标路由
 * @returns 可直接返回给 Vue Router 的登录跳转对象
 */
function buildLoginRedirect(to: RouteLocationNormalized): RouteLocationRaw {
  return { path: LOGIN_PATH, query: { redirect: to.fullPath } }
}

/**
 * 判断已登录用户访问登录页时是否需要回到系统首页。
 *
 * @param to - 即将进入的目标路由
 * @param token - 当前导航开始时读取到的 access token
 * @returns 已登录且访问登录页时返回 true
 */
function shouldRedirectToHome(
  to: RouteLocationNormalized,
  token: string | null,
): boolean {
  return to.path === LOGIN_PATH && !!token
}

/**
 * 在首次访问受保护页面前加载用户资料，确保后续权限校验可使用最新状态。
 *
 * 资料加载失败时会清理本地令牌，并要求用户重新登录。
 *
 * @param to - 即将进入的目标路由
 * @param token - 当前导航开始时读取到的 access token
 * @returns 返回登录跳转对象表示预加载失败；返回 null 表示可继续导航
 */
async function ensureUserInfoLoaded(
  to: RouteLocationNormalized,
  token: string | null,
): Promise<RouteLocationRaw | null> {
  if (!token || userInfoLoaded || to.meta.public) {
    return null
  }

  try {
    const { useUserStore } = await import('@/stores/user')
    const userStore = useUserStore()

    if (!userStore.userInfo) {
      await userStore.fetchUserInfo()
    }

    userInfoLoaded = true
    return null
  } catch {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    userInfoLoaded = false
    return buildLoginRedirect(to)
  }
}

/**
 * 判断当前用户是否因权限不足而应被拦截（跳转 403）。
 *
 * `meta.permissions` 为多项时采用 **任一端满足即通过**（OR），与 `docs/21` §14.1 深链矩阵一致：如仅 `customer:list` 可打开旧在留、仅 `admin_case:list` 可打开行政列表、工作台需提醒或案件列表权之一。
 *
 * @param to - 即将进入的目标路由
 * @param token - 当前导航开始时读取到的 access token
 * @returns 已声明权限且用户完全不满足时返回 true
 */
async function lacksRequiredPermission(
  to: RouteLocationNormalized,
  token: string | null,
): Promise<boolean> {
  if (!token) {
    return false
  }

  const requiredPermissions = getRequiredPermissions(to)
  if (requiredPermissions.length === 0) {
    return false
  }

  const { useUserStore } = await import('@/stores/user')
  const userStore = useUserStore()

  return !routePermissionsGranted(requiredPermissions, (p) => userStore.hasPermission(p))
}

/**
 * 提取路由元信息中的权限列表，并过滤掉非字符串或空字符串配置。
 *
 * @param to - 即将进入的目标路由
 * @returns 供 `routePermissionsGranted` 使用的权限码数组（多项时为 OR）
 */
function getRequiredPermissions(to: RouteLocationNormalized): string[] {
  const { permissions } = to.meta

  if (!Array.isArray(permissions)) {
    return []
  }

  return permissions.filter(
    (permission): permission is string =>
      typeof permission === 'string' && permission.length > 0,
  )
}
