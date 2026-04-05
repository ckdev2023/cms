import type { ComposerTranslation } from 'vue-i18n'

import {
  CustomerStatusLabel,
  CustomerTypeLabel,
  FamilyLinkModeLabel,
  ServiceTypeLabel,
  VisaCaseStatusLabel,
  VisaReminderTypeLabel,
} from '@/constants/enum-labels'
import type { CustomerQueryParams } from '@/types/customer'

/** 已选条件标签对应的表单字段键，用于单项清除。 */
export type CustomerListFilterChipId =
  | 'keyword'
  | 'customerType'
  | 'serviceType'
  | 'status'
  | 'listPrimaryVisaCaseStatus'
  | 'visaCaseTypeKeyword'
  | 'listPrimaryFamilyCaseFilter'
  | 'listPrimaryFamilyLinkMode'
  | 'visaReminderBucket'
  | 'residenceExpireWithinDays'

/** 单行已选筛选展示（标签文案 + 清除目标）。 */
export interface CustomerListFilterChip {
  id: CustomerListFilterChipId
  label: string
}

const MAX_VISA_CASE_TYPE_CHIP_LEN = 36

/**
 * 将主档与关键词类筛选项追加到标签列表（若有值）。
 *
 * @param chips - 待追加的输出数组
 * @param f - 当前查询表单
 * @param t - vue-i18n 全局 `t`
 */
function appendCustomerMasterChips(
  chips: CustomerListFilterChip[],
  f: CustomerQueryParams,
  t: ComposerTranslation,
): void {
  const kw = typeof f.keyword === 'string' ? f.keyword.trim() : ''
  if (kw) {
    chips.push({
      id: 'keyword',
      label: `${t('common.keyword')}: ${kw}`,
    })
  }
  if (f.customerType) {
    chips.push({
      id: 'customerType',
      label: `${t('common.type')}: ${CustomerTypeLabel[f.customerType]}`,
    })
  }
  if (f.serviceType) {
    chips.push({
      id: 'serviceType',
      label: `${t('pages.customers.serviceTypeFilter')}: ${ServiceTypeLabel[f.serviceType]}`,
    })
  }
  if (f.status) {
    chips.push({
      id: 'status',
      label: `${t('common.status')}: ${CustomerStatusLabel[f.status]}`,
    })
  }
}

/**
 * 将主签证案件相关筛选项追加到标签列表（若有值）。
 *
 * @param chips - 待追加的输出数组
 * @param f - 当前查询表单
 * @param t - vue-i18n 全局 `t`
 */
function appendPrimaryVisaCaseChips(
  chips: CustomerListFilterChip[],
  f: CustomerQueryParams,
  t: ComposerTranslation,
): void {
  if (f.listPrimaryVisaCaseStatus) {
    chips.push({
      id: 'listPrimaryVisaCaseStatus',
      label: `${t('pages.customers.listPrimaryVisaCaseStatusFilter')}: ${VisaCaseStatusLabel[f.listPrimaryVisaCaseStatus]}`,
    })
  }
  const visaKw =
    typeof f.visaCaseTypeKeyword === 'string' ? f.visaCaseTypeKeyword.trim() : ''
  if (visaKw) {
    const display =
      visaKw.length > MAX_VISA_CASE_TYPE_CHIP_LEN
        ? `${visaKw.slice(0, MAX_VISA_CASE_TYPE_CHIP_LEN)}…`
        : visaKw
    chips.push({
      id: 'visaCaseTypeKeyword',
      label: `${t('pages.customers.visaCaseTypeFilter')}: ${display}`,
    })
  }
  if (f.listPrimaryFamilyCaseFilter === 'yes') {
    chips.push({
      id: 'listPrimaryFamilyCaseFilter',
      label: `${t('pages.customers.listPrimaryFamilyCaseFilter')}: ${t('pages.customers.listPrimaryFamilyCaseFilterYes')}`,
    })
  } else if (f.listPrimaryFamilyCaseFilter === 'no') {
    chips.push({
      id: 'listPrimaryFamilyCaseFilter',
      label: `${t('pages.customers.listPrimaryFamilyCaseFilter')}: ${t('pages.customers.listPrimaryFamilyCaseFilterNo')}`,
    })
  }
  if (f.listPrimaryFamilyLinkMode) {
    chips.push({
      id: 'listPrimaryFamilyLinkMode',
      label: `${t('pages.customers.listPrimaryFamilyLinkModeFilter')}: ${FamilyLinkModeLabel[f.listPrimaryFamilyLinkMode]}`,
    })
  }
}

/**
 * 将在留与提醒桶筛选项追加到标签列表（若有值）。
 *
 * @param chips - 待追加的输出数组
 * @param f - 当前查询表单
 * @param t - vue-i18n 全局 `t`
 */
function appendAlertResidenceChips(
  chips: CustomerListFilterChip[],
  f: CustomerQueryParams,
  t: ComposerTranslation,
): void {
  if (f.visaReminderBucket) {
    chips.push({
      id: 'visaReminderBucket',
      label: `${t('pages.customers.visaRiskBucketFilter')}: ${VisaReminderTypeLabel[f.visaReminderBucket]}`,
    })
  }
  if (
    f.residenceExpireWithinDays !== undefined &&
    f.residenceExpireWithinDays !== null &&
    Number.isFinite(f.residenceExpireWithinDays)
  ) {
    chips.push({
      id: 'residenceExpireWithinDays',
      label: `${t('pages.customers.residenceExpireWithinDaysFilter')}: ${t('pages.customers.residenceWithinDaysOption', { days: f.residenceExpireWithinDays })}`,
    })
  }
}

/**
 * 根据客户列表查询表单构造「已选条件」标签数据，供列表筛选区展示与逐项清除。
 *
 * @param f - 当前查询表单快照
 * @param t - vue-i18n 全局翻译函数
 * @returns 非空筛选项对应的展示标签（顺序：主档 → 主案件 → 在留/提醒）
 */
export function buildCustomerListFilterChips(
  f: CustomerQueryParams,
  t: ComposerTranslation,
): CustomerListFilterChip[] {
  const chips: CustomerListFilterChip[] = []
  appendCustomerMasterChips(chips, f, t)
  appendPrimaryVisaCaseChips(chips, f, t)
  appendAlertResidenceChips(chips, f, t)
  return chips
}

/**
 * 清除与指定 chip 对应的一项客户列表筛选字段（不触发路由或父级 reset 的其它副作用）。
 *
 * @param f - 可变的查询表单对象（与 `v-model` 同源）
 * @param id - 筛选项标识
 */
export function clearCustomerListFilterChip(
  f: CustomerQueryParams,
  id: CustomerListFilterChipId,
): void {
  switch (id) {
    case 'keyword':
      f.keyword = ''
      break
    case 'customerType':
      f.customerType = undefined
      break
    case 'serviceType':
      f.serviceType = undefined
      break
    case 'status':
      f.status = undefined
      break
    case 'listPrimaryVisaCaseStatus':
      f.listPrimaryVisaCaseStatus = undefined
      break
    case 'visaCaseTypeKeyword':
      f.visaCaseTypeKeyword = undefined
      break
    case 'listPrimaryFamilyCaseFilter':
      f.listPrimaryFamilyCaseFilter = undefined
      break
    case 'listPrimaryFamilyLinkMode':
      f.listPrimaryFamilyLinkMode = undefined
      break
    case 'visaReminderBucket':
      f.visaReminderBucket = undefined
      break
    case 'residenceExpireWithinDays':
      f.residenceExpireWithinDays = undefined
      break
  }
}
