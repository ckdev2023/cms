/**
 * 签证历史 CSV 导入：子集拼接与轻量解析。
 *
 * - 子集拼接规则与 `backend/src/modules/visa-case/import/visa-case-import-csv.util.ts` 一致（首行非空表头、BOM、换行、物理行号）。
 * - 列契约与 `legacy_case_ref` 长度等与 `docs/23_P1历史签证数据导入口径冻結.md`、`docs/24_P1历史签证数据导入验收与操作说明.md` §4–§5 对齐。
 */

/** docs/24 §4：全表必填列名（规范化后小写）。 */
export const VISA_CASE_IMPORT_RECORD_TYPE_COLUMN = 'record_type' as const

/** docs/24 §4：`record_type` 可取值（大小写不敏感；解析侧常规范为小写比较）。 */
export const VISA_CASE_IMPORT_RECORD_TYPES = [
  'CASE',
  'FAMILY_MEMBER',
  'FILE_PATH',
  'CASE_LOG',
] as const

export type VisaCaseImportRecordType =
  (typeof VISA_CASE_IMPORT_RECORD_TYPES)[number]

/**
 * docs/23 §4.2：`legacy_case_ref` 建议长度上限（与后端校验一致）。
 */
export const VISA_CASE_IMPORT_LEGACY_REF_MAX_LENGTH = 100

/**
 * docs/24 §5.1 最小单案件模板示例（占位符须替换为真实 `customer_code` / UUID）。
 *
 * 含 `legacy_case_ref`，与 docs/23 幂等键要求一致。
 */
export const VISA_CASE_IMPORT_TEMPLATE_MINIMAL_CSV =
  'record_type,customer_code,legacy_case_ref,case_status,is_family_case,case_type,expire_date\n' +
  'CASE,DEMO-CUST,LEG-2024-0001,IN_PROGRESS,false,技人国,2026-12-31\n'

/**
 * docs/24 §5.2 家族签宽表模板示例（单列宽表头 + 多行数据）。
 *
 * 写入顺序：同一 `legacy_case_ref` 的 `CASE` 行须先于从属行。
 */
export const VISA_CASE_IMPORT_TEMPLATE_WIDE_CSV =
  'record_type,customer_code,legacy_case_ref,is_family_case,family_link_mode,internal_primary_customer_code,case_status,case_type,expire_date,member_customer_code,member_role,is_primary,display_name_snapshot,file_path,path_type,display_name,log_type,log_content,log_next_follow_up_at\n' +
  'CASE,SVC01,FAM-001,true,INTERNAL,PRIMARY01,IN_PROGRESS,家族滞在,2026-12-31,,,,,,,,,,\n' +
  'FAMILY_MEMBER,SVC01,FAM-001,,,,,,,SPOUSE01,SPOUSE,false,配偶者表示名,,,,,,\n' +
  'FILE_PATH,SVC01,FAM-001,,,,,,,,,,,//nas/visa/FAM-001,CASE_DOCUMENT,申請書類,,,\n' +
  'CASE_LOG,SVC01,FAM-001,,,,,,,,,,,,,,FOLLOW_UP,初回ヒアリング済み,2026-04-10T10:00:00.000Z\n'

/**
 * 返回与 docs/24 §5 一致的固定模板 CSV 全文，便于下载或文档对账。
 *
 * @param variant - `minimal` 对应 §5.1；`wide` 对应 §5.2
 * @returns UTF-8 CSV 文本（以 `\n` 结尾）
 */
export function getVisaCaseImportTemplateCsv(
  variant: 'minimal' | 'wide',
): string {
  if (variant === 'minimal') {
    return VISA_CASE_IMPORT_TEMPLATE_MINIMAL_CSV
  }
  return VISA_CASE_IMPORT_TEMPLATE_WIDE_CSV
}

/**
 * 去掉 UTF-8 BOM 并统一换行符，与后端导入解析前置处理一致。
 *
 * @param text - 原始 CSV 文本
 * @returns 规范化后的文本
 */
function normalizeNewlinesAndBom(text: string): string {
  let t = text.replace(/^\uFEFF/u, '')
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return t
}

/**
 * 在双引号字段内消费当前下标字符：追加正文、`""` 译为单个 `"`，或结束引号状态。
 *
 * @param line - 不含换行符的一行文本
 * @param i - 当前字符下标
 * @param current - 当前单元格已累积内容
 * @returns 更新后的单元格片段、下一下标、是否仍在引号字段内
 */
