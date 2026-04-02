import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    titleKey?: string
    public?: boolean
    hidden?: boolean
    affix?: boolean
    breadcrumb?: boolean
    permissions?: string[]
  }
}

export {}
