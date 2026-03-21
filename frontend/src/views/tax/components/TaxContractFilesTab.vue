<script setup lang="ts">
import BusinessFilePanel from '@/components/BusinessFilePanel.vue'
import { BusinessType } from '@/constants/enums'

defineOptions({ name: 'TaxContractFilesTab' })

defineProps<{
  contractId: string
  customerId?: string
}>()
</script>

<template>
  <BusinessFilePanel
    :business-type="BusinessType.TAX"
    :customer-id="customerId"
    :related-id="contractId"
  />
</template>
