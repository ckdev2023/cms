/* eslint-disable max-lines-per-function -- docs/24 错误码分场景用例集中在一个 spec 便于检索 */
import { describe, expect, it } from 'vitest'

import {
  analyzeVisaCaseImportCsvLocal,
  collectVisaCaseImportLocalAnalyzeCodes,
} from './visa-case-import-csv-local-analyze'
import {
  collectVisaCaseImportPreviewCodesFromResponse,
  VISA_CASE_IMPORT_DOCS24_SECTION6_ERROR_CODES,
  VISA_CASE_IMPORT_DOCS24_SECTION61_WARNING_CODES,
  VisaCaseImportPreviewErrorCode,
} from './visa-case-import-preview-codes'

/** 与本地解析用例一致的有效服务客户 UUID（仅用于文件内自洽，不经 API）。 */
const U = '11111111-1111-4111-8111-111111111111'

/**
 * 对 CSV 跑本地结构分析并返回出现过的码集合。
 *
 * @param csv - 完整 CSV 文本
 * @returns 错误码与警告码集合
 */
function localCodes(csv: string): Set<string> {
  return new Set(
    collectVisaCaseImportLocalAnalyzeCodes(analyzeVisaCaseImportCsvLocal(csv)),
  )
}

describe('docs/24 §6 / §6.1 — 预览错误码与警告码（B1-fe CSV 解析路径 Vitest）', () => {
  it('§6 表列出的错误码与导出常量数组一致且无重复', () => {
    const unique = new Set(VISA_CASE_IMPORT_DOCS24_SECTION6_ERROR_CODES)
    expect(unique.size).toBe(VISA_CASE_IMPORT_DOCS24_SECTION6_ERROR_CODES.length)
    expect(unique.has(VisaCaseImportPreviewErrorCode.EMPTY_FILE)).toBe(true)
  })

  it('§6.1 警告码列表含 FILE_PATH_DUPLICATE_IN_FILE', () => {
    expect(VISA_CASE_IMPORT_DOCS24_SECTION61_WARNING_CODES).toContain(
      'FILE_PATH_DUPLICATE_IN_FILE',
    )
  })

  describe('本地 CSV 结构分析可触发的码（与后端预览规则同构、无 DB）', () => {
    it('EMPTY_FILE', () => {
      expect(localCodes('').has(VisaCaseImportPreviewErrorCode.EMPTY_FILE)).toBe(true)
      expect(localCodes('   \n  \n').has(VisaCaseImportPreviewErrorCode.EMPTY_FILE)).toBe(
        true,
      )
    })

    it('MISSING_RECORD_TYPE_COLUMN', () => {
      const csv = 'foo,bar\nx,y\n'
      expect(
        localCodes(csv).has(VisaCaseImportPreviewErrorCode.MISSING_RECORD_TYPE_COLUMN),
      ).toBe(true)
    })

    it('DUPLICATE_LEGACY_REF_IN_FILE（文件级阻断 + 涉事 CASE 行级重复码）', () => {
      const csv =
        `record_type,customer_id,legacy_case_ref,case_status\n` +
        `CASE,${U},R1,IN_PROGRESS\n` +
        `CASE,${U},R1,IN_PROGRESS\n`
      const r = analyzeVisaCaseImportCsvLocal(csv)
      expect(
        r.blockingFileErrors.some(
          (e) => e.code === VisaCaseImportPreviewErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
        ),
      ).toBe(true)
      expect(
        r.rows.every((row) =>
          row.errors.some(
            (e) => e.code === VisaCaseImportPreviewErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
          ),
        ),
      ).toBe(true)
    })

    it('INVALID_RECORD_TYPE', () => {
      const csv = `record_type,customer_id\nFOO,${U}\n`
      expect(localCodes(csv).has(VisaCaseImportPreviewErrorCode.INVALID_RECORD_TYPE)).toBe(
        true,
      )
    })

    it('MISSING_SERVICE_CUSTOMER', () => {
      const csv = 'record_type\nCASE\n'
      expect(
        localCodes(csv).has(VisaCaseImportPreviewErrorCode.MISSING_SERVICE_CUSTOMER),
      ).toBe(true)
    })

    it('INVALID_UUID（customer_id）', () => {
      const csv = 'record_type,customer_id\nCASE,not-a-uuid\n'
      expect(localCodes(csv).has(VisaCaseImportPreviewErrorCode.INVALID_UUID)).toBe(true)
    })

    it('INVALID_ENUM（legacy_case_ref 超长）', () => {
      const longRef = 'x'.repeat(101)
      const csv = `record_type,customer_id,legacy_case_ref,case_status\nCASE,${U},${longRef},IN_PROGRESS\n`
      expect(localCodes(csv).has(VisaCaseImportPreviewErrorCode.INVALID_ENUM)).toBe(true)
    })

    it('INVALID_BOOLEAN（is_family_case）', () => {
      const csv =
        `record_type,customer_id,legacy_case_ref,is_family_case,case_status\n` +
        `CASE,${U},,maybe,IN_PROGRESS\n`
      expect(localCodes(csv).has(VisaCaseImportPreviewErrorCode.INVALID_BOOLEAN)).toBe(
        true,
      )
    })

    it('INVALID_ENUM（case_status / material_status / fee_status）', () => {
      const csv1 =
        `record_type,customer_id,legacy_case_ref,case_status\nCASE,${U},,NOT_A_STATUS\n`
      expect(localCodes(csv1).has(VisaCaseImportPreviewErrorCode.INVALID_ENUM)).toBe(true)
      const csv2 =
        `record_type,customer_id,legacy_case_ref,case_status,material_status\nCASE,${U},,IN_PROGRESS,BAD_MAT\n`
      expect(localCodes(csv2).has(VisaCaseImportPreviewErrorCode.INVALID_ENUM)).toBe(true)
      const csv3 =
        `record_type,customer_id,legacy_case_ref,case_status,fee_status\nCASE,${U},,IN_PROGRESS,BAD_FEE\n`
      expect(localCodes(csv3).has(VisaCaseImportPreviewErrorCode.INVALID_ENUM)).toBe(true)
    })

    it('INVALID_DATE（expire_date / next_follow_up_at / EXTERNAL 主申期限）', () => {
      const e1 =
        `record_type,customer_id,legacy_case_ref,case_status,expire_date\nCASE,${U},,IN_PROGRESS,bad\n`
      expect(localCodes(e1).has(VisaCaseImportPreviewErrorCode.INVALID_DATE)).toBe(true)
      const e2 =
        `record_type,customer_id,legacy_case_ref,case_status,next_follow_up_at\n` +
        `CASE,${U},,IN_PROGRESS,not-a-date\n`
      expect(localCodes(e2).has(VisaCaseImportPreviewErrorCode.INVALID_DATE)).toBe(true)
      const e3 =
        `record_type,customer_id,legacy_case_ref,is_family_case,family_link_mode,external_primary_name,external_primary_expire_date,case_status\n` +
        `CASE,${U},L1,true,EXTERNAL,主申名,bad-date,IN_PROGRESS\n`
      expect(localCodes(e3).has(VisaCaseImportPreviewErrorCode.INVALID_DATE)).toBe(true)
    })

    it('INTERNAL_REQUIRES_PRIMARY', () => {
      const csv =
        `record_type,customer_id,legacy_case_ref,is_family_case,family_link_mode,case_status\n` +
        `CASE,${U},L1,true,INTERNAL,IN_PROGRESS\n`
      expect(
        localCodes(csv).has(VisaCaseImportPreviewErrorCode.INTERNAL_REQUIRES_PRIMARY),
      ).toBe(true)
    })

    it('EXTERNAL_REQUIRES_NAME', () => {
      const csv =
        `record_type,customer_id,legacy_case_ref,is_family_case,family_link_mode,case_status\n` +
        `CASE,${U},L1,true,EXTERNAL,IN_PROGRESS\n`
      expect(
        localCodes(csv).has(VisaCaseImportPreviewErrorCode.EXTERNAL_REQUIRES_NAME),
      ).toBe(true)
    })

    it('INVALID_ENUM external_primary_relation_to_applicant', () => {
      const csv =
        `record_type,customer_id,legacy_case_ref,is_family_case,family_link_mode,external_primary_name,external_primary_relation_to_applicant,case_status\n` +
        `CASE,${U},L1,true,EXTERNAL,主申名,BAD_REL,IN_PROGRESS\n`
      expect(
        localCodes(csv).has(VisaCaseImportPreviewErrorCode.INVALID_ENUM),
      ).toBe(true)
    })

    it('INVALID_UUID（internal_primary_customer_id / assigned_to）', () => {
      const csv1 =
        `record_type,customer_id,legacy_case_ref,is_family_case,family_link_mode,internal_primary_customer_id,case_status\n` +
        `CASE,${U},L1,true,INTERNAL,bad,IN_PROGRESS\n`
      expect(localCodes(csv1).has(VisaCaseImportPreviewErrorCode.INVALID_UUID)).toBe(true)
      const csv2 =
        `record_type,customer_id,legacy_case_ref,case_status,assigned_to\n` +
        `CASE,${U},,IN_PROGRESS,nope\n`
      expect(localCodes(csv2).has(VisaCaseImportPreviewErrorCode.INVALID_UUID)).toBe(true)
    })

    it('LEGACY_REF_REQUIRED（FAMILY_MEMBER / CASE_LOG）', () => {
      const fam =
        `record_type,customer_id,member_customer_id,member_role,is_primary,display_name_snapshot\n` +
        `FAMILY_MEMBER,${U},${U},SPOUSE,false,X\n`
      expect(localCodes(fam).has(VisaCaseImportPreviewErrorCode.LEGACY_REF_REQUIRED)).toBe(
        true,
      )
      const log = `record_type,customer_id,log_type,log_content\nCASE_LOG,${U},FOLLOW_UP,hi\n`
      expect(localCodes(log).has(VisaCaseImportPreviewErrorCode.LEGACY_REF_REQUIRED)).toBe(
        true,
      )
    })

    it('ORPHAN_FAMILY_ROW / ORPHAN_FILE_PATH_ROW / ORPHAN_LOG_ROW', () => {
      const fam =
        `record_type,customer_id,legacy_case_ref,member_customer_id,member_role,is_primary,display_name_snapshot\n` +
        `FAMILY_MEMBER,${U},L1,${U},SPOUSE,false,X\n`
      expect(localCodes(fam).has(VisaCaseImportPreviewErrorCode.ORPHAN_FAMILY_ROW)).toBe(
        true,
      )
      const fp =
        `record_type,customer_id,legacy_case_ref,file_path\nFILE_PATH,${U},L1,/p\n`
      expect(
        localCodes(fp).has(VisaCaseImportPreviewErrorCode.ORPHAN_FILE_PATH_ROW),
      ).toBe(true)
      const lg =
        `record_type,customer_id,legacy_case_ref,log_type,log_content\n` +
        `CASE_LOG,${U},L1,FOLLOW_UP,note\n`
      expect(localCodes(lg).has(VisaCaseImportPreviewErrorCode.ORPHAN_LOG_ROW)).toBe(true)
    })

    it('MEMBER_CUSTOMER_REQUIRED / INVALID_UUID / INVALID_ENUM(member_role) / INVALID_BOOLEAN(is_primary) / DISPLAY_NAME_REQUIRED', () => {
      const base =
        `record_type,customer_id,legacy_case_ref,member_customer_id,member_customer_code,member_role,is_primary,display_name_snapshot\n`
      const csv1 = `${base}CASE,${U},L1,,,,,\nFAMILY_MEMBER,${U},L1,,,SPOUSE,false,Name\n`
      expect(
        localCodes(csv1).has(VisaCaseImportPreviewErrorCode.MEMBER_CUSTOMER_REQUIRED),
      ).toBe(true)

      const csv2 =
        `${base}CASE,${U},L2,,,,,\nFAMILY_MEMBER,${U},L2,bad-uuid,,SPOUSE,false,Name\n`
      expect(localCodes(csv2).has(VisaCaseImportPreviewErrorCode.INVALID_UUID)).toBe(true)

      const csv3 =
        `${base}CASE,${U},L3,,,,,\nFAMILY_MEMBER,${U},L3,${U},,BAD_ROLE,false,Name\n`
      expect(localCodes(csv3).has(VisaCaseImportPreviewErrorCode.INVALID_ENUM)).toBe(true)

      const csv4 =
        `${base}CASE,${U},L4,,,,,\nFAMILY_MEMBER,${U},L4,${U},,SPOUSE,maybe,Name\n`
      expect(localCodes(csv4).has(VisaCaseImportPreviewErrorCode.INVALID_BOOLEAN)).toBe(
        true,
      )

      const csv5 =
        `${base}CASE,${U},L5,,,,,\nFAMILY_MEMBER,${U},L5,${U},,SPOUSE,false,\n`
      expect(
        localCodes(csv5).has(VisaCaseImportPreviewErrorCode.DISPLAY_NAME_REQUIRED),
      ).toBe(true)
    })

    it('FILE_PATH_REQUIRED / INVALID_ENUM(path_type)', () => {
      const csv1 = `record_type,customer_id,legacy_case_ref,file_path\nFILE_PATH,${U},,,\n`
      expect(localCodes(csv1).has(VisaCaseImportPreviewErrorCode.FILE_PATH_REQUIRED)).toBe(
        true,
      )
      const csv2 =
        `record_type,customer_id,legacy_case_ref,file_path,path_type,case_status\n` +
        `CASE,${U},L7,,,,IN_PROGRESS\n` +
        `FILE_PATH,${U},L7,/x,BAD_TYPE\n`
      expect(localCodes(csv2).has(VisaCaseImportPreviewErrorCode.INVALID_ENUM)).toBe(true)
    })

    it('LOG_TYPE_REQUIRED / LOG_CONTENT_REQUIRED / INVALID_DATE(log_next_follow_up_at)', () => {
      const hdr =
        'record_type,customer_id,legacy_case_ref,log_type,log_content,log_next_follow_up_at\n'
      const csv1 =
        `${hdr}CASE,${U},L8,,,,\nCASE_LOG,${U},L8,,body,\n`
      expect(localCodes(csv1).has(VisaCaseImportPreviewErrorCode.LOG_TYPE_REQUIRED)).toBe(
        true,
      )
      const csv2 =
        `${hdr}CASE,${U},L8b,,,,\nCASE_LOG,${U},L8b,FOLLOW_UP,,\n`
      expect(
        localCodes(csv2).has(VisaCaseImportPreviewErrorCode.LOG_CONTENT_REQUIRED),
      ).toBe(true)
      const csv3 =
        `${hdr}CASE,${U},L8c,,,,\nCASE_LOG,${U},L8c,FOLLOW_UP,body,bad-dt\n`
      expect(localCodes(csv3).has(VisaCaseImportPreviewErrorCode.INVALID_DATE)).toBe(true)
    })

    it('FILE_PATH_DUPLICATE_IN_FILE（§6.1 警告码）', () => {
      const csv =
        `record_type,customer_id,legacy_case_ref,file_path\n` +
        `CASE,${U},L9,,IN_PROGRESS\n` +
        `FILE_PATH,${U},L9,/same\n` +
        `FILE_PATH,${U},L9,/same\n`
      expect(localCodes(csv).has('FILE_PATH_DUPLICATE_IN_FILE')).toBe(true)
    })
  })

  describe('依赖客户主档或预留码：通过预览响应形状断言（与 VisaCaseImportView 展示路径一致）', () => {
    it('MISSING_HEADER_ROW / CUSTOMER_NOT_FOUND / CUSTOMER_CODE_AMBIGUOUS / CUSTOMER_INACTIVE', () => {
      const preview = {
        blockingFileErrors: [
          { code: VisaCaseImportPreviewErrorCode.MISSING_HEADER_ROW, message: 'reserved' },
        ],
        rows: [
          {
            errors: [
              {
                code: VisaCaseImportPreviewErrorCode.CUSTOMER_NOT_FOUND,
                message: '顧客が見つかりません',
              },
            ],
            warnings: [] as { code: string; message: string }[],
          },
          {
            errors: [
              {
                code: VisaCaseImportPreviewErrorCode.CUSTOMER_CODE_AMBIGUOUS,
                message: 'ambiguous',
              },
            ],
            warnings: [],
          },
          {
            errors: [
              {
                code: VisaCaseImportPreviewErrorCode.CUSTOMER_INACTIVE,
                message: 'inactive',
              },
            ],
            warnings: [],
          },
        ],
      }
      const codes = collectVisaCaseImportPreviewCodesFromResponse(preview)
      expect(codes).toContain(VisaCaseImportPreviewErrorCode.MISSING_HEADER_ROW)
      expect(codes).toContain(VisaCaseImportPreviewErrorCode.CUSTOMER_NOT_FOUND)
      expect(codes).toContain(VisaCaseImportPreviewErrorCode.CUSTOMER_CODE_AMBIGUOUS)
      expect(codes).toContain(VisaCaseImportPreviewErrorCode.CUSTOMER_INACTIVE)
    })
  })

  it('§6 每个错误码均已被「本地 CSV」或「预览响应 mock」覆盖', () => {
    const covered = new Set<string>()

    const localFixtures = [
      '',
      'foo,bar\nx,y\n',
      `record_type,customer_id,legacy_case_ref,case_status\nCASE,${U},R1,IN_PROGRESS\nCASE,${U},R1,IN_PROGRESS\n`,
      `record_type,customer_id\nFOO,${U}\n`,
      'record_type\nCASE\n',
      'record_type,customer_id\nCASE,not-a-uuid\n',
      `record_type,customer_id,legacy_case_ref,case_status\nCASE,${U},${'x'.repeat(101)},IN_PROGRESS\n`,
      `record_type,customer_id,legacy_case_ref,is_family_case,case_status\nCASE,${U},,maybe,IN_PROGRESS\n`,
      `record_type,customer_id,legacy_case_ref,case_status\nCASE,${U},,NOT_A_STATUS\n`,
      `record_type,customer_id,legacy_case_ref,case_status,expire_date\nCASE,${U},,IN_PROGRESS,bad\n`,
      `record_type,customer_id,legacy_case_ref,case_status,next_follow_up_at\nCASE,${U},,IN_PROGRESS,not-a-date\n`,
      `record_type,customer_id,legacy_case_ref,case_status,material_status\nCASE,${U},,IN_PROGRESS,BAD_MAT\n`,
      `record_type,customer_id,legacy_case_ref,case_status,fee_status\nCASE,${U},,IN_PROGRESS,BAD_FEE\n`,
      `record_type,customer_id,legacy_case_ref,is_family_case,family_link_mode,external_primary_name,external_primary_expire_date,case_status\nCASE,${U},L1,true,EXTERNAL,主申名,bad-date,IN_PROGRESS\n`,
      `record_type,customer_id,legacy_case_ref,is_family_case,family_link_mode,case_status\nCASE,${U},L1,true,INTERNAL,IN_PROGRESS\n`,
      `record_type,customer_id,legacy_case_ref,is_family_case,family_link_mode,case_status\nCASE,${U},L1,true,EXTERNAL,IN_PROGRESS\n`,
      `record_type,customer_id,legacy_case_ref,is_family_case,family_link_mode,internal_primary_customer_id,case_status\nCASE,${U},L1,true,INTERNAL,bad,IN_PROGRESS\n`,
      `record_type,customer_id,legacy_case_ref,case_status,assigned_to\nCASE,${U},,IN_PROGRESS,nope\n`,
      `record_type,customer_id,member_customer_id,member_role,is_primary,display_name_snapshot\nFAMILY_MEMBER,${U},${U},SPOUSE,false,X\n`,
      `record_type,customer_id,log_type,log_content\nCASE_LOG,${U},FOLLOW_UP,hi\n`,
      `record_type,customer_id,legacy_case_ref,member_customer_id,member_role,is_primary,display_name_snapshot\nFAMILY_MEMBER,${U},L1,${U},SPOUSE,false,X\n`,
      `record_type,customer_id,legacy_case_ref,file_path\nFILE_PATH,${U},L1,/p\n`,
      `record_type,customer_id,legacy_case_ref,log_type,log_content\nCASE_LOG,${U},L1,FOLLOW_UP,note\n`,
      `record_type,customer_id,legacy_case_ref,member_customer_id,member_customer_code,member_role,is_primary,display_name_snapshot\nCASE,${U},L1,,,,,\nFAMILY_MEMBER,${U},L1,,,SPOUSE,false,Name\n`,
      `record_type,customer_id,legacy_case_ref,member_customer_id,member_customer_code,member_role,is_primary,display_name_snapshot\nCASE,${U},L2,,,,,\nFAMILY_MEMBER,${U},L2,bad-uuid,,SPOUSE,false,Name\n`,
      `record_type,customer_id,legacy_case_ref,member_customer_id,member_customer_code,member_role,is_primary,display_name_snapshot\nCASE,${U},L3,,,,,\nFAMILY_MEMBER,${U},L3,${U},,BAD_ROLE,false,Name\n`,
      `record_type,customer_id,legacy_case_ref,member_customer_id,member_customer_code,member_role,is_primary,display_name_snapshot\nCASE,${U},L4,,,,,\nFAMILY_MEMBER,${U},L4,${U},,SPOUSE,maybe,Name\n`,
      `record_type,customer_id,legacy_case_ref,member_customer_id,member_customer_code,member_role,is_primary,display_name_snapshot\nCASE,${U},L5,,,,,\nFAMILY_MEMBER,${U},L5,${U},,SPOUSE,false,\n`,
      `record_type,customer_id,legacy_case_ref,file_path\nFILE_PATH,${U},,,\n`,
      `record_type,customer_id,legacy_case_ref,file_path,path_type,case_status\nCASE,${U},L7,,,,IN_PROGRESS\nFILE_PATH,${U},L7,/x,BAD_TYPE\n`,
      `record_type,customer_id,legacy_case_ref,log_type,log_content,log_next_follow_up_at\nCASE,${U},L8,,,,\nCASE_LOG,${U},L8,,body,\n`,
      `record_type,customer_id,legacy_case_ref,log_type,log_content,log_next_follow_up_at\nCASE,${U},L8b,,,,\nCASE_LOG,${U},L8b,FOLLOW_UP,,\n`,
      `record_type,customer_id,legacy_case_ref,log_type,log_content,log_next_follow_up_at\nCASE,${U},L8c,,,,\nCASE_LOG,${U},L8c,FOLLOW_UP,body,bad-dt\n`,
      `record_type,customer_id,legacy_case_ref,file_path\nCASE,${U},L9,,IN_PROGRESS\nFILE_PATH,${U},L9,/same\nFILE_PATH,${U},L9,/same\n`,
    ]
    for (const f of localFixtures) {
      for (const c of collectVisaCaseImportLocalAnalyzeCodes(
        analyzeVisaCaseImportCsvLocal(f),
      )) {
        covered.add(c)
      }
    }

    const mockPreview = {
      blockingFileErrors: [
        { code: VisaCaseImportPreviewErrorCode.MISSING_HEADER_ROW, message: '' },
      ],
      rows: [
        {
          errors: [{ code: VisaCaseImportPreviewErrorCode.CUSTOMER_NOT_FOUND, message: '' }],
          warnings: [],
        },
        {
          errors: [
            { code: VisaCaseImportPreviewErrorCode.CUSTOMER_CODE_AMBIGUOUS, message: '' },
          ],
          warnings: [],
        },
        {
          errors: [{ code: VisaCaseImportPreviewErrorCode.CUSTOMER_INACTIVE, message: '' }],
          warnings: [],
        },
      ],
    }
    for (const c of collectVisaCaseImportPreviewCodesFromResponse(mockPreview)) {
      covered.add(c)
    }

    for (const code of VISA_CASE_IMPORT_DOCS24_SECTION6_ERROR_CODES) {
      expect(covered.has(code), `未覆盖错误码: ${code}`).toBe(true)
    }
  })
})
