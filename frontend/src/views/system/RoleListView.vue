<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import RoleFormDialog from './components/RoleFormDialog.vue'
import { useAppStore } from '@/stores/app'
import { getRoles, deleteRole } from '@/api/system'
import { useProTable } from '@/composables/useProTable'
import { useConfirm } from '@/composables/useConfirm'
import type { ProTableColumn } from '@/types/components'
import type { SystemRole, RoleQueryParams } from '@/types/system'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'RoleListView' })

const { confirmDelete } = useConfirm()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'roleName', label: t('pages.roles.roleName'), width: 160, sortable: 'custom' },
  { prop: 'roleCode', label: t('pages.roles.roleCode'), width: 160, sortable: 'custom' },
  { prop: 'description', label: t('common.description'), minWidth: 200 },
  { prop: 'isSystem', label: t('pages.roles.systemRole'), width: 100, slot: 'isSystem', align: 'center' },
  { prop: 'permissions', label: t('pages.roles.permissionCount'), width: 100, slot: 'permCount', align: 'center' },
  { prop: 'createdAt', label: t('common.createdAt'), width: 110, slot: 'createdAt', sortable: 'custom' },
])

const searchForm = reactive<RoleQueryParams>({
  keyword: '',
})

const {
  loading,
  data,
  total,
  page,
  pageSize,
  fetchData,
  handlePageChange,
  handleSizeChange,
  handleSearch,
  handleReset,
} = useProTable<SystemRole>(getRoles)

const dialogVisible = ref(false)
const editingRole = ref<SystemRole | null>(null)

function handleAdd() {
  editingRole.value = null
  dialogVisible.value = true
}

function handleEdit(row: SystemRole) {
  editingRole.value = row
  dialogVisible.value = true
}

async function handleDelete(row: SystemRole) {
  if (row.isSystem) {
    ElMessage.warning(t('pages.roles.systemRoleDeleteBlocked'))
    return
  }

  const ok = await confirmDelete(row.roleName)
  if (!ok) return

  try {
    await deleteRole(row.id)
    ElMessage.success(t('pages.roles.deleteSuccess'))
    fetchData()
  } catch {
    // handled by interceptor
  }
}

function handleSaved() {
  fetchData()
}

function doSearch() {
  const params: Record<string, any> = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  handleSearch(params)
}

function doReset() {
  searchForm.keyword = ''
  handleReset()
}

function handleSortChange(sort: { prop: string; order: string }) {
  const params: Record<string, any> = {}
  if (sort.prop && sort.order) {
    params.sortBy = sort.prop
    params.sortOrder = sort.order === 'ascending' ? 'ASC' : 'DESC'
  }
  handleSearch({ ...searchForm, ...params })
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')
}
</script>

<template>
  <PageList :title="t('pages.roles.title')">
    <template #headerExtra>
      <el-button
        v-permission="'system:role_manage'"
        type="primary"
        :icon="Plus"
        @click="handleAdd"
      >
        {{ t('common.create') }}
      </el-button>
    </template>

    <template #search>
      <el-form :model="searchForm" inline>
        <el-form-item :label="t('common.keyword')">
          <el-input
            v-model="searchForm.keyword"
            :placeholder="t('pages.roles.keywordPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="doSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="doSearch">{{ t('common.search') }}</el-button>
          <el-button :icon="Refresh" @click="doReset">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>
    </template>

    <ProTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :actions-width="160"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #isSystem="{ row }">
        <el-tag v-if="(row as SystemRole).isSystem" type="danger" size="small">
          {{ t('common.system') }}
        </el-tag>
        <el-tag v-else type="info" size="small">{{ t('common.custom') }}</el-tag>
      </template>

      <template #permCount="{ row }">
        <el-tag size="small" round>
          {{ (row as SystemRole).permissionIds?.length ?? 0 }}
        </el-tag>
      </template>

      <template #createdAt="{ row }">
        {{ formatDate((row as SystemRole).createdAt) }}
      </template>

      <template #actions="{ row }">
        <el-button type="primary" link size="small" @click.stop="handleEdit(row)">
          {{ t('common.edit') }}
        </el-button>
        <el-button
          type="danger"
          link
          size="small"
          :disabled="(row as SystemRole).isSystem"
          @click.stop="handleDelete(row)"
        >
          {{ t('common.delete') }}
        </el-button>
      </template>
    </ProTable>

    <RoleFormDialog
      v-model="dialogVisible"
      :edit-data="editingRole"
      @saved="handleSaved"
    />
  </PageList>
</template>
