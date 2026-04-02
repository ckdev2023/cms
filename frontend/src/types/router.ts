/**
 * 扩展路由元信息声明，统一约束菜单与权限字段。
 */
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    titleKey?: string
    icon?: string
    public?: boolean
    hidden?: boolean
    noCache?: boolean
    affix?: boolean
    breadcrumb?: boolean
    activeMenu?: string
    /** Permission codes required to access this route (user needs at least one). */
    permissions?: string[]
  }
}
