import type { Component } from 'vue'

/** 侧栏叶子项：路由 path、标题键与可选权限、弱化副标题与 tooltip */
export interface MenuChild {
  path: string
  titleKey: string
  permissions?: string[]
  /** 侧栏项第二行弱化文案（P1-S5d：旧在留入口引导） */
  menuSubtitleKey?: string
  /** 悬停说明：口径、主路径与接口兼容 */
  menuTooltipKey?: string
}

export interface MenuItem {
  path: string
  titleKey: string
  icon: Component
  permissions?: string[]
  children?: MenuChild[]
}

export interface LocalizedMenuChild extends MenuChild {
  title: string
  menuSubtitle?: string
  menuTooltip?: string
}

/**
 * 本地化后的菜单项：`children` 与 `MenuItem` 中对应字段结构不同，故用 Omit 再收窄。
 */
export interface LocalizedMenuItem extends Omit<MenuItem, 'children'> {
  title: string
  children?: LocalizedMenuChild[]
}
