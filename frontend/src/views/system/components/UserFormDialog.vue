<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { createUser, updateUser, getAllRoles } from '@/api/system'
import type { SystemUser, CreateUserParams, RoleRef } from '@/types/system'

defineOptions({ name: 'UserFormDialog' })
const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  editData: SystemUser | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  saved: []
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const roleOptions = ref<RoleRef[]>([])

const isEdit = computed(() => !!props.editData)
const dialogTitle = computed(() =>
  isEdit.value ? t('dialogs.userForm.editTitle') : t('dialogs.userForm.createTitle'),
)

interface FormModel {
  username: string
  password: string
  displayName: string
  email: string
  phone: string
  roleIds: string[]
}

const form = reactive<FormModel>({
  username: '',
  password: '',
  displayName: '',
  email: '',
  phone: '',
  roleIds: [],
})

const rules = computed<FormRules>(() => ({
  username: [
    { required: !isEdit.value, message: t('common.enterField', { field: t('dialogs.userForm.username') }), trigger: 'blur' },
    { max: 50, message: t('validation.maxChars', { max: 50 }), trigger: 'blur' },
  ],
  password: isEdit.value
    ? []
    : [
        { required: true, message: t('common.enterField', { field: t('dialogs.userForm.password') }), trigger: 'blur' },
        { min: 6, message: t('validation.minChars', { min: 6 }), trigger: 'blur' },
      ],
  displayName: [
    { required: true, message: t('common.enterField', { field: t('dialogs.userForm.displayName') }), trigger: 'blur' },
    { max: 100, message: t('validation.maxChars', { max: 100 }), trigger: 'blur' },
  ],
  email: [
    { type: 'email', message: t('validation.invalidEmail'), trigger: 'blur' },
  ],
}))

async function loadRoles() {
  try {
    const res = await getAllRoles()
    roleOptions.value = res.data.items.map((r) => ({
      id: r.id,
      roleName: r.roleName,
      roleCode: r.roleCode,
    }))
  } catch {
    // handled by interceptor
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      loadRoles()
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

function populateForm(user: SystemUser) {
  form.username = user.username
  form.password = ''
  form.displayName = user.displayName
  form.email = user.email ?? ''
  form.phone = user.phone ?? ''
  form.roleIds = user.roles.map((r) => r.id)
  nextTick(() => formRef.value?.clearValidate())
}

function resetForm() {
  form.username = ''
  form.password = ''
  form.displayName = ''
  form.email = ''
  form.phone = ''
  form.roleIds = []
  nextTick(() => formRef.value?.clearValidate())
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (isEdit.value && props.editData) {
      await updateUser(props.editData.id, {
        displayName: form.displayName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        roleIds: form.roleIds,
      })
      ElMessage.success(t('dialogs.userForm.updated'))
    } else {
      const payload: CreateUserParams = {
        username: form.username,
        password: form.password,
        displayName: form.displayName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        roleIds: form.roleIds.length ? form.roleIds : undefined,
      }
      await createUser(payload)
      ElMessage.success(t('dialogs.userForm.created'))
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
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="560px"
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
      <el-form-item :label="t('dialogs.userForm.username')" prop="username">
        <el-input
          v-model="form.username"
          :disabled="isEdit"
          :placeholder="t('dialogs.userForm.loginUsernamePlaceholder')"
          maxlength="50"
        />
      </el-form-item>

      <el-form-item v-if="!isEdit" :label="t('dialogs.userForm.password')" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          :placeholder="t('dialogs.userForm.passwordPlaceholder')"
          maxlength="50"
        />
      </el-form-item>

      <el-form-item :label="t('dialogs.userForm.displayName')" prop="displayName">
        <el-input
          v-model="form.displayName"
          :placeholder="t('common.enterField', { field: t('dialogs.userForm.displayName') })"
          maxlength="100"
        />
      </el-form-item>

      <el-form-item :label="t('common.email')" prop="email">
        <el-input
          v-model="form.email"
          :placeholder="t('common.email')"
          maxlength="120"
        />
      </el-form-item>

      <el-form-item :label="t('common.phone')" prop="phone">
        <el-input
          v-model="form.phone"
          :placeholder="t('common.phone')"
          maxlength="50"
        />
      </el-form-item>

      <el-form-item :label="t('common.role')" prop="roleIds">
        <el-select
          v-model="form.roleIds"
          multiple
          :placeholder="t('common.selectField', { field: t('common.role') })"
          style="width: 100%"
        >
          <el-option
            v-for="role in roleOptions"
            :key="role.id"
            :label="role.roleName"
            :value="role.id"
          />
        </el-select>
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
