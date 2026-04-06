import type { CollapseModelValue } from 'element-plus'
import { type Ref, ref, watch } from 'vue'

import type { VisaDomainBlockQueryValue } from '@/utils/customer-detail-visa-domain-deeplink'

/** 主栏「案件日志」`el-collapse-item` 的 `name`，与模板 `:name` 绑定一致 */
export const CUSTOMER_VISA_DOMAIN_LOGS_PANEL_COLLAPSE_NAME = 'logs-panel'

/**
 * 管理签证域主栏案件日志折叠区：默认收起以降低纵向占位，深链 / 分区导航 / 写日志 query 时展开。
 *
 * @param getOpenVisaCaseLogForm - 读取路由透传的「进入页后自动打开新建日志表单」开关
 * @param ensureBlockMounted - 与 `CustomerVisaDomainTab` 同源：将 `logs` 子块标记为已挂载以触发懒加载
 * @returns 折叠 `v-model`、展开函数与 `el-collapse` 的 `change` 处理器
 */
export function useCustomerVisaDomainLogsPanelCollapse(
  getOpenVisaCaseLogForm: () => boolean | undefined,
  ensureBlockMounted: (block: VisaDomainBlockQueryValue) => void,
): {
  logsPanelExpandedNames: Ref<string[]>
  expandLogsPanel: () => void
  onLogsPanelCollapseChange: (active: CollapseModelValue) => void
  logsPanelCollapseName: string
} {
  const logsPanelExpandedNames = ref<string[]>([])

  /**
   * 展开主栏案件日志并确保子 Tab 已挂载，供深链与分区 pill 点击调用。
   */
  function expandLogsPanel(): void {
    logsPanelExpandedNames.value = [CUSTOMER_VISA_DOMAIN_LOGS_PANEL_COLLAPSE_NAME]
    ensureBlockMounted('logs')
  }

  /**
   * 用户手动展开折叠区时补一次挂载标记，避免仅依赖 IO 时子列表未初始化。
   *
   * @param active - Element Plus `el-collapse` 当前展开项 name 列表
   */
  function onLogsPanelCollapseChange(active: CollapseModelValue): void {
    const raw = Array.isArray(active) ? active : [active]
    const names = raw.map((x) => String(x))
    if (names.includes(CUSTOMER_VISA_DOMAIN_LOGS_PANEL_COLLAPSE_NAME)) {
      ensureBlockMounted('logs')
    }
  }

  watch(
    () => getOpenVisaCaseLogForm(),
    (open) => {
      if (open) {
        expandLogsPanel()
      }
    },
    { immediate: true },
  )

  return {
    logsPanelExpandedNames,
    expandLogsPanel,
    onLogsPanelCollapseChange,
    logsPanelCollapseName: CUSTOMER_VISA_DOMAIN_LOGS_PANEL_COLLAPSE_NAME,
  }
}
