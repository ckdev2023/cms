/**
 * P2-S2f：为签证域 `dataScope`（assigned_to / 团队并集）与客户列表 EXISTS、
 * 补件日志子查询补充 B-Tree 索引，降低 mine/team 模式下嵌套循环与顺序扫描成本。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 在 `visa_cases` / `notes` 上增加与负责人范围、开放案件 EXISTS、最新案件日志相关的部分索引。
 */
export class AddVisaDataScopePerfIndexes1776300000000
  implements MigrationInterface
{
  name = 'AddVisaDataScopePerfIndexes1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_visa_cases_customer_assigned_open"
        ON "visa_cases" ("customer_id", "assigned_to")
        WHERE "deleted_at" IS NULL
          AND "case_status" NOT IN ('COMPLETED', 'CANCELLED')
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_visa_cases_assigned_to_case_status_not_deleted"
        ON "visa_cases" ("assigned_to", "case_status")
        WHERE "deleted_at" IS NULL
          AND "assigned_to" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notes_visa_case_created_desc_active"
        ON "notes" ("visa_case_id", "created_at" DESC)
        WHERE "deleted_at" IS NULL
          AND "visa_case_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notes_visa_case_created_desc_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_visa_cases_assigned_to_case_status_not_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_visa_cases_customer_assigned_open"`,
    );
  }
}
