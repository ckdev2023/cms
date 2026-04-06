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
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type { NoteItem, NoteQueryParams, UpdateNoteParams } from '@/types/customer'
import { useLocaleFormatter } from '@/utils/locale-format'

import CustomerNotesAntiDoubleWriteAlert from './CustomerNotesAntiDoubleWriteAlert.vue'
import CustomerNoteStructuredDetails from './CustomerNoteStructuredDetails.vue'

const props = defineProps<{
  customerId: string
}>()

defineOptions({ name: 'CustomerNotesTab' })

const { confirmDelete } = useConfirm()
const { t } = useI18n({ useScope: 'global' })
const { formatDateTime } = useLocaleFormatter()
const userStore = useUserStore()

/**
 * 复用案件日志 Tab 的 i18n 文案键，渲染客户备注表单中结构化字段标签。
 *
 * @param key - `detailViews.customer.visaCaseLogsTab` 下的子键
 * @param params - vue-i18n 插值参数
 * @returns 翻译后的展示字符串
 */
function L(key: string, params?: Record<string, unknown>): string {
  return t(`detailViews.customer.visaCaseLogsTab.${key}`, params ?? {})
}

/** 与 NoteController 一致：新建/更新需 `customer:edit`，删除需 `customer:delete` */
const canEditNote = computed(() => userStore.hasPermission(P.CUSTOMER_EDIT))
const canDeleteNote = computed(() => userStore.hasPermission(P.CUSTOMER_DELETE))

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
  submittedItems: '',
  missingItems: '',
  nextAction: '',
  nextFollowUpAt: '',
})

