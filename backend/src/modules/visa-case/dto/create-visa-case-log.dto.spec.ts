import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

import { VisaCaseLogType } from '../../../common/constants/enums';
import { CreateVisaCaseLogDto } from './create-visa-case-log.dto';

function collectConstraintMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectConstraintMessages(error.children ?? []),
  ]);
}

const validBase = {
  logType: VisaCaseLogType.FOLLOW_UP,
  content: 'お客様に電話で進捗を確認しました',
};

describe('CreateVisaCaseLogDto — basic fields', () => {
  it('accepts minimal valid input', async () => {
    const dto = plainToInstance(CreateVisaCaseLogDto, validBase);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing logType', async () => {
    const dto = plainToInstance(CreateVisaCaseLogDto, {
      content: 'テスト内容',
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain('ログタイプが無効です');
  });

  it('rejects invalid logType', async () => {
    const dto = plainToInstance(CreateVisaCaseLogDto, {
      ...validBase,
      logType: 'INVALID',
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain('ログタイプが無効です');
  });

  it('rejects empty content', async () => {
    const dto = plainToInstance(CreateVisaCaseLogDto, {
      ...validBase,
      content: '',
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain(
      '内容を入力してください',
    );
  });

  it('rejects missing content', async () => {
    const dto = plainToInstance(CreateVisaCaseLogDto, {
      logType: VisaCaseLogType.SUBMISSION,
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain(
      '内容を入力してください',
    );
  });
});

describe('CreateVisaCaseLogDto — optional structured fields', () => {
  it('accepts all optional fields', async () => {
    const dto = plainToInstance(CreateVisaCaseLogDto, {
      ...validBase,
      logType: VisaCaseLogType.SUBMISSION,
      submittedItems: 'パスポート、在留カード',
      missingItems: '住民票',
      nextAction: '住民票を取得して再提出',
      nextFollowUpAt: '2026-04-10T09:00:00.000Z',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts supplement log with missingItems only (single material handoff)', async () => {
    const dto = plainToInstance(CreateVisaCaseLogDto, {
      logType: VisaCaseLogType.SUPPLEMENT,
      content: '材料「パスポート」は未受領のため、追補が必要です。',
      missingItems: 'パスポート',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid nextFollowUpAt format', async () => {
    const dto = plainToInstance(CreateVisaCaseLogDto, {
      ...validBase,
      nextFollowUpAt: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain('日付の形式が無効です');
  });

  it('accepts date-only string for nextFollowUpAt', async () => {
    const dto = plainToInstance(CreateVisaCaseLogDto, {
      ...validBase,
      nextFollowUpAt: '2026-04-10',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('CreateVisaCaseLogDto — all log types', () => {
  it.each(Object.values(VisaCaseLogType))('accepts logType %s', async (lt) => {
    const dto = plainToInstance(CreateVisaCaseLogDto, {
      ...validBase,
      logType: lt,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
