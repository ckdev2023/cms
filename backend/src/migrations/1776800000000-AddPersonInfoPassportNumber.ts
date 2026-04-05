/**
 * 为 person_info 表追加护照号列（可空 varchar(64)，不设唯一），与 docs/17 §1.12 一致。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 封装 person_info 表护照号列的新增与回滚。
 */
export class AddPersonInfoPassportNumber1776800000000 implements MigrationInterface {
  name = 'AddPersonInfoPassportNumber1776800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "person_info" ADD COLUMN "passport_number" character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "person_info" DROP COLUMN IF EXISTS "passport_number"`,
    );
  }
}
