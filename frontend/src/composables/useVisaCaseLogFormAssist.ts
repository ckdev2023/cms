import { computed, type ComputedRef, type Ref } from 'vue'

import type { VisaCaseLogItem } from '@/types/visa-case'
import { appendTextBlock } from '@/utils/append-text-block'
import {
  normalizeVisaCaseLogContentTemplates,
  type VisaCaseLogContentTemplate,
} from '@/utils/visa-case-log-content-templates'
import {
  pickVisaCaseLogForMissingItemsReuse,
  type VisaCaseLogMissingReuseCandidate,
} from '@/utils/visa-case-log-missing-reuse'

/** 案件日志表单中与模板/复用相关的可写字段子集 */
export interface VisaCaseLogFormAssistFields {
  content: string
  missingItems: string
}

/** vue-i18n `tm` 读取结构化消息的调用签名 */
export type VisaCaseLogFormAssistTm = (key: string) => unknown

/**
 * 提供案件日志表单的常用句式列表、缺件复用来源及插入/覆盖操作。
 *
 * @param tm - vue-i18n 的 `tm`，用于读取 `contentTemplates` 数组消息
 * @param logs - 当前案件已加载的日志时间线（新→旧）
 * @param editingLog - 编辑中的日志；新建时为 null
 * @param formModel - 表单模型中待写入的字段引用
 * @returns 模板列表、复用来源与两个操作方法
 */
export function useVisaCaseLogFormAssist(
  tm: VisaCaseLogFormAssistTm,
  logs: Ref<VisaCaseLogItem[]>,
  editingLog: Ref<VisaCaseLogItem | null>,
  formModel: VisaCaseLogFormAssistFields,
): {
  contentTemplates: ComputedRef<VisaCaseLogContentTemplate[]>
  logSourceForReuseMissing: ComputedRef<VisaCaseLogMissingReuseCandidate | null>
  insertContentSnippet: (command: unknown) => void
  applyReuseMissing: () => void
} {
  const contentTemplates = computed(() =>
    normalizeVisaCaseLogContentTemplates(tm('detailViews.customer.visaCaseLogsTab.contentTemplates')),
  )

  const logSourceForReuseMissing = computed(() =>
    pickVisaCaseLogForMissingItemsReuse(logs.value, editingLog.value?.id),
  )

  /**
   * 将选定的常用句式追加到日志正文末尾（段间插入空行）。
   *
   * @param command - 下拉项绑定的正文文本
   */
  function insertContentSnippet(command: unknown): void {
    const text = typeof command === 'string' ? command : String(command ?? '')
    if (!text.trim()) {
      return
    }
    formModel.content = appendTextBlock(formModel.content, text)
  }

  /**
   * 用时间线中可选来源的「缺失材料」覆盖当前表单该字段。
   */
  function applyReuseMissing(): void {
    const src = logSourceForReuseMissing.value
    const block = src?.missingItems?.trim()
    if (!block) {
      return
    }
    formModel.missingItems = block
  }

  return {
    contentTemplates,
    logSourceForReuseMissing,
    insertContentSnippet,
    applyReuseMissing,
  }
}
