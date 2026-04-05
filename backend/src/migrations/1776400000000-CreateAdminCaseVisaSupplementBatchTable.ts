/**
 * 创建 `admin_case_visa_supplement_batches` 表，记录行政案件向签证域补录批次。
 *
 * 以 `content_sha256`（所选行政案件 ID 列表的稳定序列化）唯一约束实现与 P1 CSV 导入同级的批次幂等。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 建表并创建 content_sha256 唯一索引，支撑 P2-S3d 补录工具批次去重与审计。
 */
export class CreateAdminCaseVisaSupplementBatchTable1776400000000
  implements MigrationInterface
{
  name = 'CreateAdminCaseVisaSupplementBatchTable1776400000000';

  /**
   * 执行建表与唯一索引创建。
   *
   * @param queryRunner - TypeORM 查询运行器
   * @returns 迁移向上执行完成的 Promise
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_case_visa_supplement_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "content_sha256" varchar(64) NOT NULL,
        "created_by" uuid,
        "summary" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_case_visa_supplement_batches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_admin_case_visa_supplement_batches_content_sha256"
        ON "admin_case_visa_supplement_batches" ("content_sha256")
    `);
  }

  /**
   * 删除补录批次表与唯一索引。
   *
   * @param queryRunner - TypeORM 查询运行器
   * @returns 迁移回滚完成的 Promise
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_admin_case_visa_supplement_batches_content_sha256"`,
    );
    await queryRunner.query(`DROP TABLE "admin_case_visa_supplement_batches"`);
  }
}
