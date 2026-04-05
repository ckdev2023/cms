/**
 * 创建材料 checklist 三张表：模板主表、模板材料项、案件材料实例。
 *
 * 模板层按 case_type 预定义通用材料清单，实例层从模板快照后独立存储。
 * 实例项通过 visa_case_family_member_id 支持案件级与成员级两种归属维度。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 创建 material_templates、material_template_items、visa_case_material_items 三张表及索引。
 */
export class CreateMaterialChecklistTables1775800000000
  implements MigrationInterface
{
  name = 'CreateMaterialChecklistTables1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "material_templates" (
        "id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMP WITH TIME ZONE,
        "case_type"    varchar(100) NOT NULL,
        "display_name" varchar(200) NOT NULL,
        "is_active"    boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_material_templates" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_material_templates_case_type_active"
        ON "material_templates" ("case_type")
        WHERE "is_active" = true AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "material_template_items" (
        "id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "template_id"  uuid NOT NULL,
        "group_name"   varchar(100) NOT NULL,
        "item_name"    varchar(200) NOT NULL,
        "scope"        varchar(20) NOT NULL DEFAULT 'CASE',
        "sort_order"   int NOT NULL DEFAULT 0,
        "is_required"  boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_material_template_items" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "material_template_items"
        ADD CONSTRAINT "FK_mti_template"
        FOREIGN KEY ("template_id") REFERENCES "material_templates"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_mti_template_id"
        ON "material_template_items" ("template_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "visa_case_material_items" (
        "id"                           uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "visa_case_id"                 uuid NOT NULL,
        "template_item_id"             uuid,
        "visa_case_family_member_id"   uuid,
        "group_name"                   varchar(100) NOT NULL,
        "item_name"                    varchar(200) NOT NULL,
        "item_status"                  varchar(30) NOT NULL DEFAULT 'NOT_COLLECTED',
        "sort_order"                   int NOT NULL DEFAULT 0,
        "remark"                       text,
        "collected_at"                 TIMESTAMP WITH TIME ZONE,
        "created_by"                   uuid,
        CONSTRAINT "PK_visa_case_material_items" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "visa_case_material_items"
        ADD CONSTRAINT "FK_vcmi_visa_case"
        FOREIGN KEY ("visa_case_id") REFERENCES "visa_cases"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "visa_case_material_items"
        ADD CONSTRAINT "FK_vcmi_template_item"
        FOREIGN KEY ("template_item_id") REFERENCES "material_template_items"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "visa_case_material_items"
        ADD CONSTRAINT "FK_vcmi_family_member"
        FOREIGN KEY ("visa_case_family_member_id") REFERENCES "visa_case_family_members"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vcmi_visa_case_id"
        ON "visa_case_material_items" ("visa_case_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vcmi_visa_case_family_member"
        ON "visa_case_material_items" ("visa_case_id", "visa_case_family_member_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vcmi_visa_case_status"
        ON "visa_case_material_items" ("visa_case_id", "item_status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_vcmi_visa_case_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_vcmi_visa_case_family_member"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_vcmi_visa_case_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visa_case_material_items" DROP CONSTRAINT IF EXISTS "FK_vcmi_family_member"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visa_case_material_items" DROP CONSTRAINT IF EXISTS "FK_vcmi_template_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visa_case_material_items" DROP CONSTRAINT IF EXISTS "FK_vcmi_visa_case"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "visa_case_material_items"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mti_template_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "material_template_items" DROP CONSTRAINT IF EXISTS "FK_mti_template"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "material_template_items"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_material_templates_case_type_active"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "material_templates"`,
    );
  }
}
