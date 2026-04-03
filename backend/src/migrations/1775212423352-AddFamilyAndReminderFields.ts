/**
 * 通过 TypeORM 迁移为 person_info 表追加家族成员字段、主客户外键及在留期限索引。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 封装 person_info 表家族成员与提醒相关列及索引的升级与回滚步骤。
 */
export class AddFamilyAndReminderFields1775212423352
  implements MigrationInterface
{
  name = 'AddFamilyAndReminderFields1775212423352';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "person_info"
         ADD COLUMN "is_family_member" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `ALTER TABLE "person_info"
         ADD COLUMN "family_relation" varchar(30) NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "person_info"
         ADD COLUMN "primary_customer_id" uuid NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "person_info"
         ADD COLUMN "remind_days_before" int NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "person_info"
         ADD CONSTRAINT "FK_person_info_primary_customer"
         FOREIGN KEY ("primary_customer_id")
         REFERENCES "customers"("id")
         ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_person_info_residence_expire_date"
         ON "person_info" ("residence_expire_date")
         WHERE "residence_expire_date" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_person_info_residence_expire_date"`,
    );

    await queryRunner.query(
      `ALTER TABLE "person_info"
         DROP CONSTRAINT IF EXISTS "FK_person_info_primary_customer"`,
    );

    await queryRunner.query(
      `ALTER TABLE "person_info" DROP COLUMN IF EXISTS "remind_days_before"`,
    );
    await queryRunner.query(
      `ALTER TABLE "person_info" DROP COLUMN IF EXISTS "primary_customer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "person_info" DROP COLUMN IF EXISTS "family_relation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "person_info" DROP COLUMN IF EXISTS "is_family_member"`,
    );
  }
}
