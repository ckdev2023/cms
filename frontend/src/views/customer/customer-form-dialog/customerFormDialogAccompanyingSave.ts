import { ElMessage } from 'element-plus'
import type { Ref } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'

import { createCustomer, deleteCustomer, updateCustomer } from '@/api/customer'
import type { CreateCustomerParams } from '@/types/customer'
import { runSequentially } from '@/utils/run-sequentially'
import {
  accompanyingMemberRowHasAnyField,
  buildAccompanyingMemberCreatePayload,
  buildAccompanyingMemberUpdatePayload,
  type FormModel,
  listRemovedAccompanyingCustomerIds,
} from '@/views/customer/customerFormDialogModel'

/**
 * 新建主档成功后批量创建已填写的随附家属子档，失败姓名汇总提示。
 *
 * @param primaryCustomerId - 新建主档 ID
 * @param form - 客户表单模型
 * @param t - vue-i18n 翻译函数
 */
export async function createAccompanyingFamilyMembersAfterPrimary(
  primaryCustomerId: string,
  form: FormModel,
  t: ComposerTranslation,
): Promise<void> {
  const filled = form.accompanyingMembers.filter(accompanyingMemberRowHasAnyField)
  const failures: string[] = []
  await runSequentially(filled, async (row) => {
    try {
      await createCustomer(buildAccompanyingMemberCreatePayload(row, primaryCustomerId, form))
    } catch {
      failures.push(row.customerName.trim() || t('dialogs.customerForm.accompanyingFamilyUnnamed'))
    }
  })
  if (failures.length > 0) {
    ElMessage.warning(
      t('dialogs.customerForm.accompanyingFamilyPartialCreateFail', {
        names: failures.join('、'),
      }),
    )
  }
}

/**
 * 编辑保存时更新或新建随附家属行，并刷新本地已存在家属 ID 集合。
 *
 * @param primaryCustomerId - 主档客户 ID
 * @param form - 客户表单模型
 * @param accompanyingInitialIds - 随附家属 ID 缓存 ref
 * @param t - vue-i18n 翻译函数
 */
export async function upsertAccompanyingFamilyMembersForPrimary(
  primaryCustomerId: string,
  form: FormModel,
  accompanyingInitialIds: Ref<Set<string>>,
  t: ComposerTranslation,
): Promise<void> {
  const filled = form.accompanyingMembers.filter(accompanyingMemberRowHasAnyField)
  const failures: string[] = []
  await runSequentially(filled, async (row) => {
    try {
      if (row.customerId) {
        await updateCustomer(row.customerId, buildAccompanyingMemberUpdatePayload(row, primaryCustomerId))
      } else {
        const res = await createCustomer(
          buildAccompanyingMemberCreatePayload(row, primaryCustomerId, form),
        )
        row.customerId = res.data.id
        row.clientKey = res.data.id
      }
    } catch {
      failures.push(row.customerName.trim() || t('dialogs.customerForm.accompanyingFamilyUnnamed'))
    }
  })
  if (failures.length > 0) {
    ElMessage.warning(
      t('dialogs.customerForm.accompanyingFamilyPartialSaveFail', {
        names: failures.join('、'),
      }),
    )
  }
  accompanyingInitialIds.value = new Set(
    form.accompanyingMembers.filter((r) => r.customerId).map((r) => r.customerId),
  )
}

/**
 * 编辑保存前若存在从列表移除的随附家属，弹出确认并返回待删 ID；取消则返回 `false`。
 *
 * @param isEdit - 是否编辑模式
 * @param editData - 当前编辑客户
 * @param accompanyingFeatureActive - 随附家属功能是否启用
 * @param accompanyingInitialIds - 打开抽屉时的家属 ID 缓存
 * @param form - 客户表单模型
 * @param confirmDialog - 确认弹窗函数
 * @param t - vue-i18n 翻译函数
 */
export async function confirmRemovedAccompanyingDeletesIfNeededForDialog(
  isEdit: boolean,
  editData: { id: string } | null | undefined,
  accompanyingFeatureActive: boolean,
  accompanyingInitialIds: Set<string>,
  form: FormModel,
  confirmDialog: (opts: { message: string; type: 'warning' }) => Promise<boolean>,
  t: ComposerTranslation,
): Promise<string[] | false> {
  if (!isEdit || !editData || !accompanyingFeatureActive) {
    return []
  }
  const removed = listRemovedAccompanyingCustomerIds(accompanyingInitialIds, form.accompanyingMembers)
  if (removed.length === 0) {
    return []
  }
  const ok = await confirmDialog({
    message: t('dialogs.customerForm.accompanyingFamilyBatchDeleteConfirm', {
      count: removed.length,
    }),
    type: 'warning',
  })
  return ok ? removed : false
}

/**
 * 执行编辑主档 PUT、可选批量删除移除的家属、以及随附家属 upsert。
 *
 * @param primaryId - 主档 ID
 * @param payload - 主档更新载荷
 * @param removedAccompanyingIds - 已确认删除的家属客户 ID
 * @param accompanyingFeatureActive - 是否同步随附家属
 * @param form - 客户表单模型
 * @param accompanyingInitialIds - 家属 ID 缓存 ref
 * @param t - vue-i18n 翻译函数
 */
export async function applyEditCustomerWithAccompanying(
  primaryId: string,
  payload: CreateCustomerParams,
  removedAccompanyingIds: string[],
  accompanyingFeatureActive: boolean,
  form: FormModel,
  accompanyingInitialIds: Ref<Set<string>>,
  t: ComposerTranslation,
): Promise<void> {
  if (accompanyingFeatureActive) {
    await runSequentially(removedAccompanyingIds, async (id) => {
      await deleteCustomer(id)
    })
  }
  await updateCustomer(primaryId, payload)
  if (accompanyingFeatureActive) {
    await upsertAccompanyingFamilyMembersForPrimary(primaryId, form, accompanyingInitialIds, t)
  }
}

/**
 * 执行新建主档 POST 与可选随附家属批量创建，返回新主档 ID。
 *
 * @param payload - 主档创建载荷
 * @param accompanyingFeatureActive - 是否创建随附家属
 * @param form - 客户表单模型
 * @param t - vue-i18n 翻译函数
 */
export async function applyCreateCustomerWithAccompanying(
  payload: CreateCustomerParams,
  accompanyingFeatureActive: boolean,
  form: FormModel,
  t: ComposerTranslation,
): Promise<string> {
  const res = await createCustomer(payload)
  if (accompanyingFeatureActive) {
    await createAccompanyingFamilyMembersAfterPrimary(res.data.id, form, t)
  }
  return res.data.id
}