const formRules = computed<FormRules>(() => ({
  content: [
    { required: true, message: t('common.enterField', { field: t('detailViews.customer.notesTab.content') }), trigger: 'blur' },
    { max: 5000, message: t('validation.maxChars', { max: 5000 }), trigger: 'blur' },
  ],
  submittedItems: [{ max: 2000, message: t('validation.maxChars', { max: 2000 }), trigger: 'blur' }],
  missingItems: [{ max: 2000, message: t('validation.maxChars', { max: 2000 }), trigger: 'blur' }],
  nextAction: [{ max: 1000, message: t('validation.maxChars', { max: 1000 }), trigger: 'blur' }],
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
  if (!canEditNote.value) {return}
  editingNote.value = null
  formModel.content = ''
  formModel.noteType = NoteType.GENERAL
  formModel.submittedItems = ''
  formModel.missingItems = ''
  formModel.nextAction = ''
  formModel.nextFollowUpAt = ''
  showForm.value = true
}

/**
 * 打开备注编辑表单，并将当前备注内容回填到表单模型。
 *
 * @param note - 当前准备编辑的备注记录
 */
function openEditForm(note: NoteItem) {
  if (!canEditNote.value) {return}
  editingNote.value = note
  formModel.content = note.content
  formModel.noteType = note.noteType
  formModel.submittedItems = note.submittedItems ?? ''
  formModel.missingItems = note.missingItems ?? ''
  formModel.nextAction = note.nextAction ?? ''
  formModel.nextFollowUpAt = note.nextFollowUpAt
    ? note.nextFollowUpAt.slice(0, 16)
    : ''
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
  if (!canEditNote.value) {return}
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {return}

  submitting.value = true
  try {
    if (isEdit.value && editingNote.value) {
      const body: UpdateNoteParams = {
        content: formModel.content,
        noteType: formModel.noteType,
        submittedItems: formModel.submittedItems,
        missingItems: formModel.missingItems,
        nextAction: formModel.nextAction,
        nextFollowUpAt: formModel.nextFollowUpAt
          ? new Date(formModel.nextFollowUpAt).toISOString()
          : null,
      }
      await updateNote(props.customerId, editingNote.value.id, body)
      ElMessage.success(t('detailViews.customer.notesTab.updatedSuccess'))
    } else {
      await createNote(props.customerId, {
        content: formModel.content,
        noteType: formModel.noteType,
        submittedItems: formModel.submittedItems || undefined,
        missingItems: formModel.missingItems || undefined,
        nextAction: formModel.nextAction || undefined,
        nextFollowUpAt: formModel.nextFollowUpAt
          ? new Date(formModel.nextFollowUpAt).toISOString()
          : undefined,
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
  if (!canDeleteNote.value) {return}
  const confirmed = await confirmDelete(t('detailViews.customer.notesTab.noteDeleteName'))
  if (!confirmed) {return}

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
    <CustomerNotesAntiDoubleWriteAlert />

    <div
      class="notes-tab__layout"
      :class="{ 'notes-tab__layout--with-form': showForm && canEditNote }"
    >
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
        <el-button v-if="canEditNote" type="primary" @click="openCreateForm">
          {{ t('detailViews.customer.notesTab.add') }}
        </el-button>
      </div>

      <el-card
        v-if="showForm && canEditNote"
        shadow="never"
        class="notes-tab__form-card notes-tab__form-pane"
      >
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

          <el-divider content-position="left">
            {{ t('detailViews.customer.notesTab.structuredSectionTitle') }}
          </el-divider>
          <el-form-item :label="L('submittedItems')" prop="submittedItems">
            <el-input
              v-model="formModel.submittedItems"
              type="textarea"
              :rows="2"
              :placeholder="L('submittedItemsPlaceholder')"
              maxlength="2000"
              show-word-limit
            />
          </el-form-item>
          <el-form-item :label="L('missingItems')" prop="missingItems">
            <el-input
              v-model="formModel.missingItems"
              type="textarea"
              :rows="2"
              :placeholder="L('missingItemsPlaceholder')"
              maxlength="2000"
              show-word-limit
            />
          </el-form-item>
          <el-form-item :label="L('nextAction')" prop="nextAction">
            <el-input
              v-model="formModel.nextAction"
              :placeholder="L('nextActionPlaceholder')"
              maxlength="1000"
              show-word-limit
            />
          </el-form-item>
          <el-form-item :label="L('nextFollowUpAt')" prop="nextFollowUpAt">
            <el-date-picker
              v-model="formModel.nextFollowUpAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm"
              style="width: 100%"
              clearable
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
                <div v-if="canEditNote || canDeleteNote" class="notes-tab__note-actions">
                  <el-button
                    v-if="canEditNote"
                    :icon="Edit"
                    size="small"
                    text
                    type="primary"
                    @click="openEditForm(note)"
                  >
                    {{ t('common.edit') }}
                  </el-button>
                  <el-button
                    v-if="canDeleteNote"
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
              <CustomerNoteStructuredDetails
                :submitted-items="note.submittedItems"
                :missing-items="note.missingItems"
                :next-action="note.nextAction"
                :next-follow-up-at="note.nextFollowUpAt"
              />
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
  </div>
</template>

<style scoped lang="scss">
.notes-tab {
  /**
   * 窄屏：工具栏 → 表单（若有）→ 时间线与分页（与历史纵向堆叠一致）。
   * 宽屏（≥1200px，与客户详情壳层断点一致）：左列筛选 + 时间线，右列表单卡片；DOM/数据流不变。
   */
  &__layout {
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "toolbar"
      "form"
      "timeline";

    @media (min-width: 1200px) {
      &:not(.notes-tab__layout--with-form) {
        grid-template-areas:
          "toolbar"
          "timeline";
      }

      &--with-form {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        grid-template-rows: auto minmax(0, 1fr);
        grid-template-areas:
          "toolbar form"
          "timeline form";
        align-items: start;
      }

      &--with-form .notes-tab__timeline {
        min-height: 0;
        max-height: calc(100dvh - 14rem);
        max-height: calc(100vh - 14rem);
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior-y: contain;
      }

      &--with-form .notes-tab__form-pane {
        position: sticky;
        top: var(--app-spacing-md);
        align-self: start;
        min-width: 0;
        max-height: calc(100dvh - 14rem);
        max-height: calc(100vh - 14rem);
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior-y: contain;
      }
    }
  }

  &__toolbar {
    grid-area: toolbar;
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  &__form-pane {
    grid-area: form;
  }

  &__timeline {
    grid-area: timeline;
    min-width: 0;
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
