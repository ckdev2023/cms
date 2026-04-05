import { computed, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ProTableColumn } from '@/types/components'

/**
 * 构造客户列表主档在留派生列（到期日与提醒等级，与 person_info 计算字段一致）。
 *
 * @param t - i18n 翻译函数
 * @returns 在留到期日与提醒等级两列
 */
function buildCustomerListResidenceColumns(
  t: (k: string) => string,
): ProTableColumn[] {
  return [
    {
      prop: 'residenceExpireDateCol',
      label: t('detailViews.customer.basicFields.residenceExpireDate'),
      width: 120,
      slot: 'residenceExpireDateCol',
    },
    {
      prop: 'personResidenceAlertCol',
      label: t('pages.customers.personResidenceAlert'),
      width: 112,
      slot: 'personResidenceAlertCol',
      align: 'center',
    },
  ]
}

/**
 * 构造主展示签证案件摘要列（docs/17 §1.11 / docs/21 §1.6）。
 *
 * @param t - i18n 翻译函数
 * @returns 类型、状态、到期、跟进、负责人、家族签、材料进度列
 */
function buildCustomerListPrimaryCaseSummaryColumns(
  t: (k: string) => string,
): ProTableColumn[] {
  return [
    {
      prop: 'listPrimaryCaseType',
      label: t('pages.customers.listPrimaryCaseType'),
      minWidth: 108,
      slot: 'listPrimaryCaseType',
      showOverflowTooltip: true,
    },
    {
      prop: 'listPrimaryCaseStatus',
      label: t('pages.customers.listPrimaryCaseStatus'),
      width: 112,
      slot: 'listPrimaryCaseStatus',
      align: 'center',
    },
    {
      prop: 'listPrimaryCaseExpire',
      label: t('pages.customers.listPrimaryCaseExpire'),
      width: 112,
      slot: 'listPrimaryCaseExpire',
    },
    {
      prop: 'listPrimaryCaseNextFollowUp',
      label: t('pages.customers.listPrimaryCaseNextFollowUp'),
      width: 124,
      slot: 'listPrimaryCaseNextFollowUp',
    },
    {
      prop: 'listPrimaryCaseAssignee',
      label: t('pages.customers.listPrimaryCaseAssignee'),
      width: 108,
      slot: 'listPrimaryCaseAssignee',
      showOverflowTooltip: true,
    },
    {
      prop: 'listPrimaryCaseFamily',
      label: t('pages.customers.listPrimaryCaseFamily'),
      minWidth: 168,
      slot: 'listPrimaryCaseFamily',
      align: 'center',
    },
    {
      prop: 'listPrimaryCaseMaterial',
      label: t('pages.customers.listPrimaryCaseMaterial'),
      minWidth: 156,
      slot: 'listPrimaryCaseMaterial',
      align: 'center',
    },
  ]
}

/**
 * 根据 i18n 生成客户列表表格列配置（含主档在留派生列与主展示案件摘要列）。
 *
 * 主档在留日与签证案件到期并列展示，与 `GET /customers` 的 `personInfo` / `listPrimaryVisaCase` 一致（docs/21 §1.5、§6.4）。
 *
 * @returns 响应式列数组
 */
export function useCustomerListViewColumns(): ComputedRef<ProTableColumn[]> {
  const { t } = useI18n({ useScope: 'global' })
  return computed(() => {
    const residenceCols = buildCustomerListResidenceColumns(t)
    const primaryCols = buildCustomerListPrimaryCaseSummaryColumns(t)
    return [
      {
        prop: 'customerCode',
        label: t('pages.customers.customerCode'),
        width: 120,
        sortable: 'custom',
      },
      {
        prop: 'customerType',
        label: t('common.type'),
        width: 90,
        slot: 'customerType',
        align: 'center',
      },
      {
        prop: 'customerName',
        label: t('pages.customers.customerName'),
        minWidth: 180,
        sortable: 'custom',
      },
      ...residenceCols,
      { prop: 'phone', label: t('common.phone'), width: 140 },
      {
        prop: 'serviceType',
        label: t('pages.customers.service'),
        width: 110,
        slot: 'serviceType',
        align: 'center',
      },
      { prop: 'ownerName', label: t('pages.customers.owner'), width: 120 },
      {
        prop: 'status',
        label: t('common.status'),
        width: 100,
        slot: 'status',
        align: 'center',
      },
      {
        prop: 'visaDerivedRisk',
        label: t('pages.customers.visaDerivedRisk'),
        headerTooltip: t('pages.customers.visaDerivedRiskColumnTooltip'),
        width: 130,
        slot: 'visaDerivedRisk',
        align: 'center',
      },
      ...primaryCols,
      {
        prop: 'createdAt',
        label: t('common.createdAt'),
        width: 110,
        slot: 'createdAt',
        sortable: 'custom',
      },
    ]
  })
}
