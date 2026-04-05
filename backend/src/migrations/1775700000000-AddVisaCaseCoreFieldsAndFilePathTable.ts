/**
 * 补齐签证案件核心业务字段并创建客户资料路径台账表，落地 S4 接口契约冻结。
 *
 * visa_cases 新增：case_type、assigned_to、expire_date、next_follow_up_at、
 * material_status、fee_status、memo。
 * 新建 customer_file_paths 表用于记录服务器路径台账（非上传附件）。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 补齐 visa_cases 核心字段并创建 customer_file_paths 资料路径台账表。
 */
export class AddVisaCaseCoreFieldsAndFilePathTable1775700000000
  implements MigrationInterface
{
  name = 'AddVisaCaseCoreFieldsAndFilePathTable1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "visa_cases"
        ADD COLUMN "case_type"          varchar(100),
        ADD COLUMN "assigned_to"        uuid,
        ADD COLUMN "expire_date"        date,
        ADD COLUMN "next_follow_up_at"  TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "material_status"    varchar(30),
        ADD COLUMN "fee_status"         varchar(30),
        ADD COLUMN "memo"               text
    `);

    await queryRunner.query(`
      ALTER TABLE "visa_cases"
        ADD CONSTRAINT "FK_visa_cases_assigned_to"
        FOREIGN KEY ("assigned_to") REFERENCES "users"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_visa_cases_assigned_to"
        ON "visa_cases" ("assigned_to")
        WHERE "assigned_to" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_visa_cases_expire_date"
        ON "visa_cases" ("expire_date")
        WHERE "expire_date" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_visa_cases_next_follow_up_at"
        ON "visa_cases" ("next_follow_up_at")
        WHERE "next_follow_up_at" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "customer_file_paths" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at"    TIMESTAMP WITH TIME ZONE,
        "customer_id"   uuid NOT NULL,
        "visa_case_id"  uuid,
        "path_type"     varchar(30) NOT NULL DEFAULT 'OTHER',
        "file_path"     text NOT NULL,
        "display_name"  varchar(200),
        "remark"        text,
        "created_by"    uuid,
        CONSTRAINT "PK_customer_file_paths" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_file_paths"
        ADD CONSTRAINT "FK_cfp_customer"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_file_paths"
        ADD CONSTRAINT "FK_cfp_visa_case"
        FOREIGN KEY ("visa_case_id") REFERENCES "visa_cases"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cfp_customer_id"
        ON "customer_file_paths" ("customer_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cfp_visa_case_id"
        ON "customer_file_paths" ("visa_case_id")
        WHERE "visa_case_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cfp_visa_case_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cfp_customer_id"`);
    await queryRunner.query(
      `ALTER TABLE "customer_file_paths" DROP CONSTRAINT IF EXISTS "FK_cfp_visa_case"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_file_paths" DROP CONSTRAINT IF EXISTS "FK_cfp_customer"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_file_paths"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_visa_cases_next_follow_up_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_visa_cases_expire_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_visa_cases_assigned_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visa_cases" DROP CONSTRAINT IF EXISTS "FK_visa_cases_assigned_to"`,
    );
    await queryRunner.query(`
      ALTER TABLE "visa_cases"
        DROP COLUMN IF EXISTS "memo",
        DROP COLUMN IF EXISTS "fee_status",
        DROP COLUMN IF EXISTS "material_status",
        DROP COLUMN IF EXISTS "next_follow_up_at",
        DROP COLUMN IF EXISTS "expire_date",
        DROP COLUMN IF EXISTS "assigned_to",
        DROP COLUMN IF EXISTS "case_type"
    `);
  }
}
