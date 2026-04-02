<script setup lang="ts">
import BusinessFilePanel from '@/components/BusinessFilePanel.vue'
import { BusinessType } from '@/constants/enums'

defineProps<{ customerId: string }>()

defineOptions({ name: 'CustomerFilesTab' })

</script>

<template>
  <BusinessFilePanel
    :business-type="BusinessType.CUSTOMER"
    :customer-id="customerId"
  />
</template>
