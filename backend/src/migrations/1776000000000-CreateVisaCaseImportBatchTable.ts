/**
 * 创建 `visa_case_import_batches` 表，用于记录已成功提交的签证 CSV 导入批次。
 *
 * 列语义与 `docs/23` §6.4 冻結一致：`id` 即 `import_batch_id`；`created_by` 为操作者；
 * `created_at` 为批次时间；`content_sha256` 唯一以实现 §4.4 同内容幂等；`summary` 存汇总 JSON。
 * 与 `audit_logs`（`IMPORT` / `VISA_CASE_IMPORT`、`target_id` = 本表 `id`）对账。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 创建导入批次表及 content_sha256 唯一索引，支撑导入幂等与对账。
 */
export class CreateVisaCaseImportBatchTable1776000000000
  implements MigrationInterface
{
  name = 'CreateVisaCaseImportBatchTable1776000000000';

  /**
   * 执行建表与唯一索引创建。
   *
   * @param queryRunner - TypeORM 查询运行器
   * @returns 迁移向上执行完成的 Promise
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "visa_case_import_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "content_sha256" varchar(64) NOT NULL,
        "created_by" uuid,
        "summary" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_visa_case_import_batches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_visa_case_import_batches_content_sha256"
        ON "visa_case_import_batches" ("content_sha256")
    `);
  }

  /**
   * 删除导入批次唯一索引与整张表，用于开发环境回滚迁移。
   *
   * @param queryRunner - TypeORM 查询运行器
   * @returns 迁移回滚完成的 Promise
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_visa_case_import_batches_content_sha256"`,
    );
    await queryRunner.query(`DROP TABLE "visa_case_import_batches"`);
  }
}
