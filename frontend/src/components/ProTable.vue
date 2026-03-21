<script setup lang="ts">
import { computed } from 'vue'
import type { ProTableColumn } from '@/types/components'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ProTable' })

interface Props {
  columns: ProTableColumn[]
  data: any[]
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
  emptyText: undefined,
  actionsWidth: 160,
})
const { t } = useI18n({ useScope: 'global' })
const resolvedEmptyText = computed(() => props.emptyText || t('common.noData'))

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [pageSize: number]
  'page-change': [page: number]
  'size-change': [pageSize: number]
  'sort-change': [sort: { prop: string; order: string }]
  'selection-change': [selection: any[]]
}>()

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

function handleSelectionChange(rows: any[]) {
  emit('selection-change', rows)
}
</script>

<template>
  <div class="pro-table">
    <div v-if="$slots.toolbar" class="pro-table__toolbar">
      <slot name="toolbar" />
    </div>

    <el-table
      v-loading="loading"
      :data="data"
      :row-key="rowKey"
      :stripe="stripe"
      :border="border"
      :height="height"
      :empty-text="resolvedEmptyText"
      @sort-change="handleSortChange"
      @selection-change="handleSelectionChange"
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
      >
        <template #default="scope">
          <slot name="actions" v-bind="scope" />
        </template>
      </el-table-column>
    </el-table>

    <div v-if="showPagination && total > 0" class="pro-table__pagination">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="pageSizes"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
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
    margin-bottom: 16px;
  }

  &__pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
</style>
