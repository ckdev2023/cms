import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

import { NoteType } from '../../../common/constants/enums';
import { CreateNoteDto } from './create-note.dto';

function collectConstraintMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectConstraintMessages(error.children ?? []),
  ]);
}

const validBase = {
  content: '顧客からの連絡内容を共有メモとして残す',
  noteType: NoteType.GENERAL,
};

describe('CreateNoteDto — basic fields', () => {
  it('accepts minimal valid input', async () => {
    const dto = plainToInstance(CreateNoteDto, { content: validBase.content });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects empty content', async () => {
    const dto = plainToInstance(CreateNoteDto, { content: '' });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain(
      '内容を入力してください',
    );
  });
});

describe('CreateNoteDto — optional structured fields', () => {
  it('accepts all optional structured fields', async () => {
    const dto = plainToInstance(CreateNoteDto, {
      ...validBase,
      submittedItems: 'パスポート、在留カード',
      missingItems: '住民票',
      nextAction: '住民票を取得して再提出',
      nextFollowUpAt: '2026-04-10T09:00:00.000Z',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid nextFollowUpAt format', async () => {
    const dto = plainToInstance(CreateNoteDto, {
      ...validBase,
      nextFollowUpAt: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(collectConstraintMessages(errors)).toContain('日付の形式が無効です');
  });

  it('accepts date-only string for nextFollowUpAt', async () => {
    const dto = plainToInstance(CreateNoteDto, {
      ...validBase,
      nextFollowUpAt: '2026-04-10',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects submittedItems over max length', async () => {
    const dto = plainToInstance(CreateNoteDto, {
      ...validBase,
      submittedItems: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
