/**
 * 创建签证案件主表与家属关联表，落地 S1 家族签建模冻结方案。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 创建签证案件主表 `visa_cases` 与案件级家属关联表 `visa_case_family_members`，
 * 落地 S1 家族签建模冻结方案：一案一主申请人、INTERNAL/EXTERNAL 双模式、软删除保护。
 */
export class CreateVisaCaseTables1775500000000 implements MigrationInterface {
  name = 'CreateVisaCaseTables1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "visa_cases" (
        "id"                            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"                    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"                    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at"                    TIMESTAMP WITH TIME ZONE,
        "customer_id"                   uuid NOT NULL,
        "case_status"                   varchar(30) NOT NULL DEFAULT 'DRAFT',
        "is_family_case"                boolean NOT NULL DEFAULT false,
        "family_link_mode"              varchar(20),
        "internal_primary_customer_id"  uuid,
        "external_primary_name"         varchar(200),
        "external_primary_case_type"    varchar(100),
        "external_primary_expire_date"  date,
        "created_by"                    uuid,
        "updated_by"                    uuid,
        CONSTRAINT "PK_visa_cases" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "visa_cases"
        ADD CONSTRAINT "FK_visa_cases_customer"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "visa_cases"
        ADD CONSTRAINT "FK_visa_cases_internal_primary"
        FOREIGN KEY ("internal_primary_customer_id") REFERENCES "customers"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_visa_cases_customer_id"
        ON "visa_cases" ("customer_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "visa_case_family_members" (
        "id"                      uuid NOT NULL DEFAULT uuid_generate_v4(),
        "visa_case_id"            uuid NOT NULL,
        "customer_id"             uuid NOT NULL,
        "member_role"             varchar(30) NOT NULL,
        "is_primary"              boolean NOT NULL DEFAULT false,
        "display_name_snapshot"   varchar(200) NOT NULL,
        "created_at"              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_visa_case_family_members" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "visa_case_family_members"
        ADD CONSTRAINT "FK_vcfm_visa_case"
        FOREIGN KEY ("visa_case_id") REFERENCES "visa_cases"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "visa_case_family_members"
        ADD CONSTRAINT "FK_vcfm_customer"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_vcfm_one_primary_per_case"
        ON "visa_case_family_members" ("visa_case_id")
        WHERE "is_primary" = true
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_vcfm_customer_per_case"
        ON "visa_case_family_members" ("visa_case_id", "customer_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vcfm_visa_case_id"
        ON "visa_case_family_members" ("visa_case_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vcfm_customer_id"
        ON "visa_case_family_members" ("customer_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_vcfm_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_vcfm_visa_case_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_vcfm_customer_per_case"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_vcfm_one_primary_per_case"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visa_case_family_members" DROP CONSTRAINT IF EXISTS "FK_vcfm_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visa_case_family_members" DROP CONSTRAINT IF EXISTS "FK_vcfm_visa_case"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "visa_case_family_members"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_visa_cases_customer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visa_cases" DROP CONSTRAINT IF EXISTS "FK_visa_cases_internal_primary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visa_cases" DROP CONSTRAINT IF EXISTS "FK_visa_cases_customer"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "visa_cases"`);
  }
}
