<script setup lang="ts">
import BusinessFilePanel from '@/components/BusinessFilePanel.vue'
import { BusinessType } from '@/constants/enums'

defineProps<{
  contractId: string
  customerId?: string
}>()

defineOptions({ name: 'TaxContractFilesTab' })

</script>

<template>
  <BusinessFilePanel
    :business-type="BusinessType.TAX"
    :customer-id="customerId"
    :related-id="contractId"
  />
</template>
