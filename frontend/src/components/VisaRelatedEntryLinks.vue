<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'

defineOptions({ name: 'VisaRelatedEntryLinks' })

const { t } = useI18n({ useScope: 'global' })
const userStore = useUserStore()

const showAdminCases = computed((): boolean => userStore.hasPermission(P.ADMIN_CASE_LIST))
</script>

<template>
  <div
    v-if="showAdminCases"
    class="visa-related-entry-links"
    role="navigation"
    :aria-label="t('layout.visaRelatedEntryLinksAria')"
  >
    <span class="visa-related-entry-links__label">{{ t('layout.visaRelatedEntryLinksLabel') }}</span>
    <el-tooltip
      :content="t('layout.menuAdminCasesTooltip')"
      placement="bottom"
      :show-after="300"
    >
      <span class="visa-related-entry-links__tooltip-anchor">
        <router-link
          class="visa-related-entry-links__link"
          to="/customers/admin-cases"
        >
          <span class="visa-related-entry-links__link-primary">{{ t('routes.adminCases') }}</span>
          <span class="visa-related-entry-links__link-sub">{{ t('routes.adminCasesMenuSubtitle') }}</span>
        </router-link>
      </span>
    </el-tooltip>
  </div>
</template>

<style scoped lang="scss">
.visa-related-entry-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-spacing-xs);
  font-size: var(--app-font-size-sm);
  color: var(--app-text-secondary);
  line-height: 1.4;
}

.visa-related-entry-links__label {
  margin-right: var(--app-spacing-xs);
  color: var(--app-text-tertiary);
  font-size: var(--app-font-size-xs);
}

.visa-related-entry-links__tooltip-anchor {
  display: inline-flex;
  max-width: 100%;
  vertical-align: middle;
}

.visa-related-entry-links__link {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  max-width: 100%;
  color: var(--el-color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.visa-related-entry-links__link-primary {
  line-height: 1.3;
}

.visa-related-entry-links__link-sub {
  font-size: var(--app-font-size-xs);
  font-weight: 400;
  color: var(--app-text-tertiary);
  line-height: 1.25;
  text-decoration: none;
}
</style>
