import { ElMessage } from 'element-plus'
import type { ComposerTranslation } from 'vue-i18n'
import type { Router } from 'vue-router'

import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import { resolveCustomerCreateVisaNudgeMode } from '@/utils/customer-create-visa-nudge'
import { mergeCustomerDetailReturnQuery } from '@/utils/customer-detail-return-navigation'
import { visaUiVisaPrimaryEntriesVisible } from '@/utils/visa-ui-feature-flags'

type UserStore = ReturnType<typeof useUserStore>

/**
 * 判断当前登录用户是否具备进入客户详情「签证」聚合 Tab 的入口权限（与详情页展示口径一致）。
 *
 * @param userStore - 当前用户 Pinia store
 * @returns 可进入签证域 Tab 时返回 true
 */
export function canOpenCustomerVisaDomainTab(userStore: UserStore): boolean {
  return (
    visaUiVisaPrimaryEntriesVisible() &&
    (userStore.hasPermission(P.VISA_CASE_LIST) ||
      userStore.hasPermission(P.VISA_CASE_DETAIL) ||
      userStore.hasPermission(P.VISA_REMINDER_LIST) ||
      userStore.hasPermission(P.CUSTOMER_FILE_PATH_LIST))
  )
}

/**
 * 新建主档成功后弹出成功提示；在开关允许时展示带跳转动作的签证域引导 `ElMessage`。
 *
 * @param newCustomerId - 新建主档客户 ID
 * @param t - vue-i18n 翻译函数
 * @param router - Vue Router 实例
 * @param userStore - 当前用户 Pinia store
 */
export function showPostCreateCustomerMessages(
  newCustomerId: string,
  t: ComposerTranslation,
  router: Router,
  userStore: UserStore,
): void {
  const nudgeMode = resolveCustomerCreateVisaNudgeMode()
  const canVisaTab = canOpenCustomerVisaDomainTab(userStore)
  const canOpenWizard = userStore.hasPermission(P.VISA_CASE_CREATE)
  const useWizardQuery = nudgeMode === 'wizard' && canOpenWizard

  if (nudgeMode === 'off' || !canVisaTab) {
    ElMessage.success(t('dialogs.customerForm.created'))
    return
  }

  const query: Record<string, string> = {
    tab: 'visa-domain',
    visaDomainBlock: 'cases',
    ...(useWizardQuery ? { openVisaCaseWizard: '1' } : {}),
  }
  mergeCustomerDetailReturnQuery(query, router.currentRoute.value)
  void router.push({
    name: 'CustomerDetail',
    params: { id: newCustomerId },
    query,
  })
  ElMessage.success(t('dialogs.customerForm.createdVisaDeepLinkDone'))
}
