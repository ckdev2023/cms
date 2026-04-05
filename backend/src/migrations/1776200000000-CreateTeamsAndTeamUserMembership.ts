/**
 * 建立签证域 P2-S2「团队」数据范围所需的团队主表与用户—团队多对多关联，对齐 docs/21 §18.4 可配置成员集合。
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 创建 `teams` 与 `team_users` 表，为登录用户并集解析 `teamUserIds` 提供持久化存储。
 */
export class CreateTeamsAndTeamUserMembership1776200000000
  implements MigrationInterface
{
  name = 'CreateTeamsAndTeamUserMembership1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        "name" character varying(100) NOT NULL,
        "description" character varying(500),
        "sort_order" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_85d13d8afce13fcd9d40a80301b" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_teams_name" ON "teams" ("name")
    `);
    await queryRunner.query(`
      CREATE TABLE "team_users" (
        "team_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        CONSTRAINT "PK_7e7c9a1b2d3e4f5a6b7c8d9e0f1" PRIMARY KEY ("team_id", "user_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_team_users_user_id" ON "team_users" ("user_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "team_users"
      ADD CONSTRAINT "FK_team_users_team_id"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "team_users"
      ADD CONSTRAINT "FK_team_users_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_users" DROP CONSTRAINT "FK_team_users_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_users" DROP CONSTRAINT "FK_team_users_team_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_users_user_id"`);
    await queryRunner.query(`DROP TABLE "team_users"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_teams_name"`);
    await queryRunner.query(`DROP TABLE "teams"`);
  }
}
