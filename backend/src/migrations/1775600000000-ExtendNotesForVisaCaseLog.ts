/**
 * 扩展 notes 表以支持签证案件日志，落地 S2 notes 扩表冻结方案。
 *
 * 新增字段：visa_case_id、log_type、submitted_items、missing_items、next_action、next_follow_up_at。
 * 客户备注（visa_case_id IS NULL）继续沿用 note_type；案件日志（visa_case_id IS NOT NULL）使用 log_type。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 扩展 notes 表支持签证案件日志，新增 visa_case_id 外键、log_type 分类与结构化跟进字段。
 */
export class ExtendNotesForVisaCaseLog1775600000000
  implements MigrationInterface
{
  name = 'ExtendNotesForVisaCaseLog1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notes"
        ADD COLUMN "visa_case_id"       uuid,
        ADD COLUMN "log_type"           varchar(30),
        ADD COLUMN "submitted_items"    text,
        ADD COLUMN "missing_items"      text,
        ADD COLUMN "next_action"        text,
        ADD COLUMN "next_follow_up_at"  TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "notes"
        ADD CONSTRAINT "FK_notes_visa_case"
        FOREIGN KEY ("visa_case_id") REFERENCES "visa_cases"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notes_visa_case_id"
        ON "notes" ("visa_case_id")
        WHERE "visa_case_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notes_next_follow_up_at"
        ON "notes" ("next_follow_up_at")
        WHERE "next_follow_up_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notes_next_follow_up_at"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notes_visa_case_id"`);
    await queryRunner.query(
      `ALTER TABLE "notes" DROP CONSTRAINT IF EXISTS "FK_notes_visa_case"`,
    );
    await queryRunner.query(`
      ALTER TABLE "notes"
        DROP COLUMN IF EXISTS "next_follow_up_at",
        DROP COLUMN IF EXISTS "next_action",
        DROP COLUMN IF EXISTS "missing_items",
        DROP COLUMN IF EXISTS "submitted_items",
        DROP COLUMN IF EXISTS "log_type",
        DROP COLUMN IF EXISTS "visa_case_id"
    `);
  }
}
