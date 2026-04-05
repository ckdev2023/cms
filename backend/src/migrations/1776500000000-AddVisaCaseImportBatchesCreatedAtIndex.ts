/**
 * 为 `visa_case_import_batches.created_at` 添加降序索引，支撑导入批次只读列表按时间分页查询。
 *
 * 与 `docs/23_P1历史签证数据导入口径冻結.md` §6.4 批次登记表审计对账场景一致。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 创建导入批次表 `created_at` 索引并可在回滚时删除。
 */
export class AddVisaCaseImportBatchesCreatedAtIndex1776500000000
  implements MigrationInterface
{
  name = 'AddVisaCaseImportBatchesCreatedAtIndex1776500000000';

  /**
   * 在批次表 `created_at` 列创建降序索引，支撑导入成功批次只读列表按提交时间倒序分页查询。
   *
   * @param queryRunner - TypeORM 查询运行器
   * @returns 迁移向上执行完成的 Promise
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_visa_case_import_batches_created_at"
        ON "visa_case_import_batches" ("created_at" DESC)
    `);
  }

  /**
   * 删除 `created_at` 索引。
   *
   * @param queryRunner - TypeORM 查询运行器
   * @returns 迁移回滚完成的 Promise
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_visa_case_import_batches_created_at"`,
    );
  }
}
