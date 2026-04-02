<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ProTableColumn } from '@/types/components'

type TableRow = object

interface Props {
  columns: ProTableColumn[]
  data: TableRow[]
  loading?: boolean
  total?: number
  page?: number
  pageSize?: number
  pageSizes?: number[]
  showPagination?: boolean
  showIndex?: boolean
  showSelection?: boolean
  rowKey?: string
  stripe?: boolean
  border?: boolean
  height?: string | number
  emptyText?: string
  actionsWidth?: number | string
  rowClickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  total: 0,
  page: 1,
  pageSize: 20,
  pageSizes: () => [10, 20, 50, 100],
  showPagination: true,
  showIndex: false,
  showSelection: false,
  rowKey: 'id',
  stripe: true,
  border: false,
  height: undefined,
  emptyText: undefined,
  actionsWidth: 160,
  rowClickable: false,
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [pageSize: number]
  'page-change': [page: number]
  'size-change': [pageSize: number]
  'sort-change': [sort: { prop: string; order: string }]
  'selection-change': [selection: TableRow[]]
  'row-click': [row: TableRow]
}>()

defineOptions({ name: 'ProTable' })

const { t } = useI18n({ useScope: 'global' })
const resolvedEmptyText = computed(() => props.emptyText || t('common.noData'))

function handleCurrentChange(val: number) {
  emit('update:page', val)
  emit('page-change', val)
}

function handleSizeChange(val: number) {
  emit('update:pageSize', val)
  emit('size-change', val)
}

function handleSortChange(sort: { prop: string; order: string }) {
  emit('sort-change', sort)
}

function handleSelectionChange(rows: TableRow[]) {
  emit('selection-change', rows)
}

function handleRowClick(row: TableRow) {
  if (props.rowClickable) {
    emit('row-click', row)
  }
}

function rowClassName(): string {
  return props.rowClickable ? 'pro-table__row--clickable' : ''
}
</script>

<template>
  <div class="pro-table">
    <div v-if="$slots.toolbar" class="pro-table__toolbar">
      <slot name="toolbar" />
    </div>

    <div class="pro-table__table-wrap">
      <el-table
        v-loading="loading"
        :data="data"
        :row-key="rowKey"
        :stripe="stripe"
        :border="border"
        :height="height"
        :row-class-name="rowClassName"
        @sort-change="handleSortChange"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
      >
        <el-table-column
          v-if="showSelection"
          type="selection"
          width="50"
          align="center"
        />
        <el-table-column
          v-if="showIndex"
          type="index"
          label="#"
          width="60"
          align="center"
        />

        <el-table-column
          v-for="col in columns"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth"
          :fixed="col.fixed"
          :sortable="col.sortable"
          :align="col.align || 'left'"
          :show-overflow-tooltip="col.showOverflowTooltip !== false"
        >
          <template v-if="col.slot" #default="scope">
            <slot :name="col.slot" v-bind="scope" />
          </template>
        </el-table-column>

        <el-table-column
          v-if="$slots.actions"
          :label="t('common.actions')"
          fixed="right"
          align="center"
          :width="actionsWidth"
          class-name="pro-table__actions-cell"
        >
          <template #default="scope">
            <div class="pro-table__actions">
              <slot name="actions" v-bind="scope" />
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <slot name="empty">
            <el-empty :description="resolvedEmptyText" :image-size="80" />
          </slot>
        </template>
      </el-table>
    </div>

    <div v-if="showPagination && total > 0" class="pro-table__pagination">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="pageSizes"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="handleCurrentChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.pro-table {
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--app-spacing-md);
    margin-bottom: var(--app-spacing-base);
  }

  &__table-wrap {
    border: 1px solid var(--app-border-color-light);
    border-radius: var(--app-radius-md);
    overflow: hidden;

    :deep(.el-table) {
      --el-table-border-color: var(--app-border-color-light);

      &::before,
      &::after {
        display: none;
      }
    }

    :deep(.el-table__inner-wrapper::before) {
      display: none;
    }

    :deep(th.el-table__cell) {
      background-color: var(--app-bg-page);
      font-weight: var(--app-font-weight-semibold);
      font-size: var(--app-font-size-sm);
      color: var(--app-text-secondary);
    }

    :deep(.el-table__empty-block) {
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :deep(.pro-table__row--clickable) {
      cursor: pointer;

      &:hover td.el-table__cell {
        color: var(--app-text-primary);
      }
    }
  }

  &__actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--app-spacing-sm);

    :deep(.el-button + .el-button) {
      margin-left: 0;
    }
  }

  :deep(.el-tag) {
    border-radius: var(--app-radius-round);
  }

  &__pagination {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding-top: var(--app-spacing-base);
    margin-top: var(--app-spacing-xs);
  }
}
</style>
