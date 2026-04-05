<script setup lang="ts">
import { Lock, User } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import type { AppLocale } from '@/i18n'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
})

const rules = computed<FormRules>(() => ({
  username: [{ required: true, message: t('login.usernameRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }],
}))
const currentLocale = computed<AppLocale>({
  get: () => appStore.locale,
  set: (value) => appStore.setLocale(value),
})
const localeOptions = computed(() => [
  { value: 'zh-CN' as AppLocale, label: t('locale.zhCN') },
  { value: 'ja' as AppLocale, label: t('locale.ja') },
])

/**
 * 校验登录表单并在成功后跳转到目标页面。
 */
async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {return}

  loading.value = true
  try {
    await userStore.login(form)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch {
    // error handled in request interceptor
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-page__bg" />

    <div class="login-toolbar">
      <el-select v-model="currentLocale" size="small" class="login-toolbar__locale" aria-label="language">
        <el-option
          v-for="option in localeOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
    </div>

    <div class="login-card">
      <div class="login-card__brand">
        <span class="login-card__logo-mark">事</span>
        <h1 class="login-card__title">{{ t('login.title') }}</h1>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" :placeholder="t('login.username')" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            :placeholder="t('login.password')"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        <el-form-item class="login-card__submit">
          <el-button type="primary" :loading="loading" class="login-card__btn" @click="handleLogin">
            {{ t('login.submit') }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.login-page {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $sidebar-bg;
  overflow: hidden;

  &__bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%, rgba($color-primary, 0.18) 0%, transparent 70%),
      radial-gradient(ellipse 60% 50% at 80% 100%, rgba($color-primary, 0.10) 0%, transparent 60%);
    pointer-events: none;
  }
}

.login-toolbar {
  position: absolute;
  top: $spacing-xl;
  right: $spacing-xl;
  z-index: 1;

  :deep(.el-select) {
    --el-text-color-regular: #{$sidebar-text};
    --el-border-color: rgba(255, 255, 255, 0.15);
    --el-bg-color: rgba(255, 255, 255, 0.06);

    .el-input__wrapper {
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
      background-color: rgba(255, 255, 255, 0.06);

      &:hover {
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25) inset;
      }
    }

    .el-input__inner {
      color: rgba(255, 255, 255, 0.85);
    }

    .el-select__suffix {
      color: $sidebar-text;
    }
  }
}

.login-toolbar__locale {
  width: 112px;
}

.login-card {
  position: relative;
  width: 400px;
  padding: $spacing-3xl $spacing-2xl $spacing-2xl;
  background: $bg-color-base;
  border-radius: $radius-xl;
  box-shadow: $shadow-xl, 0 0 0 1px rgba(255, 255, 255, 0.05);
  z-index: 1;

  &__brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-md;
    margin-bottom: $spacing-2xl;
  }

  &__logo-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: $radius-lg;
    background: $color-primary;
    color: #fff;
    font-size: $font-size-3xl;
    font-weight: $font-weight-bold;
    line-height: 1;
    letter-spacing: -0.01em;
    box-shadow: 0 4px 12px rgba($color-primary, 0.35);
  }

  &__title {
    margin: 0;
    font-size: $font-size-2xl;
    font-weight: $font-weight-semibold;
    color: $text-color-primary;
    letter-spacing: 0.01em;
    line-height: $line-height-tight;
  }

  &__submit {
    margin-bottom: 0;
    margin-top: $spacing-sm;
  }

  &__btn {
    width: 100%;
    height: 42px;
    font-size: $font-size-md;
    font-weight: $font-weight-medium;
    letter-spacing: 0.02em;
    border-radius: $radius-md;
  }

  :deep(.el-form-item) {
    margin-bottom: $spacing-lg;
  }

  :deep(.el-input__wrapper) {
    border-radius: $radius-md;
    padding: 2px $spacing-md;
  }
}

@media (max-width: 480px) {
  .login-card {
    width: calc(100% - #{$spacing-2xl} * 2);
    padding: $spacing-2xl $spacing-lg $spacing-lg;
  }
}
</style>
