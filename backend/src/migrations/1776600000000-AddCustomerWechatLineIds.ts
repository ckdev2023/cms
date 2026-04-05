/**
 * 为 customers 表追加微信 / LINE 联系方式字段（可空，与 phone 长度一致）。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 封装 customers 表微信与 LINE 列的新增与回滚。
 */
export class AddCustomerWechatLineIds1776600000000
  implements MigrationInterface
{
  name = 'AddCustomerWechatLineIds1776600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN "wechat_id" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN "line_id" character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "line_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "wechat_id"`,
    );
  }
}
