import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

import { VisaCaseMemberRole } from '../../../common/constants/enums';
import { CreateVisaCaseFamilyMemberDto } from './create-visa-case-family-member.dto';

function collectConstraintMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectConstraintMessages(error.children ?? []),
  ]);
}

describe('CreateVisaCaseFamilyMemberDto', () => {
  const validInput = {
    customerId: '00000000-0000-4000-a000-000000000001',
    memberRole: VisaCaseMemberRole.SPOUSE,
    displayNameSnapshot: '田中花子',
  };

  it('accepts valid input', async () => {
    const dto = plainToInstance(CreateVisaCaseFamilyMemberDto, validInput);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing customerId', async () => {
    const dto = plainToInstance(CreateVisaCaseFamilyMemberDto, {
      memberRole: VisaCaseMemberRole.CHILD,
      displayNameSnapshot: '田中一郎',
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain(
      '顧客IDの形式が無効です',
    );
  });

  it('rejects invalid memberRole', async () => {
    const dto = plainToInstance(CreateVisaCaseFamilyMemberDto, {
      ...validInput,
      memberRole: 'INVALID',
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain(
      'メンバー役割が無効です',
    );
  });

  it('rejects missing displayNameSnapshot', async () => {
    const dto = plainToInstance(CreateVisaCaseFamilyMemberDto, {
      customerId: '00000000-0000-4000-a000-000000000001',
      memberRole: VisaCaseMemberRole.APPLICANT,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts primary applicant member', async () => {
    const dto = plainToInstance(CreateVisaCaseFamilyMemberDto, {
      customerId: '00000000-0000-4000-a000-000000000001',
      memberRole: VisaCaseMemberRole.APPLICANT,
      isPrimary: true,
      displayNameSnapshot: '山田太郎',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects displayNameSnapshot exceeding 200 chars', async () => {
    const dto = plainToInstance(CreateVisaCaseFamilyMemberDto, {
      ...validInput,
      displayNameSnapshot: 'あ'.repeat(201),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
