/**
 * 为跨客户签证案件列表常见筛选补充 B-Tree 索引，降低 case_status / fee_status / material_status 组合条件触发的全表扫风险。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 在 `visa_cases` 上增加列表筛选用部分索引（仅未软删行），对齐 P1-S4b 性能边界约定。
 */
export class AddVisaCaseListFilterIndexes1776100000000
  implements MigrationInterface
{
  name = 'AddVisaCaseListFilterIndexes1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_visa_cases_case_status_not_deleted"
        ON "visa_cases" ("case_status")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_visa_cases_fee_status_not_deleted"
        ON "visa_cases" ("fee_status")
        WHERE "deleted_at" IS NULL AND "fee_status" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_visa_cases_material_status_not_deleted"
        ON "visa_cases" ("material_status")
        WHERE "deleted_at" IS NULL AND "material_status" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_visa_cases_material_status_not_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_visa_cases_fee_status_not_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_visa_cases_case_status_not_deleted"`,
    );
  }
}
