<script setup lang="ts">
import BusinessFilePanel from '@/components/BusinessFilePanel.vue'
import { BusinessType } from '@/constants/enums'

defineOptions({ name: 'CustomerFilesTab' })

defineProps<{ customerId: string }>()
</script>

<template>
  <BusinessFilePanel
    :business-type="BusinessType.CUSTOMER"
    :customer-id="customerId"
  />
</template>
