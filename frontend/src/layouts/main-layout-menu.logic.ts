import type { LocalizedMenuItem, MenuChild, MenuItem } from '@/layouts/main-layout-menu.types'

/** i18n 函数：读取布局与路由文案键 */
export type MainLayoutMenuTranslate = (key: string) => string

function isMenuItemNonNull(item: MenuItem | null): item is MenuItem {
  return item !== null
}

/**
 * 按权限过滤 `allMenuItems`，得到当前用户可见的侧栏菜单树（财务/系统等分组子项仍按权限裁剪）。
 *
 * @param allItems - 静态菜单定义
 * @param hasMenuPermission - 判断当前用户是否具备给定权限码之一
 * @returns 过滤后的菜单项数组；分组在无可见子项时被移除
 */
export function filterVisibleMainLayoutMenuItems(
  allItems: readonly MenuItem[],
  hasMenuPermission: (perms?: string[]) => boolean,
): MenuItem[] {
  return allItems
    .filter((item) => hasMenuPermission(item.permissions))
    .map((item) => {
      if (!item.children) {
        return item
      }
      const children = item.children.filter((c) => hasMenuPermission(c.permissions))
      return children.length ? { ...item, children } : null
    })
    .filter(isMenuItemNonNull)
}

/**
 * 为侧栏渲染将菜单项标题与副标题键解析为当前语言文案。
 *
 * @param items - 已按权限过滤的菜单项
 * @param t - vue-i18n 全局 `t`
 * @returns 带 `title` / `menuSubtitle` / `menuTooltip` 的菜单结构
 */
export function localizeMainLayoutMenuItems(
  items: MenuItem[],
  t: MainLayoutMenuTranslate,
): LocalizedMenuItem[] {
  return items.map((item) => {
    const title = t(item.titleKey)
    const { path, titleKey, icon, permissions, children } = item
    return {
      path,
      titleKey,
      icon,
      permissions,
      title,
      children: children?.map((child: MenuChild) => ({
        ...child,
        title: t(child.titleKey),
        menuSubtitle: child.menuSubtitleKey ? t(child.menuSubtitleKey) : undefined,
        menuTooltip: child.menuTooltipKey ? t(child.menuTooltipKey) : undefined,
      })),
    }
  })
}

/**
 * 计算 `el-menu` `default-openeds`；客户中心已扁平为单入口，恒为空数组。
 *
 * @param _items - 兼容旧调用签名，忽略
 * @returns 始终为空
 */
export function visaMenuDefaultOpenedsFromItems(_items: MenuItem[]): string[] {
  return []
}
