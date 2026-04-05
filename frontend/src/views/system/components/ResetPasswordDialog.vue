<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { resetUserPassword } from '@/api/system'
import type { SystemUser } from '@/types/system'

const props = defineProps<{
  modelValue: boolean
  user: SystemUser | null
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
}>()
defineOptions({ name: 'ResetPasswordDialog' })
const { t } = useI18n()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  newPassword: '',
})

const rules: FormRules = {
  newPassword: [
    { required: true, message: t('common.enterField', { field: t('dialogs.resetPassword.newPassword') }), trigger: 'blur' },
    { min: 6, message: t('validation.minChars', { min: 6 }), trigger: 'blur' },
  ],
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      nextTick(() => {
        form.newPassword = ''
        formRef.value?.clearValidate()
      })
    }
  },
)

/**
 * 校验新密码表单后提交重置请求，并在成功后关闭弹窗。
 *
 * @returns 无返回值
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !props.user) {return}

  submitting.value = true
  try {
    await resetUserPassword(props.user.id, form.newPassword)
    ElMessage.success(t('dialogs.resetPassword.success', { name: props.user.displayName }))
    emit('update:modelValue', false)
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
    :title="t('dialogs.resetPassword.title')"
    width="420px"
    destroy-on-close
    @close="handleClose"
  >
    <p v-if="user" class="text-regular" style="margin-bottom: 16px">
      {{ t('dialogs.resetPassword.targetUser') }}<strong>{{ user.displayName }}</strong>（{{ user.username }}）
    </p>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
    >
      <el-form-item :label="t('dialogs.resetPassword.newPassword')" prop="newPassword">
        <el-input
          v-model="form.newPassword"
          type="password"
          show-password
          :placeholder="t('dialogs.userForm.passwordPlaceholder')"
          maxlength="50"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('dialogs.resetPassword.submit') }}
      </el-button>
    </template>
  </el-dialog>
</template>
