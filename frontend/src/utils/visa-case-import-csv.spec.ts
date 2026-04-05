import { describe, expect, it } from 'vitest'

import {
  buildVisaCaseImportSubset,
  getVisaCaseImportTemplateCsv,
  normalizeImportCsvHeader,
  parseCsvLine,
  parseImportCsvWithLineNumbers,
  VISA_CASE_IMPORT_LEGACY_REF_MAX_LENGTH,
  VISA_CASE_IMPORT_RECORD_TYPE_COLUMN,
  VISA_CASE_IMPORT_RECORD_TYPES,
  VISA_CASE_IMPORT_TEMPLATE_MINIMAL_CSV,
  VISA_CASE_IMPORT_TEMPLATE_WIDE_CSV,
} from './visa-case-import-csv'

describe('docs/23–24 模板列契约', () => {
  it('exposes legacy_case_ref 长度上限与冻結文档 §4.2 一致', () => {
    expect(VISA_CASE_IMPORT_LEGACY_REF_MAX_LENGTH).toBe(100)
  })

  it(' minimal 模板表头含 record_type、服务客户与 legacy_case_ref（docs/24 §5.1）', () => {
    const { headers } = parseImportCsvWithLineNumbers(
      VISA_CASE_IMPORT_TEMPLATE_MINIMAL_CSV,
    )
    expect(headers).toContain(VISA_CASE_IMPORT_RECORD_TYPE_COLUMN)
    expect(headers).toContain('customer_code')
    expect(headers).toContain('legacy_case_ref')
    expect(headers).toContain('case_status')
    expect(headers).toContain('is_family_case')
    expect(headers).toContain('case_type')
    expect(headers).toContain('expire_date')
  })

  it(' wide 模板表头覆盖 §5.2 家族签、家属、路径、日志列', () => {
    const { headers, dataRows } = parseImportCsvWithLineNumbers(
      VISA_CASE_IMPORT_TEMPLATE_WIDE_CSV,
    )
    expect(dataRows).toHaveLength(4)
    for (const col of [
      'record_type',
      'customer_code',
      'legacy_case_ref',
      'is_family_case',
      'family_link_mode',
      'internal_primary_customer_code',
      'member_customer_code',
      'member_role',
      'is_primary',
      'display_name_snapshot',
      'file_path',
      'path_type',
      'display_name',
      'log_type',
      'log_content',
      'log_next_follow_up_at',
    ]) {
      expect(headers).toContain(col)
    }
  })

  it(' record_type 取值集合与 docs/24 §4 四种类型一致', () => {
    expect(new Set(VISA_CASE_IMPORT_RECORD_TYPES)).toEqual(
      new Set(['CASE', 'FAMILY_MEMBER', 'FILE_PATH', 'CASE_LOG']),
    )
  })

  it(' getVisaCaseImportTemplateCsv 与导出的常量文本一致', () => {
    expect(getVisaCaseImportTemplateCsv('minimal')).toBe(
      VISA_CASE_IMPORT_TEMPLATE_MINIMAL_CSV,
    )
    expect(getVisaCaseImportTemplateCsv('wide')).toBe(
      VISA_CASE_IMPORT_TEMPLATE_WIDE_CSV,
    )
  })
})

describe('parseCsvLine（与后端 visa-case-import-csv.util 对齐）', () => {
  it('handles quoted commas', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
  })

  it('handles escaped quotes', () => {
    expect(parseCsvLine('"say ""hi""",x')).toEqual(['say "hi"', 'x'])
  })
})

describe('normalizeImportCsvHeader', () => {
  it('lowercases trimmed header cells', () => {
    expect(normalizeImportCsvHeader(' Record_Type ')).toBe('record_type')
  })
})

describe('parseImportCsvWithLineNumbers', () => {
  it('preserves physical line numbers after leading blanks', () => {
    const text = '\nrecord_type,customer_id\n\nCASE,\n'
    const { headers, dataRows } = parseImportCsvWithLineNumbers(text)
    expect(headers).toEqual(['record_type', 'customer_id'])
    expect(dataRows).toHaveLength(1)
    expect(dataRows[0].sourceLineNumber).toBe(4)
    expect(dataRows[0].cells).toEqual(['CASE', ''])
  })
})

describe('buildVisaCaseImportSubset', () => {
  it('returns header plus selected data lines in sorted order', () => {
    const csv = 'record_type,customer_id\nCASE,c1\nFAMILY_MEMBER,c2\nFILE_PATH,c3\n'
    const r = buildVisaCaseImportSubset(csv, new Set([3, 2]))
    expect(r).not.toBeNull()
    expect(r?.csvText).toBe('record_type,customer_id\nCASE,c1\nFAMILY_MEMBER,c2')
    expect(r?.originalDataLineNumbers).toEqual([2, 3])
  })

  it('returns null when selection is empty', () => {
    expect(buildVisaCaseImportSubset('a\nb', new Set())).toBeNull()
  })

  it('strips BOM and normalizes CRLF like backend before locating header', () => {
    const csv = '\uFEFFrecord_type,x\r\nCASE,y\r\n'
    const r = buildVisaCaseImportSubset(csv, new Set([2]))
    expect(r?.csvText).toBe('record_type,x\nCASE,y')
    expect(r?.originalDataLineNumbers).toEqual([2])
  })

  it('preserves quoted data lines verbatim in subset', () => {
    const csv = 'record_type,file_path\nFILE_PATH,"/a,b/c"\n'
    const r = buildVisaCaseImportSubset(csv, new Set([2]))
    expect(r?.csvText).toBe('record_type,file_path\nFILE_PATH,"/a,b/c"')
  })

  it('subsets wide template by physical line numbers（CASE 行在从属行之前）', () => {
    const r = buildVisaCaseImportSubset(VISA_CASE_IMPORT_TEMPLATE_WIDE_CSV, new Set([2, 3, 4]))
    expect(r).not.toBeNull()
    const lines = r!.csvText.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[1].startsWith('CASE,')).toBe(true)
    expect(lines[2].startsWith('FAMILY_MEMBER,')).toBe(true)
    expect(lines[3].startsWith('FILE_PATH,')).toBe(true)
    expect(r!.originalDataLineNumbers).toEqual([2, 3, 4])
  })
})
