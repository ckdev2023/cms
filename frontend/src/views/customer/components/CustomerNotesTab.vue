<script setup lang="ts">
import { ChatLineSquare, Delete, Edit } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createNote, deleteNote, getNotes, updateNote } from '@/api/customer'
import { useConfirm } from '@/composables/useConfirm'
import { NoteTypeLabel } from '@/constants/enum-labels'
import { NoteType } from '@/constants/enums'
import type { NoteItem, NoteQueryParams } from '@/types/customer'
import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  customerId: string
}>()

defineOptions({ name: 'CustomerNotesTab' })

const { confirmDelete } = useConfirm()
const { t } = useI18n({ useScope: 'global' })
const { formatDateTime } = useLocaleFormatter()

const loading = ref(false)
const notes = ref<NoteItem[]>([])
const total = ref(0)
const queryParams = reactive<NoteQueryParams>({
  page: 1,
  pageSize: 20,
  noteType: undefined,
  sortOrder: 'DESC',
})

const formRef = ref<FormInstance>()
const submitting = ref(false)
const editingNote = ref<NoteItem | null>(null)
const showForm = ref(false)

const formModel = reactive({
  content: '',
  noteType: NoteType.GENERAL,
})

const formRules = computed<FormRules>(() => ({
  content: [
    { required: true, message: t('common.enterField', { field: t('detailViews.customer.notesTab.content') }), trigger: 'blur' },
    { max: 5000, message: t('validation.maxChars', { max: 5000 }), trigger: 'blur' },
  ],
}))

const isEdit = computed(() => !!editingNote.value)

const noteTypeOptions = computed(() => Object.entries(NoteTypeLabel).map(([value, label]) => ({
  value,
  label,
})))

const noteTypeTagType: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
  [NoteType.FOLLOW_UP]: 'warning',
  [NoteType.MEMO]: 'info',
  [NoteType.GENERAL]: 'primary',
}

const filterNoteTypeOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...noteTypeOptions.value,
])

watch(() => props.customerId, () => {
  if (props.customerId) {
    queryParams.page = 1
    fetchNotes()
  }
}, { immediate: true })

/**
 * 按当前分页与筛选条件加载客户备注时间线。
 *
 * @throws {Error} 备注列表接口请求失败时由请求层继续抛出
 */