function consumeQuotedCellChar(
  line: string,
  i: number,
  current: string,
): { value: string; nextIndex: number; inQuotes: boolean } {
  const ch = line[i]
  if (ch !== '"') {
    return { value: current + ch, nextIndex: i, inQuotes: true }
  }
  if (line[i + 1] === '"') {
    return { value: current + '"', nextIndex: i + 1, inQuotes: true }
  }
  return { value: current, nextIndex: i, inQuotes: false }
}

/**
 * 解析单行 CSV，支持双引号包裹字段及字段内转义双引号（`""`）。
 *
 * @param line - 不含换行符的一行文本
 * @returns 该行的单元格字符串数组（已 trim）
 */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (inQuotes) {
      const step = consumeQuotedCellChar(line, i, current)
      current = step.value
      inQuotes = step.inQuotes
      i = step.nextIndex
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells.map((c) => c.trim())
}

/**
 * 将表头单元格转为小写并去首尾空白，与 docs/24 §4「列名不区分大小写」一致。
 *
 * @param header - 原始表头单元格
 * @returns 规范化列名
 */
export function normalizeImportCsvHeader(header: string): string {
  return header.trim().toLowerCase()
}

/**
 * 将完整 CSV 文本解析为表头与带源文件行号的数据行；跳过全空行。与后端 `parseImportCsvWithLineNumbers` 行为一致。
 *
 * @param text - 完整 CSV 文本（建议 UTF-8）
 * @returns 规范化表头与数据行（`sourceLineNumber` 为 1-based 物理行号）
 */
export function parseImportCsvWithLineNumbers(text: string): {
  headers: string[]
  dataRows: Array<{ sourceLineNumber: number; cells: string[] }>
} {
  const normalized = normalizeNewlinesAndBom(text).trimEnd()
  if (normalized.length === 0) {
    return { headers: [], dataRows: [] }
  }

  const lines = normalized.split('\n')
  let headerIdx = 0
  while (headerIdx < lines.length && lines[headerIdx].trim() === '') {
    headerIdx += 1
  }
  if (headerIdx >= lines.length) {
    return { headers: [], dataRows: [] }
  }

  const headers = parseCsvLine(lines[headerIdx]).map((h) =>
    normalizeImportCsvHeader(h),
  )
  const dataRows: Array<{ sourceLineNumber: number; cells: string[] }> = []

  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') {
      continue
    }
    dataRows.push({
      sourceLineNumber: i + 1,
      cells: parseCsvLine(lines[i]),
    })
  }

  return { headers, dataRows }
}

/** 子集 CSV 拼接结果，含与数据行顺序一致的原始物理行号，便于提交后与全量预览勾选状态对齐。 */
export interface VisaCaseImportSubsetBuild {
  csvText: string
  /** 与 `csvText` 数据行顺序一致的原始文件 1-based 物理行号 */
  originalDataLineNumbers: number[]
}

/**
 * 从完整 CSV 中按 1-based 物理行号抽取表头与选中数据行，生成用于二次预览或提交的新 CSV。
 *
 * @param fullText - 用户上传的原始 CSV 文本
 * @param selectedPhysicalLineNumbers - 要选中的数据行物理行号（与预览 `rowNumber` 一致）
 * @returns 新 CSV 与原始行号序；无有效数据行时返回 null
 */
export function buildVisaCaseImportSubset(
  fullText: string,
  selectedPhysicalLineNumbers: ReadonlySet<number>,
): VisaCaseImportSubsetBuild | null {
  if (selectedPhysicalLineNumbers.size === 0) {
    return null
  }

  const normalized = normalizeNewlinesAndBom(fullText).trimEnd()
  if (normalized.length === 0) {
    return null
  }

  const lines = normalized.split('\n')
  let headerIdx = 0
  while (headerIdx < lines.length && lines[headerIdx].trim() === '') {
    headerIdx += 1
  }
  if (headerIdx >= lines.length) {
    return null
  }

  const headerLine = lines[headerIdx]
  const sorted = Array.from(selectedPhysicalLineNumbers).sort((a, b) => a - b)
  const body: string[] = []
  const originalDataLineNumbers: number[] = []
  for (const lineNo of sorted) {
    const idx = lineNo - 1
    if (idx >= 0 && idx < lines.length && idx !== headerIdx) {
      const line = lines[idx]
      if (line.trim() !== '') {
        body.push(line)
        originalDataLineNumbers.push(lineNo)
      }
    }
  }

  if (body.length === 0) {
    return null
  }

  return {
    csvText: [headerLine, ...body].join('\n'),
    originalDataLineNumbers,
  }
}
