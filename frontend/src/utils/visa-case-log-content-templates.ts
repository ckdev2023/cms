/** 案件日志「常用句式」下拉项（与 i18n `contentTemplates` 条目结构一致） */
export interface VisaCaseLogContentTemplate {
  label: string
  text: string
}

/**
 * 将 vue-i18n `tm()` 返回的原始消息规范为可用的模板列表，过滤缺字段项。
 *
 * @param raw - `tm('...contentTemplates')` 的返回值
 * @returns 含非空 label 与 text 的模板数组
 */
export function normalizeVisaCaseLogContentTemplates(raw: unknown): VisaCaseLogContentTemplate[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: VisaCaseLogContentTemplate[] = []
  for (const item of raw) {
    if (item === null || typeof item !== 'object') {
      continue
    }
    const rec = item as Record<string, unknown>
    const label = typeof rec.label === 'string' ? rec.label.trim() : ''
    const text = typeof rec.text === 'string' ? rec.text.trim() : ''
    if (label && text) {
      out.push({ label, text })
    }
  }
  return out
}
