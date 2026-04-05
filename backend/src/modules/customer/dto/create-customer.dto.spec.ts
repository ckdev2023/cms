import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

import { CustomerType, ServiceType } from '../../../common/constants/enums';
import { CreateCustomerDto, PersonInfoDto } from './create-customer.dto';

function collectConstraintMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectConstraintMessages(error.children ?? []),
  ]);
}

describe('CreateCustomerDto', () => {
  it('rejects wechatId longer than 50 characters', async () => {
    const dto = plainToInstance(CreateCustomerDto, {
      customerType: CustomerType.PERSONAL,
      customerName: 'テスト',
      serviceType: ServiceType.ADMIN,
      wechatId: 'x'.repeat(51),
    });

    const errors = await validate(dto);

    expect(collectConstraintMessages(errors).length).toBeGreaterThan(0);
  });

  it('rejects lineId longer than 50 characters', async () => {
    const dto = plainToInstance(CreateCustomerDto, {
      customerType: CustomerType.PERSONAL,
      customerName: 'テスト',
      serviceType: ServiceType.ADMIN,
      lineId: 'x'.repeat(51),
    });

    const errors = await validate(dto);

    expect(collectConstraintMessages(errors).length).toBeGreaterThan(0);
  });

  it('accepts wechatId and lineId within length limit', async () => {
    const dto = plainToInstance(CreateCustomerDto, {
      customerType: CustomerType.PERSONAL,
      customerName: 'テスト',
      serviceType: ServiceType.ADMIN,
      wechatId: 'wx_demo',
      lineId: 'line_demo',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts optional ownerUserId when the value is a valid UUID v4', async () => {
    const dto = plainToInstance(CreateCustomerDto, {
      customerType: CustomerType.PERSONAL,
      customerName: 'テスト',
      serviceType: ServiceType.ADMIN,
      ownerUserId: '550e8400-e29b-41d4-a716-446655440000',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects ownerUserId when the value is not a UUID v4', async () => {
    const dto = plainToInstance(CreateCustomerDto, {
      customerType: CustomerType.PERSONAL,
      customerName: 'テスト',
      serviceType: ServiceType.ADMIN,
      ownerUserId: 'not-a-uuid',
    });

    const errors = await validate(dto);

    expect(collectConstraintMessages(errors)).toContain(
      '担当者IDの形式が無効です',
    );
  });
});

describe('PersonInfoDto', () => {
  it('requires familyRelation when isFamilyMember is true', async () => {
    const dto = plainToInstance(PersonInfoDto, {
      isFamilyMember: true,
    });

    const errors = await validate(dto);

    expect(collectConstraintMessages(errors)).toContain(
      '家族関係は家族成員の場合に必須です',
    );
  });

  it('validates familyRelation enum when the field is provided', async () => {
    const dto = plainToInstance(PersonInfoDto, {
      familyRelation: 'invalid',
    });

    const errors = await validate(dto);

    expect(collectConstraintMessages(errors)).toContain(
      '家族関係の値が無効です',
    );
  });

  it('accepts familyRelation when the value matches the enum', async () => {
    const dto = plainToInstance(PersonInfoDto, {
      isFamilyMember: true,
      familyRelation: 'SPOUSE',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects passportNumber longer than 64 characters', async () => {
    const dto = plainToInstance(PersonInfoDto, {
      passportNumber: 'x'.repeat(65),
    });

    const errors = await validate(dto);

    expect(collectConstraintMessages(errors).length).toBeGreaterThan(0);
  });
});
