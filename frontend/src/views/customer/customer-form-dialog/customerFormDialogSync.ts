import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import { nextTick, type Ref } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'

import { getCustomers } from '@/api/customer'
import { getUsers } from '@/api/system'
import type { CustomerItem } from '@/types/customer'
import type { SystemUser } from '@/types/system'
import {
  buildBaseFormValues,
  buildCompanyFormValues,
  buildPersonFormValues,
  createDefaultFormModel,
  type FormModel,
  mapCustomerItemToAccompanyingMemberRow,
} from '@/views/customer/customerFormDialogModel'

export type StaffOption = { value: string; label: string }

/**
 * 将接口返回的客户主档展开写入表单模型（个人/法人字段一并兼容）。
 *
 * @param form - 客户表单模型
 * @param data - 待编辑的客户记录
 */
export function populateCustomerFormFromItem(form: FormModel, data: CustomerItem): void {
  Object.assign(
    form,
    createDefaultFormModel(),
    buildBaseFormValues(data),
    buildCompanyFormValues(data),
    buildPersonFormValues(data),
  )
}

/**
 * 将客户表单恢复默认并清空随附家属缓存、主客户搜索项与校验态。
 *
 * @param form - 客户表单模型
 * @param accompanyingInitialIds - 编辑态随附家属 ID 缓存
 * @param primaryCustomerOptions - 主客户远程选项
 * @param formRef - `el-form` 实例引用
 */
export function resetCustomerFormDialogForm(
  form: FormModel,
  accompanyingInitialIds: Ref<Set<string>>,
  primaryCustomerOptions: Ref<{ value: string; label: string }[]>,
  formRef: Ref<FormInstance | undefined>,
): void {
  Object.assign(form, createDefaultFormModel())
  accompanyingInitialIds.value = new Set()
  primaryCustomerOptions.value = []
  nextTick(() => formRef.value?.clearValidate())
}

/**
 * 按关键字远程搜索主客户候选（排除当前编辑中的客户）。
 *
 * @param query - 用户输入关键字
 * @param editCustomerId - 编辑中客户 ID，新建时为 `undefined`
 * @param primaryCustomerOptions - 选项 ref
 * @param primaryCustomerLoading - 加载态 ref
 */
export async function searchPrimaryCustomersForDialog(
  query: string,
  editCustomerId: string | undefined,
  primaryCustomerOptions: Ref<{ value: string; label: string }[]>,
  primaryCustomerLoading: Ref<boolean>,
): Promise<void> {
  if (!query) {
    primaryCustomerOptions.value = []
    return
  }
  primaryCustomerLoading.value = true
  try {
    const res = await getCustomers({ keyword: query, pageSize: 20 })
    primaryCustomerOptions.value = res.data.items
      .filter((c) => c.id !== editCustomerId)
      .map((c) => ({ value: c.id, label: `${c.customerName}（${c.customerCode}）` }))
  } finally {
    primaryCustomerLoading.value = false
  }
}

/**
 * 拉取活跃用户并写入负责人下拉选项 ref。
 *
 * @param staffOptions - 负责人选项 ref
 * @param staffLoading - 加载态 ref
 */
export async function loadStaffOptionsIntoRef(
  staffOptions: Ref<StaffOption[]>,
  staffLoading: Ref<boolean>,
): Promise<void> {
  staffLoading.value = true
  try {
    const res = await getUsers({ page: 1, pageSize: 200, status: 'ACTIVE' })
    staffOptions.value = res.data.items.map((user: SystemUser) => ({
      label: user.displayName,
      value: user.id,
    }))
  } catch {
    staffOptions.value = []
  } finally {
    staffLoading.value = false
  }
}

/**
 * 当编辑中的负责人不在活跃用户列表内时，补一条选项以便 `el-select` 展示标签。
 *
 * @param editData - 当前编辑客户或 `null`
 * @param staffOptions - 负责人选项 ref
 */
export function ensureOwnerStaffOptionFromEdit(
  editData: CustomerItem | null | undefined,
  staffOptions: Ref<StaffOption[]>,
): void {
  const d = editData
  if (!d?.ownerUserId) {
    return
  }
  if (staffOptions.value.some((o) => o.value === d.ownerUserId)) {
    return
  }
  const label = d.ownerName?.trim() ? d.ownerName.trim() : d.ownerUserId
  staffOptions.value = [{ value: d.ownerUserId, label }, ...staffOptions.value]
}

/**
 * 按主档 ID 拉取随附家属列表写入表单，失败时清空并提示。
 *
 * @param primaryCustomerId - 主档客户 ID
 * @param form - 客户表单模型
 * @param accompanyingInitialIds - 随附家属 ID 缓存 ref
 * @param t - vue-i18n 翻译函数
 */
export async function loadAccompanyingFamilyMembersForForm(
  primaryCustomerId: string,
  form: FormModel,
  accompanyingInitialIds: Ref<Set<string>>,
  t: ComposerTranslation,
): Promise<void> {
  try {
    const res = await getCustomers({ primaryCustomerId, pageSize: 100, page: 1 })
    form.accompanyingMembers = res.data.items.map(mapCustomerItemToAccompanyingMemberRow)
    accompanyingInitialIds.value = new Set(res.data.items.map((item) => item.id))
  } catch {
    form.accompanyingMembers = []
    accompanyingInitialIds.value = new Set()
    ElMessage.warning(t('dialogs.customerForm.accompanyingFamilyLoadFailed'))
  }
}