async function fetchNotes() {
  loading.value = true
  try {
    const res = await getNotes(props.customerId, queryParams)
    notes.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function handleFilterChange(noteType: string) {
  queryParams.noteType = noteType ? (noteType as NoteType) : undefined
  queryParams.page = 1
  fetchNotes()
}

function handlePageChange(page: number) {
  queryParams.page = page
  fetchNotes()
}

/**
 * 打开新增备注表单，并重置编辑态与默认备注类型。
 */
function openCreateForm() {
  editingNote.value = null
  formModel.content = ''
  formModel.noteType = NoteType.GENERAL
  showForm.value = true
}

/**
 * 打开备注编辑表单，并将当前备注内容回填到表单模型。
 *
 * @param note - 当前准备编辑的备注记录
 */
function openEditForm(note: NoteItem) {
  editingNote.value = note
  formModel.content = note.content
  formModel.noteType = note.noteType
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingNote.value = null
  formRef.value?.resetFields()
}

/**
 * 校验备注表单并提交新增或编辑请求。
 *
 * 保存成功后会重置编辑态，并回到第一页重新加载最新备注列表。
 *
 * @throws {Error} 备注保存请求失败时由请求层统一提示并继续抛出
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (isEdit.value && editingNote.value) {
      await updateNote(props.customerId, editingNote.value.id, {
        content: formModel.content,
        noteType: formModel.noteType,
      })
      ElMessage.success(t('detailViews.customer.notesTab.updatedSuccess'))
    } else {
      await createNote(props.customerId, {
        content: formModel.content,
        noteType: formModel.noteType,
      })
      ElMessage.success(t('detailViews.customer.notesTab.createdSuccess'))
    }
    cancelForm()
    queryParams.page = 1
    fetchNotes()
  } catch {
    // request interceptor handles the error
  } finally {
    submitting.value = false
  }
}

/**
 * 删除指定客户备注，并在成功后刷新时间线数据。
 *
 * @param note - 当前准备删除的备注记录
 * @throws {Error} 备注删除请求失败时由请求层统一提示并继续抛出
 */
async function handleDelete(note: NoteItem) {
  const confirmed = await confirmDelete(t('detailViews.customer.notesTab.noteDeleteName'))
  if (!confirmed) return

  try {
    await deleteNote(props.customerId, note.id)
    ElMessage.success(t('detailViews.customer.notesTab.deletedSuccess'))
    fetchNotes()
  } catch {
    // request interceptor handles the error
  }
}

</script>

<template>
  <div class="notes-tab">
    <div class="notes-tab__toolbar">
      <div class="notes-tab__filter">
        <el-select
          :model-value="queryParams.noteType ?? ''"
          :placeholder="t('detailViews.customer.notesTab.filterPlaceholder')"
          size="default"
          style="width: 160px"
          @change="handleFilterChange"
        >
          <el-option
            v-for="opt in filterNoteTypeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <span class="notes-tab__count">{{ t('detailViews.customer.notesTab.countLabel', { count: total }) }}</span>
      </div>
      <el-button type="primary" @click="openCreateForm">
        {{ t('detailViews.customer.notesTab.add') }}
      </el-button>
    </div>

    <el-card v-if="showForm" shadow="never" class="notes-tab__form-card">
      <template #header>
        <span>{{ isEdit ? t('detailViews.customer.notesTab.editTitle') : t('detailViews.customer.notesTab.createTitle') }}</span>
      </template>
      <el-form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        label-width="100px"
        label-position="top"
      >
        <el-form-item :label="t('detailViews.customer.notesTab.noteType')" prop="noteType">
          <el-radio-group v-model="formModel.noteType">
            <el-radio-button
              v-for="opt in noteTypeOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('detailViews.customer.notesTab.content')" prop="content">
          <el-input
            v-model="formModel.content"
            type="textarea"
            :rows="4"
            :placeholder="t('detailViews.customer.notesTab.contentPlaceholder')"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
        <div class="notes-tab__form-actions">
          <el-button @click="cancelForm">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ isEdit ? t('common.update') : t('common.create') }}
          </el-button>
        </div>
      </el-form>
    </el-card>

    <div v-loading="loading" class="notes-tab__timeline">
      <el-empty v-if="!loading && notes.length === 0" :description="t('detailViews.customer.notesTab.empty')" />

      <el-timeline v-else>
        <el-timeline-item
          v-for="note in notes"
          :key="note.id"
          :timestamp="formatDateTime(note.createdAt)"
          placement="top"
        >
          <el-card shadow="hover" class="notes-tab__note-card">
            <div class="notes-tab__note-header">
              <div class="notes-tab__note-meta">
                <el-tag
                  size="small"
                  :type="noteTypeTagType[note.noteType] ?? undefined"
                >
                  {{ NoteTypeLabel[note.noteType as NoteType] }}
                </el-tag>
                <span v-if="note.creatorName" class="notes-tab__note-author">
                  <el-icon><ChatLineSquare /></el-icon>
                  {{ note.creatorName }}
                </span>
              </div>
              <div class="notes-tab__note-actions">
                <el-button
                  :icon="Edit"
                  size="small"
                  text
                  type="primary"
                  @click="openEditForm(note)"
                >
                  {{ t('common.edit') }}
                </el-button>
                <el-button
                  :icon="Delete"
                  size="small"
                  text
                  type="danger"
                  @click="handleDelete(note)"
                >
                  {{ t('common.delete') }}
                </el-button>
              </div>
            </div>
            <div class="notes-tab__note-content">{{ note.content }}</div>
            <div v-if="note.updatedAt !== note.createdAt" class="notes-tab__note-updated">
              {{ t('detailViews.customer.notesTab.updatedAt') }}: {{ formatDateTime(note.updatedAt) }}
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>

      <div v-if="total > queryParams.pageSize!" class="notes-tab__pagination">
        <el-pagination
          :current-page="queryParams.page"
          :page-size="queryParams.pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.notes-tab {
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  &__filter {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__count {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
  }

  &__form-card {
    margin-bottom: 20px;
  }

  &__form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  &__note-card {
    :deep(.el-card__body) {
      padding: 12px 16px;
    }
  }

  &__note-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__note-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__note-author {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__note-actions {
    display: flex;
    gap: 4px;
  }

  &__note-content {
    font-size: var(--app-font-size-base);
    line-height: 1.6;
    color: var(--app-text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__note-updated {
    margin-top: var(--app-spacing-sm);
    font-size: var(--app-font-size-xs);
    color: var(--app-text-disabled);
  }

  &__pagination {
    display: flex;
    justify-content: center;
    margin-top: 16px;
  }
}
</style>
