/**
 * 为 visa_cases 表追加外部主申请人与本案件申请人关系字段（可空，与 FamilyRelation 枚举取值一致）。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 封装 visa_cases 表外部主申关系列的新增与回滚。
 */
export class AddVisaCaseExternalPrimaryRelationToApplicant1776700000000
  implements MigrationInterface
{
  name = 'AddVisaCaseExternalPrimaryRelationToApplicant1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "visa_cases" ADD COLUMN "external_primary_relation_to_applicant" character varying(30)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "visa_cases" DROP COLUMN IF EXISTS "external_primary_relation_to_applicant"`,
    );
  }
}
