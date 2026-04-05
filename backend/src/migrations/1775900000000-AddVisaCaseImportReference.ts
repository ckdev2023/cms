/**
 * 为历史签证导入幂等键落地 `visa_cases.import_reference`（对应模板列 `legacy_case_ref`），
 * 并建立部分唯一索引：同一服务上下文客户下非空引用不得重复。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 新增案件导入引用列及 (customer_id, import_reference) 部分唯一约束。
 */
export class AddVisaCaseImportReference1775900000000 implements MigrationInterface {
  name = 'AddVisaCaseImportReference1775900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "visa_cases"
        ADD COLUMN "import_reference" varchar(100)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_visa_cases_customer_import_reference"
        ON "visa_cases" ("customer_id", "import_reference")
        WHERE "import_reference" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "UQ_visa_cases_customer_import_reference"
    `);
    await queryRunner.query(`
      ALTER TABLE "visa_cases" DROP COLUMN "import_reference"
    `);
  }
}
