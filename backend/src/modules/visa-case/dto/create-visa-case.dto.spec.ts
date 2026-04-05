import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

import {
  FamilyLinkMode,
  FamilyRelation,
  VisaCaseStatus,
} from '../../../common/constants/enums';
import { CreateVisaCaseDto } from './create-visa-case.dto';

function collectConstraintMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectConstraintMessages(error.children ?? []),
  ]);
}

const validBase = {
  customerId: '00000000-0000-4000-a000-000000000001',
};

describe('CreateVisaCaseDto — basic fields', () => {
  it('accepts minimal valid input', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, validBase);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing customerId', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, {});
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain(
      '顧客IDの形式が無効です',
    );
  });

  it('rejects invalid caseStatus enum', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, {
      ...validBase,
      caseStatus: 'BAD_STATUS',
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain(
      '案件ステータスが無効です',
    );
  });

  it('accepts valid caseStatus', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, {
      ...validBase,
      caseStatus: VisaCaseStatus.SUBMITTED,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('CreateVisaCaseDto — family case validation', () => {
  it('requires familyLinkMode when isFamilyCase is true', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, {
      ...validBase,
      isFamilyCase: true,
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain(
      '家族紐付けモードが無効です',
    );
  });

  it('does not require familyLinkMode when isFamilyCase is false', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, {
      ...validBase,
      isFamilyCase: false,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('CreateVisaCaseDto — INTERNAL mode', () => {
  it('requires internalPrimaryCustomerId', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, {
      ...validBase,
      isFamilyCase: true,
      familyLinkMode: FamilyLinkMode.INTERNAL,
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain(
      '主申請者IDの形式が無効です',
    );
  });

  it('accepts valid INTERNAL mode with primary customer', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, {
      ...validBase,
      isFamilyCase: true,
      familyLinkMode: FamilyLinkMode.INTERNAL,
      internalPrimaryCustomerId: '00000000-0000-4000-a000-000000000002',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('CreateVisaCaseDto — EXTERNAL mode', () => {
  it('requires externalPrimaryName', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, {
      ...validBase,
      isFamilyCase: true,
      familyLinkMode: FamilyLinkMode.EXTERNAL,
    });
    const errors = await validate(dto);
    const msgs = collectConstraintMessages(errors);
    expect(msgs.some((m) => m.includes('200'))).toBe(true);
  });

  it('accepts valid EXTERNAL mode with all snapshot fields', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, {
      ...validBase,
      isFamilyCase: true,
      familyLinkMode: FamilyLinkMode.EXTERNAL,
      externalPrimaryName: '田中太郎',
      externalPrimaryCaseType: '技術・人文知識・国際業務',
      externalPrimaryExpireDate: '2027-06-30',
      externalPrimaryRelationToApplicant: FamilyRelation.SPOUSE,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid externalPrimaryRelationToApplicant enum', async () => {
    const dto = plainToInstance(CreateVisaCaseDto, {
      ...validBase,
      externalPrimaryRelationToApplicant: 'NOT_A_RELATION',
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain('家族関係が無効です');
  });
});
