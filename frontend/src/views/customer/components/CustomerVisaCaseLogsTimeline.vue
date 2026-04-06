<script setup lang="ts">
import { ChatLineSquare, Delete, Edit } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

import { VisaCaseLogTypeLabel } from '@/constants/enum-labels'
import { VisaCaseLogType } from '@/constants/enums'
import { resolveVisaCaseLogTimelineVisualTone } from '@/constants/visa-case-log-ui'
import type { VisaCaseLogItem } from '@/types/visa-case'

const props = defineProps<{
  loading: boolean
  logs: VisaCaseLogItem[]
  total: number
  page: number
  pageSize: number
  formatDateTime: (value: string) => string
  canEdit: boolean
  canDelete: boolean
}>()

const emit = defineEmits<{
  edit: [log: VisaCaseLogItem]
  delete: [log: VisaCaseLogItem]
  'page-change': [page: number]
}>()

defineOptions({ name: 'CustomerVisaCaseLogsTimeline' })

const { t } = useI18n({ useScope: 'global' })
const T = (key: string, params?: Record<string, unknown>) => t(`detailViews.customer.visaCaseLogsTab.${key}`, params ?? {})
</script>

<template>
  <div v-loading="props.loading" class="case-logs-tab__timeline">
    <el-empty v-if="!props.loading && props.logs.length === 0" :description="T('empty')" />
    <el-timeline v-else>
      <el-timeline-item
        v-for="log in props.logs"
        :key="log.id"
        :timestamp="props.formatDateTime(log.createdAt)"
        placement="top"
        :type="resolveVisaCaseLogTimelineVisualTone(log.logType)"
      >
        <el-card
          shadow="never"
          :class="[
            'case-logs-tab__log-card',
            `visa-case-log-timeline-tone--${resolveVisaCaseLogTimelineVisualTone(log.logType)}`,
          ]"
        >
          <div class="case-logs-tab__log-header">
            <div class="case-logs-tab__log-meta">
              <el-tag size="small" :type="resolveVisaCaseLogTimelineVisualTone(log.logType)">
                {{ VisaCaseLogTypeLabel[log.logType as VisaCaseLogType] }}
              </el-tag>
              <span v-if="log.creatorName" class="case-logs-tab__log-author">
                <el-icon><ChatLineSquare /></el-icon> {{ log.creatorName }}
              </span>
            </div>
            <div class="case-logs-tab__log-actions">
              <el-button v-if="props.canEdit" :icon="Edit" size="small" text type="primary" @click="emit('edit', log)">{{ t('common.edit') }}</el-button>
              <el-button v-if="props.canDelete" :icon="Delete" size="small" text type="danger" @click="emit('delete', log)">{{ t('common.delete') }}</el-button>
            </div>
          </div>
          <div class="case-logs-tab__log-content">{{ log.content }}</div>
          <div v-if="log.submittedItems || log.missingItems || log.nextAction || log.nextFollowUpAt" class="case-logs-tab__log-details">
            <div v-if="log.submittedItems" class="case-logs-tab__detail-row">
              <span class="case-logs-tab__detail-label">{{ T('submittedItems') }}:</span>
              <span class="case-logs-tab__detail-value">{{ log.submittedItems }}</span>
            </div>
            <div v-if="log.missingItems" class="case-logs-tab__detail-row">
              <span class="case-logs-tab__detail-label case-logs-tab__detail-label--warning">{{ T('missingItems') }}:</span>
              <span class="case-logs-tab__detail-value">{{ log.missingItems }}</span>
            </div>
            <div v-if="log.nextAction" class="case-logs-tab__detail-row">
              <span class="case-logs-tab__detail-label">{{ T('nextAction') }}:</span>
              <span class="case-logs-tab__detail-value">{{ log.nextAction }}</span>
            </div>
            <div v-if="log.nextFollowUpAt" class="case-logs-tab__detail-row">
              <span class="case-logs-tab__detail-label">{{ T('nextFollowUpAt') }}:</span>
              <span class="case-logs-tab__detail-value">{{ props.formatDateTime(log.nextFollowUpAt) }}</span>
            </div>
          </div>
          <div v-if="log.updatedAt !== log.createdAt" class="case-logs-tab__log-updated">
            {{ T('updatedAt') }}: {{ props.formatDateTime(log.updatedAt) }}
          </div>
        </el-card>
      </el-timeline-item>
    </el-timeline>
    <div v-if="props.total > props.pageSize" class="case-logs-tab__pagination">
      <el-pagination
        :current-page="props.page"
        :page-size="props.pageSize"
        :total="props.total"
        layout="prev, pager, next"
        @current-change="(p: number) => emit('page-change', p)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss" src="./CustomerVisaCaseLogsTimeline.scoped.scss"></style>
