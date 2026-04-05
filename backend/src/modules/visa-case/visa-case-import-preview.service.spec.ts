/* eslint-disable max-lines, max-lines-per-function -- docs/24 预览错误码与场景用例集中于此 spec */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { CustomerStatus, FamilyRelation } from '../../common/constants/enums';
import { Customer } from '../customer/entities/customer.entity';
import { VisaCase } from './entities/visa-case.entity';
import {
  VisaCaseImportErrorCode,
  VisaCaseImportWarningCode,
} from './import/visa-case-import.constants';
import { VisaCaseImportPreviewService } from './visa-case-import-preview.service';

/** 将多行拼成 UTF-8 Buffer，供 docs/24 错误码场景使用。 */
function csvBuf(lines: string[]): Buffer {
  return Buffer.from(lines.join('\n'), 'utf8');
}

describe('VisaCaseImportPreviewService', () => {
  let service: VisaCaseImportPreviewService;
  let customerRepo: jest.Mocked<Pick<Repository<Customer>, 'findOne' | 'find'>>;
  let visaCaseRepo: jest.Mocked<Pick<Repository<VisaCase>, 'findOne'>>;

  const activeCustomer: Partial<Customer> = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: CustomerStatus.ACTIVE,
    customerCode: 'C-001',
  };

  beforeEach(async () => {
    customerRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    visaCaseRepo = {
      findOne: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VisaCaseImportPreviewService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(VisaCase), useValue: visaCaseRepo },
      ],
    }).compile();

    service = moduleRef.get(VisaCaseImportPreviewService);
  });

  it('returns EMPTY_FILE for empty buffer', async () => {
    const r = await service.previewFromBuffer(Buffer.from('', 'utf8'));
    expect(r.blockingFileErrors[0]?.code).toBe(
      VisaCaseImportErrorCode.EMPTY_FILE,
    );
    expect(r.summary.canProceed).toBe(false);
  });

  it('requires record_type column in header', async () => {
    const csv = Buffer.from('foo,bar\nCASE,x\n', 'utf8');
    const r = await service.previewFromBuffer(csv);
    expect(r.blockingFileErrors[0]?.code).toBe(
      VisaCaseImportErrorCode.MISSING_RECORD_TYPE_COLUMN,
    );
  });

  it('accepts minimal CASE row with active customer UUID', async () => {
    customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
    visaCaseRepo.findOne.mockResolvedValue(null);

    const csv = Buffer.from(
      'record_type,customer_id\n' +
        'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\n',
      'utf8',
    );
    const r = await service.previewFromBuffer(csv);
    expect(r.blockingFileErrors).toHaveLength(0);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].status).toBe('OK');
    expect(r.summary.canProceed).toBe(true);
    expect(r.rows[0].resolved?.serviceCustomerId).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  it('rejects INACTIVE customer', async () => {
    customerRepo.findOne.mockResolvedValue({
      ...activeCustomer,
      status: CustomerStatus.INACTIVE,
    } as Customer);

    const csv = Buffer.from(
      'record_type,customer_id\n' +
        'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\n',
      'utf8',
    );
    const r = await service.previewFromBuffer(csv);
    expect(r.rows[0].errors[0]?.code).toBe(
      VisaCaseImportErrorCode.CUSTOMER_INACTIVE,
    );
    expect(r.summary.canProceed).toBe(false);
  });

  it('flags DUPLICATE_LEGACY_REF_IN_FILE for two CASE rows with same ref', async () => {
    customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
    customerRepo.find.mockResolvedValue([activeCustomer as Customer]);
    visaCaseRepo.findOne.mockResolvedValue(null);

    const csv = Buffer.from(
      [
        'record_type,customer_id,legacy_case_ref',
        'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,OLD-1',
        'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,OLD-1',
      ].join('\n'),
      'utf8',
    );
    const r = await service.previewFromBuffer(csv);
    expect(
      r.blockingFileErrors.some(
        (e) => e.code === VisaCaseImportErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
      ),
    ).toBe(true);
    expect(r.summary.canProceed).toBe(false);
  });

  it('marks DUPLICATE_SKIPPED when import_reference already exists', async () => {
    customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
    visaCaseRepo.findOne.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    } as VisaCase);

    const csv = Buffer.from(
      [
        'record_type,customer_id,legacy_case_ref',
        'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,OLD-EXIST',
      ].join('\n'),
      'utf8',
    );
    const r = await service.previewFromBuffer(csv);
    expect(r.rows[0].status).toBe('DUPLICATE_SKIPPED');
    expect(r.summary.duplicateSkippedRowCount).toBe(1);
    expect(r.summary.canProceed).toBe(true);
  });

  it('warns on duplicate file_path in same customer and legacy scope', async () => {
    customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
    visaCaseRepo.findOne.mockResolvedValue(null);

    const csv = Buffer.from(
      [
        'record_type,customer_id,legacy_case_ref,file_path',
        'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,PKG-1,',
        'FILE_PATH,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,PKG-1,/data/a',
        'FILE_PATH,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,PKG-1,/data/a',
      ].join('\n'),
      'utf8',
    );
    const r = await service.previewFromBuffer(csv);
    const fpRows = r.rows.filter((x) => x.recordType === 'FILE_PATH');
    expect(fpRows[1].warnings.length).toBeGreaterThan(0);
    expect(fpRows[1].status).toBe('WARNING');
  });

  it('resolves customer by customer_code', async () => {
    customerRepo.find.mockResolvedValue([activeCustomer as Customer]);
    visaCaseRepo.findOne.mockResolvedValue(null);

    const csv = Buffer.from('record_type,customer_code\nCASE,C-001\n', 'utf8');
    const r = await service.previewFromBuffer(csv);
    expect(r.rows[0].status).toBe('OK');
    expect(customerRepo.find).toHaveBeenCalled();
  });

  /**
   * docs/24 §6 预览层错误码与 §9 验收场景：逐码覆盖 `VisaCaseImportErrorCode`（`MISSING_HEADER_ROW` 为常量预留，实现走 `EMPTY_FILE`）。
   */
  describe('docs/24 preview error codes', () => {
    it('EMPTY_FILE for whitespace-only content (§9 #1)', async () => {
      const r = await service.previewFromBuffer(csvBuf(['  ', ' \t ', '']));
      expect(r.blockingFileErrors[0]?.code).toBe(
        VisaCaseImportErrorCode.EMPTY_FILE,
      );
      expect(r.summary.canProceed).toBe(false);
    });

    it('INVALID_RECORD_TYPE', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id',
          'NOT_A_TYPE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        ]),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.INVALID_RECORD_TYPE,
      );
    });

    it('MISSING_SERVICE_CUSTOMER', async () => {
      const r = await service.previewFromBuffer(
        csvBuf(['record_type', 'CASE']),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.MISSING_SERVICE_CUSTOMER,
      );
    });

    it('INVALID_UUID for customer_id', async () => {
      const r = await service.previewFromBuffer(
        csvBuf(['record_type,customer_id', 'CASE,not-a-uuid']),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.INVALID_UUID,
      );
    });

    it('CUSTOMER_NOT_FOUND by UUID', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        ]),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.CUSTOMER_NOT_FOUND,
      );
    });

    it('CUSTOMER_NOT_FOUND by customer_code (§9 #3)', async () => {
      customerRepo.find.mockResolvedValue([]);
      const r = await service.previewFromBuffer(
        csvBuf(['record_type,customer_code', 'CASE,UNKNOWN-CODE']),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.CUSTOMER_NOT_FOUND,
      );
    });

    it('CUSTOMER_CODE_AMBIGUOUS (§9 #4)', async () => {
      customerRepo.find.mockResolvedValue([
        { ...activeCustomer, id: '11111111-1111-4111-8111-111111111111' },
        { ...activeCustomer, id: '22222222-2222-4222-8222-222222222222' },
      ] as Customer[]);
      const r = await service.previewFromBuffer(
        csvBuf(['record_type,customer_code', 'CASE,C-001']),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.CUSTOMER_CODE_AMBIGUOUS,
      );
    });

    it('INVALID_ENUM legacy_case_ref over 100 chars', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      const longRef = 'x'.repeat(101);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref',
          `CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,${longRef}`,
        ]),
      );
      expect(r.rows[0].errors.some((e) => e.code === 'INVALID_ENUM')).toBe(
        true,
      );
    });

    it('INVALID_BOOLEAN is_family_case', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,is_family_case',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,maybe',
        ]),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.INVALID_BOOLEAN,
      );
    });

    it('INVALID_ENUM family_link_mode when family case', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,is_family_case,family_link_mode',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,true,BAD_MODE',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_ENUM,
        ),
      ).toBe(true);
    });

    it('INTERNAL_REQUIRES_PRIMARY when INTERNAL without primary', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,is_family_case,family_link_mode',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,true,INTERNAL',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INTERNAL_REQUIRES_PRIMARY,
        ),
      ).toBe(true);
    });

    it('INTERNAL_REQUIRES_PRIMARY when primary UUID customer missing', async () => {
      const primaryId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      customerRepo.findOne
        .mockResolvedValueOnce(activeCustomer as Customer)
        .mockResolvedValueOnce(null);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,is_family_case,family_link_mode,internal_primary_customer_id',
          `CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,true,INTERNAL,${primaryId}`,
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INTERNAL_REQUIRES_PRIMARY,
        ),
      ).toBe(true);
    });

    it('EXTERNAL_REQUIRES_NAME', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,is_family_case,family_link_mode',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,true,EXTERNAL',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.EXTERNAL_REQUIRES_NAME,
        ),
      ).toBe(true);
    });

    it('INVALID_DATE external_primary_expire_date', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,is_family_case,family_link_mode,external_primary_name,external_primary_expire_date',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,true,EXTERNAL,主申請者,99-99-99',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_DATE,
        ),
      ).toBe(true);
    });

    it('INVALID_ENUM external_primary_relation_to_applicant when set', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,is_family_case,family_link_mode,external_primary_name,external_primary_relation_to_applicant',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,true,EXTERNAL,主申請者,NOT_A_RELATION',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_ENUM,
        ),
      ).toBe(true);
    });

    it('parses optional external_primary_relation_to_applicant on EXTERNAL CASE', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,is_family_case,family_link_mode,external_primary_name,external_primary_relation_to_applicant',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,true,EXTERNAL,主申請者,spouse',
        ]),
      );
      expect(r.rows[0].status).toBe('OK');
      expect(r.rows[0].resolved?.case?.externalPrimaryRelationToApplicant).toBe(
        FamilyRelation.SPOUSE,
      );
    });

    it('INVALID_ENUM case_status', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,case_status',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,NOT_A_STATUS',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_ENUM,
        ),
      ).toBe(true);
    });

    it('INVALID_ENUM material_status', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,material_status',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,BAD_MATERIAL',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_ENUM,
        ),
      ).toBe(true);
    });

    it('INVALID_ENUM fee_status', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,fee_status',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,BAD_FEE',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_ENUM,
        ),
      ).toBe(true);
    });

    it('INVALID_DATE expire_date', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,expire_date',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,2026/01/01',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_DATE,
        ),
      ).toBe(true);
    });

    it('INVALID_DATE next_follow_up_at', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,next_follow_up_at',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,not-a-datetime',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_DATE,
        ),
      ).toBe(true);
    });

    it('INVALID_UUID assigned_to', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,assigned_to',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,bad',
        ]),
      );
      expect(
        r.rows[0].errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_UUID,
        ),
      ).toBe(true);
    });

    it('row-level DUPLICATE_LEGACY_REF_IN_FILE when file blocked (§9 #6)', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      customerRepo.find.mockResolvedValue([activeCustomer as Customer]);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,DUP',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,DUP',
        ]),
      );
      expect(r.blockingFileErrors[0]?.code).toBe(
        VisaCaseImportErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
      );
      const dupRowErrors = r.rows.flatMap((row) => row.errors);
      expect(
        dupRowErrors.some(
          (e) =>
            e.code === VisaCaseImportErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
        ),
      ).toBe(true);
    });

    it('LEGACY_REF_REQUIRED on FAMILY_MEMBER', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,member_customer_id,member_role,display_name_snapshot',
          'FAMILY_MEMBER,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb,SPOUSE,名',
        ]),
      );
      expect(
        r.rows[0].errors[0]?.code ===
          VisaCaseImportErrorCode.LEGACY_REF_REQUIRED,
      ).toBe(true);
    });

    it('ORPHAN_FAMILY_ROW (§9 #8)', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,member_customer_id,member_role,display_name_snapshot',
          'FAMILY_MEMBER,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,ORPHAN,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb,SPOUSE,名',
        ]),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.ORPHAN_FAMILY_ROW,
      );
    });

    it('MEMBER_CUSTOMER_REQUIRED', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,member_customer_id,member_role,display_name_snapshot',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FM1,,,',
          'FAMILY_MEMBER,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FM1,,SPOUSE,名',
        ]),
      );
      const fam = r.rows.find((x) => x.recordType === 'FAMILY_MEMBER');
      expect(fam?.errors[0]?.code).toBe(
        VisaCaseImportErrorCode.MEMBER_CUSTOMER_REQUIRED,
      );
    });

    it('INVALID_UUID member_customer_id', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,member_customer_id,member_role,display_name_snapshot',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FM2,,,',
          'FAMILY_MEMBER,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FM2,bad-uuid,SPOUSE,名',
        ]),
      );
      const fam = r.rows.find((x) => x.recordType === 'FAMILY_MEMBER');
      expect(fam?.errors[0]?.code).toBe(VisaCaseImportErrorCode.INVALID_UUID);
    });

    it('INVALID_ENUM member_role', async () => {
      customerRepo.findOne.mockImplementation(({ where }) => {
        const id = (where as { id?: string })?.id;
        if (id === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') {
          return Promise.resolve({
            ...activeCustomer,
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          } as Customer);
        }
        return Promise.resolve(activeCustomer as Customer);
      });
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,member_customer_id,member_role,display_name_snapshot',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FM3,,,',
          'FAMILY_MEMBER,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FM3,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb,ALIEN,名',
        ]),
      );
      const fam = r.rows.find((x) => x.recordType === 'FAMILY_MEMBER');
      expect(
        fam?.errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_ENUM,
        ),
      ).toBe(true);
    });

    it('INVALID_BOOLEAN is_primary on FAMILY_MEMBER', async () => {
      customerRepo.findOne.mockImplementation(({ where }) => {
        const id = (where as { id?: string })?.id;
        if (id === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') {
          return Promise.resolve({
            ...activeCustomer,
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          } as Customer);
        }
        return Promise.resolve(activeCustomer as Customer);
      });
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,member_customer_id,member_role,is_primary,display_name_snapshot',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FM4,,,,',
          'FAMILY_MEMBER,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FM4,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb,SPOUSE,wat,名',
        ]),
      );
      const fam = r.rows.find((x) => x.recordType === 'FAMILY_MEMBER');
      expect(
        fam?.errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_BOOLEAN,
        ),
      ).toBe(true);
    });

    it('DISPLAY_NAME_REQUIRED', async () => {
      customerRepo.findOne.mockImplementation(({ where }) => {
        const id = (where as { id?: string })?.id;
        if (id === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') {
          return Promise.resolve({
            ...activeCustomer,
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          } as Customer);
        }
        return Promise.resolve(activeCustomer as Customer);
      });
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,member_customer_id,member_role,display_name_snapshot',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FM5,,,',
          'FAMILY_MEMBER,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FM5,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb,SPOUSE,',
        ]),
      );
      const fam = r.rows.find((x) => x.recordType === 'FAMILY_MEMBER');
      expect(
        fam?.errors.some(
          (e) => e.code === VisaCaseImportErrorCode.DISPLAY_NAME_REQUIRED,
        ),
      ).toBe(true);
    });

    it('FILE_PATH_REQUIRED', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,file_path',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FP1,',
          'FILE_PATH,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FP1,',
        ]),
      );
      const fp = r.rows.find((x) => x.recordType === 'FILE_PATH');
      expect(fp?.errors[0]?.code).toBe(
        VisaCaseImportErrorCode.FILE_PATH_REQUIRED,
      );
    });

    it('ORPHAN_FILE_PATH_ROW', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,file_path',
          'FILE_PATH,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,NO-CASE,/tmp/x',
        ]),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.ORPHAN_FILE_PATH_ROW,
      );
    });

    it('INVALID_ENUM path_type', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,file_path,path_type',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FP2,,',
          'FILE_PATH,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FP2,/tmp/y,BAD_PATH_TYPE',
        ]),
      );
      const fp = r.rows.find((x) => x.recordType === 'FILE_PATH');
      expect(
        fp?.errors.some((e) => e.code === VisaCaseImportErrorCode.INVALID_ENUM),
      ).toBe(true);
    });

    it('CASE_LOG LEGACY_REF_REQUIRED', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,log_type,log_content',
          'CASE_LOG,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,FOLLOW_UP,本文',
        ]),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.LEGACY_REF_REQUIRED,
      );
    });

    it('ORPHAN_LOG_ROW', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,log_type,log_content',
          'CASE_LOG,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,NO-CASE,FOLLOW_UP,本文',
        ]),
      );
      expect(r.rows[0].errors[0]?.code).toBe(
        VisaCaseImportErrorCode.ORPHAN_LOG_ROW,
      );
    });

    it('LOG_TYPE_REQUIRED', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,log_type,log_content',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,LG1,,',
          'CASE_LOG,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,LG1,,本文',
        ]),
      );
      const logRow = r.rows.find((x) => x.recordType === 'CASE_LOG');
      expect(logRow?.errors[0]?.code).toBe(
        VisaCaseImportErrorCode.LOG_TYPE_REQUIRED,
      );
    });

    it('LOG_CONTENT_REQUIRED', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,log_type,log_content',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,LG2,,',
          'CASE_LOG,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,LG2,FOLLOW_UP,',
        ]),
      );
      const logRow = r.rows.find((x) => x.recordType === 'CASE_LOG');
      expect(logRow?.errors[0]?.code).toBe(
        VisaCaseImportErrorCode.LOG_CONTENT_REQUIRED,
      );
    });

    it('INVALID_DATE log_next_follow_up_at', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,log_type,log_content,log_next_follow_up_at',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,LG3,,,',
          'CASE_LOG,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,LG3,FOLLOW_UP,本文,bad-dt',
        ]),
      );
      const logRow = r.rows.find((x) => x.recordType === 'CASE_LOG');
      expect(
        logRow?.errors.some(
          (e) => e.code === VisaCaseImportErrorCode.INVALID_DATE,
        ),
      ).toBe(true);
    });

    it('FILE_PATH_DUPLICATE_IN_FILE warning code (§6.1)', async () => {
      customerRepo.findOne.mockResolvedValue(activeCustomer as Customer);
      visaCaseRepo.findOne.mockResolvedValue(null);
      const r = await service.previewFromBuffer(
        csvBuf([
          'record_type,customer_id,legacy_case_ref,file_path',
          'CASE,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,W1,',
          'FILE_PATH,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,W1,/same',
          'FILE_PATH,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,W1,/same',
        ]),
      );
      const warns = r.rows.flatMap((row) => row.warnings);
      expect(
        warns.some(
          (w) =>
            w.code === VisaCaseImportWarningCode.FILE_PATH_DUPLICATE_IN_FILE,
        ),
      ).toBe(true);
    });
  });
});
