/**
 * 新建客户成功后「引导创建签证案件」的构建期模式（与 `VITE_CUSTOMER_CREATE_VISA_NUDGE_MODE` 对齐）。
 */
export type CustomerCreateVisaNudgeMode = 'off' | 'tab' | 'wizard'

/**
 * 解析 `import.meta.env.VITE_CUSTOMER_CREATE_VISA_NUDGE_MODE`：关闭、仅跳转签证 Tab 案件子块、或打开建案向导。
 *
 * @returns `off` 表示与普通成功提示一致；`tab` / `wizard` 在具备权限时展示带操作按钮的成功消息
 */
export function resolveCustomerCreateVisaNudgeMode(): CustomerCreateVisaNudgeMode {
  const raw = import.meta.env.VITE_CUSTOMER_CREATE_VISA_NUDGE_MODE?.trim().toLowerCase()
  if (raw === 'off' || raw === 'false' || raw === '0') {
    return 'off'
  }
  if (raw === 'wizard') {
    return 'wizard'
  }
  return 'tab'
}
