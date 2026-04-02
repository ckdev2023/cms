<script setup lang="ts">
import type { ElTree, FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createRole, getPermissionTree, updateRole } from '@/api/system'
import type { CreateRoleParams, PermissionGroup, SystemRole } from '@/types/system'

const props = defineProps<{
  modelValue: boolean
  editData: SystemRole | null
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  saved: []
}>()
defineOptions({ name: 'RoleFormDialog' })
const { t } = useI18n()

const formRef = ref<FormInstance>()
const treeRef = ref<InstanceType<typeof ElTree>>()
const submitting = ref(false)
const permissionGroups = ref<PermissionGroup[]>([])

const isEdit = computed(() => !!props.editData)
const dialogTitle = computed(() =>
  isEdit.value ? t('dialogs.roleForm.editTitle') : t('dialogs.roleForm.createTitle'),
)

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

const treeData = computed<TreeNode[]>(() =>
  permissionGroups.value.map((group) => ({
    id: `module:${group.module}`,
    label: getModuleLabel(group.module),
    children: group.children.map((p) => ({
      id: p.id,
      label: p.permissionName,
    })),
  })),
)

const MODULE_LABELS: Record<string, string> = {
  customer: 'dialogs.roleForm.moduleCustomer',
  admin_case: 'dialogs.roleForm.moduleAdminCase',
  tax: 'dialogs.roleForm.moduleTax',
  finance: 'dialogs.roleForm.moduleFinance',
  file: 'dialogs.roleForm.moduleFile',
  system: 'dialogs.roleForm.moduleSystem',
  log: 'dialogs.roleForm.moduleLog',
  dashboard: 'dialogs.roleForm.moduleDashboard',
}

function getModuleLabel(module: string): string {
  return MODULE_LABELS[module] ? t(MODULE_LABELS[module]) : module
}

interface FormModel {
  roleName: string
  roleCode: string
  description: string
}

const form = reactive<FormModel>({
  roleName: '',
  roleCode: '',
  description: '',
})

const rules = computed<FormRules>(() => ({
  roleName: [
    { required: true, message: t('common.enterField', { field: t('dialogs.roleForm.roleName') }), trigger: 'blur' },
    { max: 50, message: t('validation.maxChars', { max: 50 }), trigger: 'blur' },
  ],
  roleCode: [
    { required: !isEdit.value, message: t('common.enterField', { field: t('dialogs.roleForm.roleCode') }), trigger: 'blur' },
    {
      pattern: /^[A-Z][A-Z0-9_]*$/,
      message: t('dialogs.roleForm.roleCodeFormat'),
      trigger: 'blur',
    },
  ],
}))

/**
 * 拉取角色编辑器所需的权限树数据。
 *
 * @returns 无返回值
 */
async function loadPermissions() {
  try {
    const res = await getPermissionTree()
    permissionGroups.value = res.data
  } catch {
    // handled by interceptor
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      loadPermissions()
      nextTick(() => {
        if (props.editData) {
          populateForm(props.editData)
        } else {
          resetForm()
        }
      })
    }
  },
)

/**
 * 将待编辑角色的数据写入表单和权限树。
 *
 * @param role - 当前正在编辑的角色记录
 * @returns 无返回值
 */
function populateForm(role: SystemRole) {
  form.roleName = role.roleName
  form.roleCode = role.roleCode
  form.description = role.description ?? ''
  nextTick(() => {
    formRef.value?.clearValidate()
    if (treeRef.value) {
      treeRef.value.setCheckedKeys(role.permissionIds ?? [], false)
    }
  })
}

/**
 * 清空角色表单与权限树选中状态，准备创建新角色。
 *
 * @returns 无返回值
 */
function resetForm() {
  form.roleName = ''
  form.roleCode = ''
  form.description = ''
  nextTick(() => {
    formRef.value?.clearValidate()
    treeRef.value?.setCheckedKeys([], false)
  })
}

function getCheckedPermissionIds(): string[] {
  if (!treeRef.value) return []
  const checkedKeys = treeRef.value.getCheckedKeys(false) as string[]
  return checkedKeys.filter((key) => !key.startsWith('module:'))
}

/**
 * 校验角色表单并提交创建或更新请求。
 *
 * @returns 无返回值
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const permissionIds = getCheckedPermissionIds()
    if (isEdit.value && props.editData) {
      await updateRole(props.editData.id, {
        roleName: form.roleName,
        description: form.description || undefined,
        permissionIds,
      })
      ElMessage.success(t('dialogs.roleForm.updated'))
    } else {
      const payload: CreateRoleParams = {
        roleName: form.roleName,
        roleCode: form.roleCode,
        description: form.description || undefined,
        permissionIds: permissionIds.length ? permissionIds : undefined,
      }
      await createRole(payload)
      ElMessage.success(t('dialogs.roleForm.created'))
    }
    emit('update:modelValue', false)
    emit('saved')
  } catch {
    // handled by interceptor
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  emit('update:modelValue', false)
}

/**
 * 根据全选状态批量勾选或清空所有角色权限。
 *
 * @param checked - 全选复选框当前是否选中
 * @returns 无返回值
 */
function handleCheckAll(checked: boolean) {
  if (!treeRef.value) return
  if (checked) {
    const allLeafIds = permissionGroups.value.flatMap((g) =>
      g.children.map((c) => c.id),
    )
    treeRef.value.setCheckedKeys(allLeafIds, false)
  } else {
    treeRef.value.setCheckedKeys([], false)
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="640px"
    destroy-on-close
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      label-position="right"
    >
      <el-form-item :label="t('dialogs.roleForm.roleName')" prop="roleName">
        <el-input
          v-model="form.roleName"
          :placeholder="t('common.enterField', { field: t('dialogs.roleForm.roleName') })"
          maxlength="50"
        />
      </el-form-item>

      <el-form-item :label="t('dialogs.roleForm.roleCode')" prop="roleCode">
        <el-input
          v-model="form.roleCode"
          :disabled="isEdit"
          :placeholder="t('dialogs.roleForm.roleCodePlaceholder')"
          maxlength="50"
        />
      </el-form-item>

      <el-form-item :label="t('common.description')" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          :placeholder="t('common.description')"
          maxlength="255"
        />
      </el-form-item>

      <el-form-item :label="t('dialogs.roleForm.permissions')">
        <div style="width: 100%">
          <div style="margin-bottom: 8px">
            <el-checkbox
              :indeterminate="false"
              @change="handleCheckAll"
            >
              {{ t('dialogs.roleForm.selectAll') }}
            </el-checkbox>
          </div>
          <el-scrollbar max-height="320px">
            <el-tree
              ref="treeRef"
              :data="treeData"
              show-checkbox
              node-key="id"
              default-expand-all
              :props="{ label: 'label', children: 'children' }"
              :check-strictly="false"
            />
          </el-scrollbar>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? t('common.update') : t('common.create') }}
      </el-button>
    </template>
  </el-dialog>
</template>
