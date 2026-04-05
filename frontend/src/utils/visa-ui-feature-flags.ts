/**
 * P2-S3f：签证域主路径的构建期灰度开关（Vite `import.meta.env`）。
 * 默认均为「可见」，设为 `false` / `0` / `no` / `off` 时隐藏对应侧栏/引导入口；**不**从路由表卸载（`docs/26` §4 不静默下线），书签与深链仍可直接打开页面。
 *
 * **与客户中心整合页约定：** 侧栏仅保留 `/customers` 单入口；签证主路径 Tab 的完整 path 为 `/customers/workbench/visa` 等。`VISA_UI_PRIMARY_SIDEBAR_PATHS` 须与 `customer-center-tabs.config` 中受 `VITE_VISA_UI_VISA_PRIMARY_VISIBLE` 约束的项一致；`/customers` 根列表与 `/customers/admin-cases` 等不受该开关隐藏。
 */

/**
 * 解析 Vite 注入的布尔型环境变量，非法或空串时回落到默认值。
 *
 * @param raw - `import.meta.env.VITE_*` 原始字符串
 * @param defaultTrue - 未设置或无法识别时是否视为 true
 * @returns 是否视为开启（可见入口）
 */
export function visaUiParseBooleanEnv(raw: string | undefined, defaultTrue: boolean): boolean {
  if (raw === undefined || raw === '') {return defaultTrue}
  const s = String(raw).toLowerCase().trim()
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') {return false}
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') {return true}
  return defaultTrue
}

/**
 * 是否展示签证域主路径入口（工作台、签证提醒、案件登记册、导入、行政案件补录等侧栏项及链向这些页的引导）。
 *
 * @returns 为 false 时隐藏上述入口；对应路由仍可手动访问
 */
export function visaUiVisaPrimaryEntriesVisible(): boolean {
  return visaUiParseBooleanEnv(import.meta.env.VITE_VISA_UI_VISA_PRIMARY_VISIBLE, true)
}

/**
 * 与 `visaUiVisaPrimaryEntriesVisible` 联动的侧栏 path 列表（与客户中心 hub `children` 中签证主路径项顺序与集合一致；Phase D3）。
 */
export const VISA_UI_PRIMARY_SIDEBAR_PATHS: readonly string[] = [
  '/customers/workbench/visa',
  '/customers/visa-reminders',
  '/customers/visa-cases',
  '/customers/visa-case-import',
  '/customers/admin-case-visa-supplement',
]

const VISA_UI_PRIMARY_SIDEBAR_PATH_SET = new Set(VISA_UI_PRIMARY_SIDEBAR_PATHS)

/**
 * 在给定签证主路径可见性下，判断签证合并组侧栏子 path 是否应因构建期开关隐藏（与 `visaUiVisaMergedSidebarChildVisible` / MainLayout 一致，便于单测覆盖组合）。
 *
 * @param childPath - 子菜单路由 path
 * @param visaPrimaryVisible - 是否展示签证主路径侧栏项
 * @returns 为 true 时该项不应出现在侧栏（路由仍可深链直达）
 */
export function visaUiSidebarChildHiddenForFlagState(
  childPath: string,
  visaPrimaryVisible: boolean,
): boolean {
  return VISA_UI_PRIMARY_SIDEBAR_PATH_SET.has(childPath) && !visaPrimaryVisible
}

/**
 * 判断签证合并侧栏某一叶子 path 是否应在当前构建期开关下展示（与 `MainLayout` `allMenuItems` 过滤一致）。
 * 关闭开关时仅影响菜单可见性；对应路由仍在 `routes.ts` 注册，书签与深链可直达（docs/26 §4）。
 *
 * @param path - 与客户中心 Tab 一致的全路径（如 `/customers/visa-cases`）
 * @returns 为 true 时保留该项；为 false 时从侧栏过滤掉
 */
export function visaUiVisaMergedSidebarChildVisible(path: string): boolean {
  return !visaUiSidebarChildHiddenForFlagState(path, visaUiVisaPrimaryEntriesVisible())
}
