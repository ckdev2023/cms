import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    titleKey?: string
    public?: boolean
    hidden?: boolean
    affix?: boolean
    breadcrumb?: boolean
    /** 路由准入：用户具备其中任一权限码即可进入（OR）；与 `routePermissionsGranted` 一致 */
    /**
     * 访问该路由所需权限码；多项时为 **任一命中即通过**（OR），与 `registerRouterGuards` / `docs/21` 工作台与旧入口矩阵一致。
     */
    permissions?: string[]
    /**
     * P1-S5f：标记旧入口路由（`docs/21` §14.1 B4/B8）；守卫仍以 `permissions`（OR）为准，本字段仅供文档化与验收对账。
     */
    legacyEntryKind?: 'adminCases'
    /**
     * 与 `CustomerListView` 共用：`/customers/residence-reminders` 进入时默认带上主档在留「N 日内」列表筛选（`GET /customers?residenceExpireWithinDays=`）。
     */
    defaultResidenceExpireWithinDays?: number
  }
}

export {}
