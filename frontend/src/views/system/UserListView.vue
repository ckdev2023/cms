<script setup lang="ts">
import { Key, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { deleteUser, getUsers, toggleUserStatus } from '@/api/system'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useProTable } from '@/composables/useProTable'
import { UserStatusLabel } from '@/constants/enum-labels'
import { UserStatus } from '@/constants/enums'
import { useAppStore } from '@/stores/app'
import type { ProTableColumn } from '@/types/components'
import type { SystemUser, UserQueryParams } from '@/types/system'

import ResetPasswordDialog from './components/ResetPasswordDialog.vue'
import UserFormDialog from './components/UserFormDialog.vue'

defineOptions({ name: 'UserListView' })

const { confirmDelete, confirm } = useConfirm()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'username', label: t('pages.users.username'), width: 140, sortable: 'custom' },
  { prop: 'displayName', label: t('pages.users.displayName'), minWidth: 140, sortable: 'custom' },
  { prop: 'email', label: t('common.email'), minWidth: 180 },
  { prop: 'phone', label: t('pages.users.phone'), width: 140 },
  { prop: 'roles', label: t('pages.users.roles'), minWidth: 160, slot: 'roles' },
  { prop: 'status', label: t('common.status'), width: 100, slot: 'status', align: 'center' },
  { prop: 'createdAt', label: t('pages.users.createdAt'), width: 110, slot: 'createdAt', sortable: 'custom' },
])

const searchForm = reactive<UserQueryParams>({
  keyword: '',
  status: undefined,
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
} = useProTable<SystemUser>(getUsers)

const dialogVisible = ref(false)
const editingUser = ref<SystemUser | null>(null)
const resetPwdDialogVisible = ref(false)
const resetPwdUser = ref<SystemUser | null>(null)

function handleAdd() {
  editingUser.value = null
  dialogVisible.value = true
}

function handleEdit(row: SystemUser) {
  editingUser.value = row
  dialogVisible.value = true
}

function handleResetPassword(row: SystemUser) {
  resetPwdUser.value = row
  resetPwdDialogVisible.value = true
}

/**
 * 切换系统用户启用状态，并在成功后刷新用户列表。
 *
 * @param row - 当前选中的用户记录
 * @returns 无返回值
 */
async function handleToggleStatus(row: SystemUser) {
  const action =
    row.status === UserStatus.ACTIVE ? t('pages.users.disableAction') : t('pages.users.enableAction')
  const ok = await confirm({
    title: t('pages.users.toggleStatusTitle'),
    message: t('pages.users.toggleStatusMessage', { name: row.displayName, action }),
  })
  if (!ok) return

  try {
    await toggleUserStatus(row.id)
    ElMessage.success(t('pages.users.toggleStatusSuccess', { action }))
    fetchData()
  } catch {
    // handled by interceptor
  }
}

/**
 * 删除指定系统用户，并在成功后刷新用户列表。
 *
 * @param row - 当前选中的用户记录
 * @returns 无返回值
 */
async function handleDelete(row: SystemUser) {
  const ok = await confirmDelete(row.displayName)
  if (!ok) return

  try {
    await deleteUser(row.id)
    ElMessage.success(t('pages.users.deleteSuccess'))
    fetchData()
  } catch {
    // handled by interceptor
  }
}

function handleSaved() {
  fetchData()
}

/**
 * 汇总筛选表单条件，触发用户列表检索。
 *
 * @returns 无返回值
 */
function doSearch() {
  const params: Record<string, unknown> = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  if (searchForm.status) params.status = searchForm.status
  handleSearch(params)
}

function doReset() {
  searchForm.keyword = ''
  searchForm.status = undefined
  handleReset()
}

/**
 * 根据表格排序事件同步用户列表的排序字段。
 *
 * @param sort - 当前表格返回的排序字段与方向
 * @param sort.prop - 后端排序使用的字段名
 * @param sort.order - Element Plus 返回的排序方向
 * @returns 无返回值
 */
function handleSortChange(sort: { prop: string; order: string }) {
  const params: Record<string, unknown> = {}
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

const statusTagType: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  [UserStatus.ACTIVE]: 'success',
  [UserStatus.INACTIVE]: 'info',
}
</script>

<template>
  <PageList :title="t('pages.users.title')">
    <template #headerExtra>
      <el-button
        v-permission="'system:user_manage'"
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
            :placeholder="t('pages.users.keywordPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="doSearch"
          />
        </el-form-item>
        <el-form-item :label="t('common.status')">
          <el-select
            v-model="searchForm.status"
            :placeholder="t('common.all')"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="(label, value) in UserStatusLabel"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" :loading="loading" @click="doSearch">{{ t('common.search') }}</el-button>
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
      :actions-width="280"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #roles="{ row }">
        <el-tag
          v-for="role in (row as SystemUser).roles"
          :key="role.roleCode"
          size="small"
          class="role-tag"
        >
          {{ role.roleName }}
        </el-tag>
          <span v-if="!(row as SystemUser).roles?.length" class="text-placeholder">{{ t('common.unassigned') }}</span>
      </template>

      <template #status="{ row }">
        <el-tag :type="statusTagType[(row as SystemUser).status]" size="small">
          {{ UserStatusLabel[(row as SystemUser).status] }}
        </el-tag>
      </template>

      <template #createdAt="{ row }">
        {{ formatDate((row as SystemUser).createdAt) }}
      </template>

      <template #actions="{ row }">
        <el-button type="primary" link size="small" @click.stop="handleEdit(row)">
          {{ t('common.edit') }}
        </el-button>
        <el-button type="warning" link size="small" :icon="Key" @click.stop="handleResetPassword(row)">
          {{ t('pages.users.resetPasswordShort') }}
        </el-button>
        <el-button
          :type="(row as SystemUser).status === UserStatus.ACTIVE ? 'warning' : 'success'"
          link
          size="small"
          @click.stop="handleToggleStatus(row)"
        >
          {{ (row as SystemUser).status === UserStatus.ACTIVE ? t('pages.users.disableAction') : t('pages.users.enableAction') }}
        </el-button>
        <el-button type="danger" link size="small" @click.stop="handleDelete(row)">
          {{ t('common.delete') }}
        </el-button>
      </template>
    </ProTable>

    <UserFormDialog
      v-model="dialogVisible"
      :edit-data="editingUser"
      @saved="handleSaved"
    />

    <ResetPasswordDialog
      v-model="resetPwdDialogVisible"
      :user="resetPwdUser"
    />
  </PageList>
</template>

<style scoped lang="scss">
.role-tag + .role-tag {
  margin-left: var(--app-spacing-xs);
}
</style>
